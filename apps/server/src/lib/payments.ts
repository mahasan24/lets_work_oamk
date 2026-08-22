import { stripeClient } from "@lets_work/auth";
import { db } from "@lets_work/db";
import { user } from "@lets_work/db/schema/auth";
import { contract } from "@lets_work/db/schema/contracts";
import { milestone } from "@lets_work/db/schema/milestones";
import { payment, stripeCustomer } from "@lets_work/db/schema/payments";
import { env } from "@lets_work/env/server";
import { and, count, desc, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "./errors";
import { buildPaginationMeta, resolvePagination } from "./http";
import {
  MilestoneForbiddenError,
  MilestoneNotFoundError,
  MilestoneStatusError,
} from "./milestones";
import { createNotification } from "./notifications";
import { tryTransferReleasedPayment } from "./stripe-connect";

export class PaymentNotFoundError extends NotFoundError {
  constructor() {
    super("Payment not found", "PAYMENT_NOT_FOUND");
  }
}

export class PaymentConflictError extends ConflictError {
  constructor(message: string) {
    super(message, "PAYMENT_CONFLICT");
  }
}

async function notifyQuietly(input: Parameters<typeof createNotification>[0]) {
  try {
    await createNotification(input);
  } catch (error) {
    console.error("Failed to create notification", error);
  }
}

function serializePayment(row: typeof payment.$inferSelect) {
  const payoutStatus =
    row.status === "pending"
      ? ("awaiting_funding" as const)
      : row.status === "held"
        ? ("in_escrow" as const)
        : row.status === "succeeded" && row.stripeTransferId
          ? ("paid_out" as const)
          : row.status === "succeeded"
            ? ("awaiting_payout" as const)
            : row.status === "refunded"
              ? ("refunded" as const)
              : ("failed" as const);

  return {
    id: row.id,
    contractId: row.contractId,
    milestoneId: row.milestoneId,
    payerUserId: row.payerUserId,
    payeeUserId: row.payeeUserId,
    status: row.status,
    payoutStatus,
    amount: row.amount,
    currency: row.currency,
    stripeCheckoutSessionId: row.stripeCheckoutSessionId,
    stripePaymentIntentId: row.stripePaymentIntentId,
    stripeTransferId: row.stripeTransferId,
    description: row.description,
    paidAt: row.paidAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export type PaymentView = ReturnType<typeof serializePayment>;

function amountToCents(amount: string) {
  const parsed = Number(amount);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new ValidationError(["Invalid milestone amount"], "Invalid milestone amount");
  }
  return Math.round(parsed * 100);
}

async function ensureStripeCustomer(userId: string) {
  const [existing] = await db
    .select()
    .from(stripeCustomer)
    .where(eq(stripeCustomer.userId, userId))
    .limit(1);

  if (existing) return existing;

  const [account] = await db
    .select({ email: user.email, name: user.name })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (!account) {
    throw new NotFoundError("User not found");
  }

  const customer = await stripeClient.customers.create({
    email: account.email,
    name: account.name,
    metadata: { userId },
  });

  const [created] = await db
    .insert(stripeCustomer)
    .values({
      userId,
      stripeCustomerId: customer.id,
    })
    .onConflictDoNothing()
    .returning();

  if (created) return created;

  const [raceWinner] = await db
    .select()
    .from(stripeCustomer)
    .where(eq(stripeCustomer.userId, userId))
    .limit(1);

  if (!raceWinner) {
    throw new Error("Failed to create Stripe customer");
  }

  return raceWinner;
}

async function getHirerMilestone(milestoneId: string, hirerUserId: string) {
  const [row] = await db
    .select({
      milestone,
      contract,
    })
    .from(milestone)
    .innerJoin(contract, eq(contract.id, milestone.contractId))
    .where(eq(milestone.id, milestoneId))
    .limit(1);

  if (!row) {
    throw new MilestoneNotFoundError();
  }

  if (row.contract.hirerUserId !== hirerUserId) {
    throw new MilestoneForbiddenError("Only the hiring client can fund this milestone");
  }

  if (row.contract.status !== "active" && row.contract.status !== "paused") {
    throw new MilestoneStatusError("Contract must be active to fund milestones");
  }

  return row;
}

/**
 * Creates (or resumes) a Checkout Session to fund a pending milestone into escrow.
 * Funds are held on the platform Stripe balance until the milestone is approved.
 */
export async function createMilestoneFundingCheckout(milestoneId: string, hirerUserId: string) {
  const { milestone: milestoneRow, contract: contractRow } = await getHirerMilestone(
    milestoneId,
    hirerUserId,
  );

  if (milestoneRow.status !== "pending") {
    throw new MilestoneStatusError("Only pending milestones can be funded");
  }

  const [existingHeld] = await db
    .select()
    .from(payment)
    .where(
      and(
        eq(payment.milestoneId, milestoneId),
        inArray(payment.status, ["pending", "held", "succeeded"]),
      ),
    )
    .limit(1);

  if (existingHeld?.status === "held" || existingHeld?.status === "succeeded") {
    throw new PaymentConflictError("This milestone is already funded");
  }

  const customer = await ensureStripeCustomer(hirerUserId);
  const amountCents = amountToCents(milestoneRow.amount);
  const currency = milestoneRow.currency.toLowerCase();
  const appUrl = env.CORS_ORIGIN.replace(/\/$/, "");

  let paymentId = existingHeld?.id ?? crypto.randomUUID();

  if (!existingHeld) {
    const [created] = await db
      .insert(payment)
      .values({
        id: paymentId,
        contractId: contractRow.id,
        milestoneId: milestoneRow.id,
        payerUserId: hirerUserId,
        payeeUserId: contractRow.freelancerUserId,
        status: "pending",
        amount: milestoneRow.amount,
        currency: milestoneRow.currency,
        description: `Escrow funding for milestone: ${milestoneRow.title}`,
        metadata: {
          milestoneTitle: milestoneRow.title,
          contractId: contractRow.id,
        },
      })
      .returning();

    if (!created) {
      throw new Error("Failed to create payment record");
    }
    paymentId = created.id;
  }

  const session = await stripeClient.checkout.sessions.create({
    mode: "payment",
    customer: customer.stripeCustomerId,
    client_reference_id: paymentId,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency,
          unit_amount: amountCents,
          product_data: {
            name: `Milestone escrow: ${milestoneRow.title}`,
            description: `Contract funding held until milestone approval`,
          },
        },
      },
    ],
    metadata: {
      paymentId,
      milestoneId: milestoneRow.id,
      contractId: contractRow.id,
      payerUserId: hirerUserId,
      payeeUserId: contractRow.freelancerUserId,
    },
    success_url: `${appUrl}/success?checkout_id={CHECKOUT_SESSION_ID}&contract_id=${contractRow.id}&role=hirer`,
    cancel_url: `${appUrl}/dashboard/hirer/contracts/${contractRow.id}`,
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL");
  }

  await db
    .update(payment)
    .set({
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : (session.payment_intent?.id ?? null),
    })
    .where(eq(payment.id, paymentId));

  return {
    paymentId,
    checkoutUrl: session.url,
    checkoutSessionId: session.id,
  };
}

/**
 * Marks escrow as held after successful Checkout and moves the milestone to `funded`.
 */
export async function markPaymentHeldFromCheckout(sessionId: string) {
  const session = await stripeClient.checkout.sessions.retrieve(sessionId, {
    expand: ["payment_intent", "payment_intent.latest_charge"],
  });

  if (session.payment_status !== "paid") {
    return null;
  }

  const paymentId = session.metadata?.paymentId ?? session.client_reference_id;
  if (!paymentId) {
    return null;
  }

  const [existing] = await db.select().from(payment).where(eq(payment.id, paymentId)).limit(1);
  if (!existing) {
    return null;
  }

  if (existing.status === "held" || existing.status === "succeeded") {
    return serializePayment(existing);
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;
  const chargeId =
    typeof session.payment_intent === "object" &&
    session.payment_intent &&
    "latest_charge" in session.payment_intent
      ? typeof session.payment_intent.latest_charge === "string"
        ? session.payment_intent.latest_charge
        : (session.payment_intent.latest_charge?.id ?? null)
      : null;

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(payment)
      .set({
        status: "held",
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: paymentIntentId ?? existing.stripePaymentIntentId,
        stripeChargeId: chargeId,
        paidAt: new Date(),
      })
      .where(and(eq(payment.id, paymentId), eq(payment.status, "pending")))
      .returning();

    if (!row) {
      return existing;
    }

    if (row.milestoneId) {
      await tx
        .update(milestone)
        .set({ status: "funded" })
        .where(and(eq(milestone.id, row.milestoneId), eq(milestone.status, "pending")));
    }

    return row;
  });

  if (updated.status === "held" && updated.payeeUserId && updated.contractId) {
    await notifyQuietly({
      userId: updated.payeeUserId,
      type: "payment",
      title: "Milestone funded",
      body: "A client funded a milestone into escrow. You can start work when ready.",
      actionUrl: `/dashboard/freelancer/contracts/${updated.contractId}`,
    });
  }

  if (updated.status === "held") {
    const { createInvoiceForPayment } = await import("./invoices");
    await createInvoiceForPayment(updated.id);
  }

  return serializePayment(updated);
}

/**
 * Releases held escrow after milestone approval and attempts a Connect transfer.
 */
export async function releaseMilestoneEscrow(milestoneId: string) {
  const [held] = await db
    .select()
    .from(payment)
    .where(and(eq(payment.milestoneId, milestoneId), eq(payment.status, "held")))
    .limit(1);

  if (!held) {
    // Milestone may have been approved without prior funding (legacy path).
    return null;
  }

  const [updatedPayment] = await db
    .update(payment)
    .set({
      status: "succeeded",
    })
    .where(and(eq(payment.id, held.id), eq(payment.status, "held")))
    .returning();

  if (!updatedPayment) {
    return null;
  }

  const [updatedMilestone] = await db
    .update(milestone)
    .set({
      status: "released",
      releasedAt: new Date(),
    })
    .where(
      and(
        eq(milestone.id, milestoneId),
        inArray(milestone.status, ["approved", "submitted", "funded"]),
      ),
    )
    .returning();

  const transferred = await tryTransferReleasedPayment(updatedPayment);
  const finalPayment = transferred ?? updatedPayment;

  return {
    payment: serializePayment(finalPayment),
    milestoneId: updatedMilestone?.id ?? milestoneId,
  };
}

export type ListPaymentsInput = {
  page?: number;
  limit?: number;
  status?: "pending" | "held" | "succeeded" | "refunded" | "failed";
  role?: "payer" | "payee";
};

export async function listPaymentsForUser(userId: string, input: ListPaymentsInput = {}) {
  const { page, limit, offset } = resolvePagination(input);
  const payer = alias(user, "payment_payer");
  const payee = alias(user, "payment_payee");
  const involvement = or(eq(payment.payerUserId, userId), eq(payment.payeeUserId, userId))!;

  const conditions = [involvement];
  if (input.role === "payer") {
    conditions.length = 0;
    conditions.push(eq(payment.payerUserId, userId));
  } else if (input.role === "payee") {
    conditions.length = 0;
    conditions.push(eq(payment.payeeUserId, userId));
  }
  if (input.status) {
    conditions.push(eq(payment.status, input.status));
  }

  const whereClause = and(...conditions);

  const [[totalRow], [awaitingPayoutRow], [inEscrowRow], [paidOutRow], rows] = await Promise.all([
    db.select({ total: count() }).from(payment).where(whereClause),
    db
      .select({ total: count() })
      .from(payment)
      .where(and(involvement, eq(payment.status, "succeeded"), isNull(payment.stripeTransferId))),
    db
      .select({ total: count() })
      .from(payment)
      .where(and(involvement, eq(payment.status, "held"))),
    db
      .select({ total: count() })
      .from(payment)
      .where(
        and(involvement, eq(payment.status, "succeeded"), isNotNull(payment.stripeTransferId)),
      ),
    db
      .select({
        payment,
        milestoneTitle: milestone.title,
        contractTitle: contract.title,
        payerName: payer.name,
        payeeName: payee.name,
      })
      .from(payment)
      .leftJoin(milestone, eq(milestone.id, payment.milestoneId))
      .leftJoin(contract, eq(contract.id, payment.contractId))
      .innerJoin(payer, eq(payer.id, payment.payerUserId))
      .leftJoin(payee, eq(payee.id, payment.payeeUserId))
      .where(whereClause)
      .orderBy(desc(payment.createdAt))
      .limit(limit)
      .offset(offset),
  ]);

  const items = rows.map((row) => ({
    ...serializePayment(row.payment),
    milestoneTitle: row.milestoneTitle,
    contractTitle: row.contractTitle,
    payerName: row.payerName,
    payeeName: row.payeeName,
    direction: row.payment.payerUserId === userId ? ("out" as const) : ("in" as const),
  }));

  return {
    items,
    pagination: buildPaginationMeta(page, limit, totalRow?.total ?? 0),
    summary: {
      awaitingPayout: awaitingPayoutRow?.total ?? 0,
      inEscrow: inEscrowRow?.total ?? 0,
      paidOut: paidOutRow?.total ?? 0,
    },
  };
}

export async function getPaymentForUser(paymentId: string, userId: string) {
  const [row] = await db.select().from(payment).where(eq(payment.id, paymentId)).limit(1);
  if (!row) {
    throw new PaymentNotFoundError();
  }

  if (row.payerUserId !== userId && row.payeeUserId !== userId) {
    throw new ForbiddenError("You do not have access to this payment");
  }

  return serializePayment(row);
}

export async function getCheckoutSessionSummary(
  sessionId: string,
  userId?: string,
): Promise<{
  checkoutSessionId: string;
  paymentStatus: string;
  contractId: string | null;
  payment: PaymentView | null;
}> {
  // Confirm escrow from the redirect as a webhook fallback (local/dev without Stripe CLI).
  if (userId) {
    await markPaymentHeldFromCheckout(sessionId);
  }

  const session = await stripeClient.checkout.sessions.retrieve(sessionId);
  const paymentId = session.metadata?.paymentId ?? session.client_reference_id;

  let paymentView: PaymentView | null = null;
  if (paymentId) {
    const [row] = await db.select().from(payment).where(eq(payment.id, paymentId)).limit(1);
    if (row) {
      if (userId && row.payerUserId !== userId && row.payeeUserId !== userId) {
        throw new ForbiddenError("You do not have access to this payment");
      }
      paymentView = serializePayment(row);
    }
  }

  return {
    checkoutSessionId: session.id,
    paymentStatus: session.payment_status,
    contractId: session.metadata?.contractId ?? paymentView?.contractId ?? null,
    payment: paymentView,
  };
}
