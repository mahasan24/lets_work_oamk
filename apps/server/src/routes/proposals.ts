import { createUploadSignature } from "@lets_work/media";
import { Elysia, t } from "elysia";

import { FreelancerAccessError, requireFreelancerProfile } from "../lib/freelancer";
import { JobNotFoundError } from "../lib/hirer";
import {
  getFreelancerProposalForJob,
  ProposalForbiddenError,
  ProposalNotFoundError,
  ProposalStatusError,
  ProposalValidationError,
  saveFreelancerProposalDraft,
  submitFreelancerProposal,
  withdrawFreelancerProposal,
} from "../lib/proposals";
import { betterAuthPlugin } from "../plugins/auth";
import { COOKIE_AUTH_SECURITY } from "../lib/openapi-tags";

const proposalAttachmentSchema = t.Object({
  id: t.Optional(t.String()),
  url: t.String(),
  fileName: t.String(),
  mimeType: t.Optional(t.Nullable(t.String())),
});

const proposalWriteSchema = t.Object({
  coverLetter: t.Optional(t.String()),
  proposedRate: t.Optional(t.Nullable(t.String())),
  estimatedDuration: t.Optional(
    t.Nullable(
      t.Union([
        t.Literal("less_than_month"),
        t.Literal("one_to_three_months"),
        t.Literal("three_to_six_months"),
        t.Literal("more_than_six_months"),
      ]),
    ),
  ),
  attachments: t.Optional(t.Array(proposalAttachmentSchema)),
});

type ErrorResponse = { status: number; body: { error: string; errors?: string[] } };

function handleProposalError(error: unknown): ErrorResponse | null {
  if (error instanceof FreelancerAccessError) {
    return { status: 403, body: { error: error.message } };
  }
  if (error instanceof JobNotFoundError) {
    return { status: 404, body: { error: error.message } };
  }
  if (error instanceof ProposalNotFoundError) {
    return { status: 404, body: { error: error.message } };
  }
  if (error instanceof ProposalForbiddenError) {
    return { status: 403, body: { error: error.message } };
  }
  if (error instanceof ProposalValidationError) {
    return { status: 422, body: { error: error.message, errors: error.errors } };
  }
  if (error instanceof ProposalStatusError) {
    return { status: 409, body: { error: error.message } };
  }
  return null;
}

async function runFreelancerAction<T>(userId: string, action: () => Promise<T>) {
  try {
    await requireFreelancerProfile(userId);
    return { ok: true as const, data: await action() };
  } catch (error) {
    const mapped = handleProposalError(error);
    if (mapped) {
      return { ok: false as const, status: mapped.status, body: mapped.body };
    }
    throw error;
  }
}

export const freelancerProposalRoutes = new Elysia({
  prefix: "/api/freelancer",
  detail: {
    tags: ["Freelancer Proposals"],
    security: COOKIE_AUTH_SECURITY,
  },
})
  .use(betterAuthPlugin)
  .get(
    "/proposals/uploads/sign",
    async ({ user, status }) => {
      const result = await runFreelancerAction(user.id, async () =>
        createUploadSignature("proposal-attachments"),
      );
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    { auth: true, detail: { summary: "Sign proposal attachment upload" } },
  )
  .get(
    "/jobs/:jobId/proposal",
    async ({ user, params, status }) => {
      const result = await runFreelancerAction(user.id, () =>
        getFreelancerProposalForJob(params.jobId, user.id),
      );
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ jobId: t.String() }),
      detail: { summary: "Get my proposal for a job" },
    },
  )
  .put(
    "/jobs/:jobId/proposal",
    async ({ user, params, body, status }) => {
      const result = await runFreelancerAction(user.id, () =>
        saveFreelancerProposalDraft(params.jobId, user.id, body),
      );
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ jobId: t.String() }),
      body: proposalWriteSchema,
      detail: { summary: "Save proposal draft" },
    },
  )
  .post(
    "/jobs/:jobId/proposal/submit",
    async ({ user, params, body, status }) => {
      const result = await runFreelancerAction(user.id, () =>
        submitFreelancerProposal(params.jobId, user.id, body ?? undefined),
      );
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ jobId: t.String() }),
      body: t.Optional(proposalWriteSchema),
      detail: { summary: "Submit proposal", description: "Validates and submits a draft proposal." },
    },
  )
  .post(
    "/proposals/:id/withdraw",
    async ({ user, params, status }) => {
      const result = await runFreelancerAction(user.id, () =>
        withdrawFreelancerProposal(params.id, user.id),
      );
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ id: t.String() }),
      detail: { summary: "Withdraw submitted proposal" },
    },
  );
