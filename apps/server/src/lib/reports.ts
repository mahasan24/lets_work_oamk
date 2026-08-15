import { db } from "@lets_work/db";
import { user } from "@lets_work/db/schema/auth";
import { conversationParticipant, message } from "@lets_work/db/schema/chat";
import { job, proposal } from "@lets_work/db/schema/jobs";
import { report } from "@lets_work/db/schema/moderation";
import { and, count, desc, eq, inArray, isNull, or, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { setUserSuspended } from "./admin-users";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "./errors";
import { buildPaginationMeta, resolvePagination } from "./http";
import { createNotification } from "./notifications";

const REPORT_TYPES = ["spam", "fraud", "harassment", "abuse", "other"] as const;
const OPEN_STATUSES = ["open", "under_review"] as const;

export type ReportType = (typeof REPORT_TYPES)[number];
export type ReportStatus = "open" | "under_review" | "resolved" | "dismissed";

export class ReportNotFoundError extends NotFoundError {
  constructor(message = "Report not found", code = "REPORT_NOT_FOUND") {
    super(message, code);
  }
}

export class ReportForbiddenError extends ForbiddenError {
  constructor(message = "You do not have access to this report") {
    super(message, "REPORT_FORBIDDEN");
  }
}

export class ReportConflictError extends ConflictError {
  constructor(message: string) {
    super(message, "REPORT_CONFLICT");
  }
}

function serializeReport(row: typeof report.$inferSelect) {
  return {
    id: row.id,
    reporterId: row.reporterId,
    reportedUserId: row.reportedUserId,
    reportedJobId: row.reportedJobId,
    reportedProposalId: row.reportedProposalId,
    reportedMessageId: row.reportedMessageId,
    reportType: row.reportType,
    description: row.description,
    status: row.status,
    resolvedAt: row.resolvedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function notifyQuietly(input: Parameters<typeof createNotification>[0]) {
  try {
    await createNotification(input);
  } catch (error) {
    console.error("Failed to create notification", error);
  }
}

export type CreateReportInput = {
  reportType: ReportType;
  description: string;
  reportedUserId?: string | null;
  reportedJobId?: string | null;
  reportedProposalId?: string | null;
  reportedMessageId?: string | null;
};

export async function createReport(reporterId: string, input: CreateReportInput) {
  if (!REPORT_TYPES.includes(input.reportType)) {
    throw new BadRequestError("Invalid report type", "REPORT_TYPE");
  }

  const description = input.description.trim();
  if (description.length < 20) {
    throw new BadRequestError(
      "Report description must be at least 20 characters",
      "REPORT_DESCRIPTION",
    );
  }

  let reportedUserId = input.reportedUserId?.trim() || null;
  const reportedJobId = input.reportedJobId?.trim() || null;
  const reportedProposalId = input.reportedProposalId?.trim() || null;
  const reportedMessageId = input.reportedMessageId?.trim() || null;

  if (!reportedUserId && !reportedJobId && !reportedProposalId && !reportedMessageId) {
    throw new BadRequestError(
      "Report must target a user, job, proposal, or message",
      "REPORT_TARGET_REQUIRED",
    );
  }

  if (reportedUserId) {
    if (reportedUserId === reporterId) {
      throw new BadRequestError("You cannot report yourself", "REPORT_SELF");
    }
    const [targetUser] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, reportedUserId))
      .limit(1);
    if (!targetUser) {
      throw new ReportNotFoundError("Reported user not found", "REPORTED_USER_NOT_FOUND");
    }
  }

  if (reportedJobId) {
    const [jobRow] = await db
      .select({ id: job.id, hirerUserId: job.hirerUserId })
      .from(job)
      .where(eq(job.id, reportedJobId))
      .limit(1);
    if (!jobRow) {
      throw new ReportNotFoundError("Reported job not found", "REPORTED_JOB_NOT_FOUND");
    }
    if (jobRow.hirerUserId === reporterId) {
      throw new BadRequestError("You cannot report your own job", "REPORT_OWN_JOB");
    }
    reportedUserId ??= jobRow.hirerUserId;
  }

  if (reportedProposalId) {
    const [proposalRow] = await db
      .select({
        id: proposal.id,
        freelancerUserId: proposal.freelancerUserId,
        jobId: proposal.jobId,
      })
      .from(proposal)
      .where(eq(proposal.id, reportedProposalId))
      .limit(1);
    if (!proposalRow) {
      throw new ReportNotFoundError("Reported proposal not found", "REPORTED_PROPOSAL_NOT_FOUND");
    }
    if (proposalRow.freelancerUserId === reporterId) {
      throw new BadRequestError("You cannot report your own proposal", "REPORT_OWN_PROPOSAL");
    }
    const [jobRow] = await db
      .select({ hirerUserId: job.hirerUserId })
      .from(job)
      .where(eq(job.id, proposalRow.jobId))
      .limit(1);
    if (!jobRow || jobRow.hirerUserId !== reporterId) {
      throw new ReportForbiddenError("Only the job owner can report this proposal");
    }
    reportedUserId ??= proposalRow.freelancerUserId;
  }

  if (reportedMessageId) {
    const [messageRow] = await db
      .select({
        id: message.id,
        senderId: message.senderId,
        conversationId: message.conversationId,
        deletedAt: message.deletedAt,
      })
      .from(message)
      .where(eq(message.id, reportedMessageId))
      .limit(1);
    if (!messageRow || messageRow.deletedAt) {
      throw new ReportNotFoundError("Reported message not found", "REPORTED_MESSAGE_NOT_FOUND");
    }
    if (messageRow.senderId === reporterId) {
      throw new BadRequestError("You cannot report your own message", "REPORT_OWN_MESSAGE");
    }
    const [participant] = await db
      .select({ userId: conversationParticipant.userId })
      .from(conversationParticipant)
      .where(
        and(
          eq(conversationParticipant.conversationId, messageRow.conversationId),
          eq(conversationParticipant.userId, reporterId),
        ),
      )
      .limit(1);
    if (!participant) {
      throw new ReportForbiddenError("You are not a participant in this conversation");
    }
    reportedUserId ??= messageRow.senderId;
  }

  const duplicateConditions: SQL[] = [];
  if (reportedMessageId) {
    duplicateConditions.push(eq(report.reportedMessageId, reportedMessageId));
  } else if (reportedProposalId) {
    duplicateConditions.push(eq(report.reportedProposalId, reportedProposalId));
  } else if (reportedJobId) {
    duplicateConditions.push(eq(report.reportedJobId, reportedJobId));
  } else if (reportedUserId) {
    duplicateConditions.push(
      and(
        eq(report.reportedUserId, reportedUserId),
        isNull(report.reportedJobId),
        isNull(report.reportedProposalId),
        isNull(report.reportedMessageId),
      )!,
    );
  }

  if (duplicateConditions.length > 0) {
    const [existing] = await db
      .select({ id: report.id })
      .from(report)
      .where(
        and(
          eq(report.reporterId, reporterId),
          inArray(report.status, [...OPEN_STATUSES]),
          or(...duplicateConditions),
        ),
      )
      .limit(1);

    if (existing) {
      throw new ReportConflictError("You already have an open report for this content");
    }
  }

  const [created] = await db
    .insert(report)
    .values({
      id: crypto.randomUUID(),
      reporterId,
      reportedUserId,
      reportedJobId,
      reportedProposalId,
      reportedMessageId,
      reportType: input.reportType,
      description,
      status: "open",
    })
    .returning();

  if (!created) {
    throw new ConflictError("Failed to create report");
  }

  return serializeReport(created);
}

export async function listReportsForUser(
  userId: string,
  query: { page?: number; limit?: number; status?: ReportStatus },
) {
  const { page, limit, offset } = resolvePagination(query);
  const filters = [eq(report.reporterId, userId)];
  if (query.status) {
    filters.push(eq(report.status, query.status));
  }

  const where = and(...filters);

  const [totalRow, items] = await Promise.all([
    db.select({ total: count() }).from(report).where(where),
    db
      .select()
      .from(report)
      .where(where)
      .orderBy(desc(report.createdAt))
      .limit(limit)
      .offset(offset),
  ]);

  return {
    items: items.map(serializeReport),
    pagination: buildPaginationMeta(page, limit, totalRow[0]?.total ?? 0),
  };
}

export async function listAdminReports(query: {
  page?: number;
  limit?: number;
  status?: "open" | "under_review" | "resolved" | "dismissed" | "all" | "queue";
}) {
  const { page, limit, offset } = resolvePagination(query);
  const reporter = alias(user, "reporter");
  const reported = alias(user, "reported");

  const statusFilter =
    !query.status || query.status === "queue"
      ? inArray(report.status, [...OPEN_STATUSES])
      : query.status === "all"
        ? undefined
        : eq(report.status, query.status);

  const where = statusFilter;

  const [totalRow, rows] = await Promise.all([
    db.select({ total: count() }).from(report).where(where),
    db
      .select({
        report,
        reporterName: reporter.name,
        reporterEmail: reporter.email,
        reportedName: reported.name,
        reportedEmail: reported.email,
        jobTitle: job.title,
        messageBody: message.body,
        proposalFreelancerId: proposal.freelancerUserId,
      })
      .from(report)
      .innerJoin(reporter, eq(report.reporterId, reporter.id))
      .leftJoin(reported, eq(report.reportedUserId, reported.id))
      .leftJoin(job, eq(report.reportedJobId, job.id))
      .leftJoin(message, eq(report.reportedMessageId, message.id))
      .leftJoin(proposal, eq(report.reportedProposalId, proposal.id))
      .where(where)
      .orderBy(desc(report.createdAt))
      .limit(limit)
      .offset(offset),
  ]);

  return {
    items: rows.map((row) => ({
      ...serializeReport(row.report),
      reporterName: row.reporterName,
      reporterEmail: row.reporterEmail,
      reportedName: row.reportedName,
      reportedEmail: row.reportedEmail,
      jobTitle: row.jobTitle,
      messagePreview: row.messageBody
        ? row.messageBody.length > 160
          ? `${row.messageBody.slice(0, 157)}…`
          : row.messageBody
        : null,
      proposalFreelancerId: row.proposalFreelancerId,
    })),
    pagination: buildPaginationMeta(page, limit, totalRow[0]?.total ?? 0),
  };
}

export async function markReportUnderReview(reportId: string) {
  const [existing] = await db.select().from(report).where(eq(report.id, reportId)).limit(1);
  if (!existing) {
    throw new ReportNotFoundError();
  }
  if (existing.status !== "open" && existing.status !== "under_review") {
    throw new ReportConflictError("Only open reports can be marked under review");
  }

  const [updated] = await db
    .update(report)
    .set({ status: "under_review" })
    .where(and(eq(report.id, reportId), inArray(report.status, [...OPEN_STATUSES])))
    .returning();

  if (!updated) {
    throw new ReportConflictError("Report could not be updated");
  }

  return serializeReport(updated);
}

export async function resolveAdminReport(
  reportId: string,
  adminUserId: string,
  input: {
    status: "resolved" | "dismissed";
    note?: string | null;
    suspendReportedUser?: boolean;
    suspendReason?: string | null;
  },
) {
  const [existing] = await db.select().from(report).where(eq(report.id, reportId)).limit(1);
  if (!existing) {
    throw new ReportNotFoundError();
  }
  if (existing.status === "resolved" || existing.status === "dismissed") {
    throw new ReportConflictError("This report is already closed");
  }

  const note = input.note?.trim() || null;
  if (note && note.length < 10) {
    throw new BadRequestError("Resolution note must be at least 10 characters", "REPORT_NOTE");
  }

  const [updated] = await db
    .update(report)
    .set({
      status: input.status,
      resolvedAt: new Date(),
    })
    .where(and(eq(report.id, reportId), inArray(report.status, [...OPEN_STATUSES])))
    .returning();

  if (!updated) {
    throw new ReportConflictError("Report could not be updated");
  }

  const outcomeLabel = input.status === "resolved" ? "resolved" : "dismissed";
  await notifyQuietly({
    userId: existing.reporterId,
    type: "report",
    title: `Your report was ${outcomeLabel}`,
    body:
      note ??
      (input.status === "resolved"
        ? "Thanks for reporting. We reviewed the content and took action."
        : "Thanks for reporting. We reviewed the content and closed the report without further action."),
  });

  if (input.suspendReportedUser && existing.reportedUserId) {
    await setUserSuspended(existing.reportedUserId, adminUserId, {
      suspended: true,
      reason: input.suspendReason?.trim() || note || `Suspended after report ${reportId}`,
    });
  }

  return serializeReport(updated);
}
