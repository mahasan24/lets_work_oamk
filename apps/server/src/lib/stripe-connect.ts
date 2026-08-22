import { stripeClient } from "@lets_work/auth";
import { db } from "@lets_work/db";
import { user } from "@lets_work/db/schema/auth";
import { payment, stripeConnectAccount } from "@lets_work/db/schema/payments";
import { env } from "@lets_work/env/server";
import { and, eq, isNull } from "drizzle-orm";
import type Stripe from "stripe";

import { BadRequestError, ForbiddenError, NotFoundError } from "./errors";

export class ConnectNotReadyError extends BadRequestError {
  constructor(message = "Complete Stripe Connect onboarding before requesting payouts") {
    super(message, "CONNECT_NOT_READY");
  }
}

function appUrl() {
  return env.CORS_ORIGIN.replace(/\/$/, "");
}

function serializeConnectAccount(row: typeof stripeConnectAccount.$inferSelect) {
  return {
    stripeAccountId: row.stripeAccountId,
    chargesEnabled: row.chargesEnabled,
    payoutsEnabled: row.payoutsEnabled,
    detailsSubmitted: row.detailsSubmitted,
    readyForPayouts: row.payoutsEnabled && row.detailsSubmitted,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export type ConnectAccountView = ReturnType<typeof serializeConnectAccount>;

export async function upsertConnectAccountFromStripe(userId: string, account: Stripe.Account) {
  const values = {
    userId,
    stripeAccountId: account.id,
    chargesEnabled: Boolean(account.charges_enabled),
    payoutsEnabled: Boolean(account.payouts_enabled),
    detailsSubmitted: Boolean(account.details_submitted),
  };

  const [upserted] = await db
    .insert(stripeConnectAccount)
    .values(values)
    .onConflictDoUpdate({
      target: stripeConnectAccount.userId,
      set: {
        stripeAccountId: values.stripeAccountId,
        chargesEnabled: values.chargesEnabled,
        payoutsEnabled: values.payoutsEnabled,
        detailsSubmitted: values.detailsSubmitted,
      },
    })
    .returning();

  return upserted;
}

export async function syncConnectAccountByStripeId(stripeAccountId: string) {
  const account = await stripeClient.accounts.retrieve(stripeAccountId);
  const userId = account.metadata?.userId;
  if (!userId) {
    const [existing] = await db
      .select()
      .from(stripeConnectAccount)
      .where(eq(stripeConnectAccount.stripeAccountId, stripeAccountId))
      .limit(1);
    if (!existing) return null;
    return upsertConnectAccountFromStripe(existing.userId, account);
  }
  return upsertConnectAccountFromStripe(userId, account);
}

async function ensureExpressConnectAccount(userId: string) {
  const [existing] = await db
    .select()
    .from(stripeConnectAccount)
    .where(eq(stripeConnectAccount.userId, userId))
    .limit(1);

  if (existing) {
    const account = await stripeClient.accounts.retrieve(existing.stripeAccountId);
    const synced = await upsertConnectAccountFromStripe(userId, account);
    return synced ?? existing;
  }

  const [accountUser] = await db
    .select({ email: user.email, name: user.name })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (!accountUser) {
    throw new NotFoundError("User not found");
  }

  const account = await stripeClient.accounts.create({
    type: "express",
    email: accountUser.email,
    business_profile: {
      name: accountUser.name || undefined,
      product_description: "Freelance services on Lets Work",
    },
    capabilities: {
      transfers: { requested: true },
    },
    metadata: { userId },
  });

  const created = await upsertConnectAccountFromStripe(userId, account);
  if (!created) {
    throw new Error("Failed to store Connect account");
  }
  return created;
}

async function createAccountLink(stripeAccountId: string) {
  const base = appUrl();
  return stripeClient.accountLinks.create({
    account: stripeAccountId,
    refresh_url: `${base}/dashboard/freelancer/payments?connect=refresh`,
    return_url: `${base}/dashboard/freelancer/payments?connect=return`,
    type: "account_onboarding",
  });
}

export async function getConnectStatus(userId: string) {
  const [row] = await db
    .select()
    .from(stripeConnectAccount)
    .where(eq(stripeConnectAccount.userId, userId))
    .limit(1);

  if (!row) {
    return { connected: false as const, account: null };
  }

  const account = await stripeClient.accounts.retrieve(row.stripeAccountId);
  const synced = await upsertConnectAccountFromStripe(userId, account);

  return {
    connected: true as const,
    account: serializeConnectAccount(synced ?? row),
  };
}

export async function startConnectOnboarding(userId: string) {
  const row = await ensureExpressConnectAccount(userId);
  const link = await createAccountLink(row.stripeAccountId);
  return {
    account: serializeConnectAccount(row),
    onboardingUrl: link.url,
  };
}

export async function refreshConnectOnboarding(userId: string) {
  const [row] = await db
    .select()
    .from(stripeConnectAccount)
    .where(eq(stripeConnectAccount.userId, userId))
    .limit(1);

  if (!row) {
    return startConnectOnboarding(userId);
  }

  const link = await createAccountLink(row.stripeAccountId);
  return {
    account: serializeConnectAccount(row),
    onboardingUrl: link.url,
  };
}

function amountToCents(amount: string) {
  const parsed = Number(amount);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new BadRequestError("Invalid payment amount");
  }
  return Math.round(parsed * 100);
}

function isStripeError(
  error: unknown,
): error is { code?: string; message?: string; type?: string; statusCode?: number } {
  return Boolean(error && typeof error === "object" && "type" in error);
}

type TransferSource = {
  chargeId: string;
  /** Settlement currency for source_transaction transfers (may differ from charge currency). */
  currency: string;
  /** Max transferable amount in settlement-currency cents (net of Stripe fees). */
  amountCents: number;
};

async function resolveTransferSource(
  row: typeof payment.$inferSelect,
): Promise<TransferSource | null> {
  let chargeId = row.stripeChargeId;

  if (!chargeId && row.stripePaymentIntentId) {
    const intent = await stripeClient.paymentIntents.retrieve(row.stripePaymentIntentId, {
      expand: ["latest_charge"],
    });
    chargeId =
      typeof intent.latest_charge === "string"
        ? intent.latest_charge
        : (intent.latest_charge?.id ?? null);
  }

  if (!chargeId) {
    return null;
  }

  if (chargeId !== row.stripeChargeId) {
    await db
      .update(payment)
      .set({ stripeChargeId: chargeId })
      .where(and(eq(payment.id, row.id), isNull(payment.stripeChargeId)));
  }

  const charge = await stripeClient.charges.retrieve(chargeId, {
    expand: ["balance_transaction"],
  });

  const balanceTx = charge.balance_transaction;
  if (balanceTx && typeof balanceTx !== "string") {
    return {
      chargeId,
      currency: balanceTx.currency,
      // Net is what landed on the platform balance after Stripe fees.
      amountCents: balanceTx.net,
    };
  }

  return {
    chargeId,
    currency: charge.currency,
    amountCents: charge.amount,
  };
}

/**
 * Transfers platform-held escrow funds to a freelancer's Connect account.
 * Uses `source_transaction` when possible so test-mode payouts work before
 * Checkout funds leave the pending balance. Transfer currency must match the
 * charge's balance-transaction currency (e.g. EUR settlement on EU accounts).
 */
export async function transferPaymentToConnect(paymentId: string, actorUserId?: string) {
  const [row] = await db.select().from(payment).where(eq(payment.id, paymentId)).limit(1);
  if (!row) {
    throw new NotFoundError("Payment not found", "PAYMENT_NOT_FOUND");
  }

  if (!row.payeeUserId) {
    throw new BadRequestError("Payment has no payee");
  }

  if (actorUserId && row.payeeUserId !== actorUserId) {
    throw new ForbiddenError("Only the payee can claim this payout");
  }

  if (row.stripeTransferId) {
    return row;
  }

  if (row.status !== "succeeded" && row.status !== "held") {
    throw new BadRequestError("Payment is not ready for payout");
  }

  const [connect] = await db
    .select()
    .from(stripeConnectAccount)
    .where(eq(stripeConnectAccount.userId, row.payeeUserId))
    .limit(1);

  if (!connect?.payoutsEnabled || !connect.detailsSubmitted) {
    throw new ConnectNotReadyError();
  }

  const source = await resolveTransferSource(row);
  const fallbackAmountCents = amountToCents(row.amount);
  const fallbackCurrency = row.currency.toLowerCase();

  try {
    const transfer = await stripeClient.transfers.create({
      // With source_transaction, amount/currency must match the charge's
      // balance transaction (EU platforms often settle USD checkouts in EUR).
      amount: source?.amountCents ?? fallbackAmountCents,
      currency: source?.currency ?? fallbackCurrency,
      destination: connect.stripeAccountId,
      transfer_group: row.id,
      ...(source ? { source_transaction: source.chargeId } : {}),
      metadata: {
        paymentId: row.id,
        milestoneId: row.milestoneId ?? "",
        contractId: row.contractId ?? "",
        payeeUserId: row.payeeUserId,
        appCurrency: row.currency,
        appAmount: row.amount,
      },
    });

    const [updated] = await db
      .update(payment)
      .set({
        status: "succeeded",
        stripeTransferId: transfer.id,
        stripeChargeId: source?.chargeId ?? row.stripeChargeId,
      })
      .where(and(eq(payment.id, paymentId), isNull(payment.stripeTransferId)))
      .returning();

    return updated ?? row;
  } catch (error) {
    if (isStripeError(error) && error.code === "balance_insufficient") {
      throw new BadRequestError(
        source
          ? "Stripe could not transfer this escrow yet. Wait a moment and try again, or fund your test balance with card 4000 0000 0000 0077."
          : "Your Stripe test platform balance is empty. In Test mode, add available funds with card 4000 0000 0000 0077 (see Stripe testing docs), then retry the payout.",
        "STRIPE_BALANCE_INSUFFICIENT",
      );
    }

    if (
      isStripeError(error) &&
      typeof error.message === "string" &&
      error.message.toLowerCase().includes("currency")
    ) {
      throw new BadRequestError(
        `Stripe payout currency mismatch: ${error.message}. Your platform settles in a different currency than the job currency — retry after the server maps the charge settlement currency.`,
        "STRIPE_CURRENCY_MISMATCH",
      );
    }

    if (isStripeError(error) && error.message) {
      throw new BadRequestError(error.message, "STRIPE_TRANSFER_FAILED");
    }

    throw error;
  }
}

/**
 * Best-effort transfer after milestone approval. Returns null when Connect is not ready.
 */
export async function tryTransferReleasedPayment(paymentRow: typeof payment.$inferSelect) {
  if (!paymentRow.payeeUserId || paymentRow.stripeTransferId) {
    return null;
  }

  try {
    return await transferPaymentToConnect(paymentRow.id);
  } catch (error) {
    if (error instanceof ConnectNotReadyError) {
      return null;
    }
    console.error("[payments] transfer after release failed", paymentRow.id, error);
    return null;
  }
}

export async function transferPendingPayoutsForUser(userId: string) {
  const status = await getConnectStatus(userId);
  if (!status.connected || !status.account?.readyForPayouts) {
    throw new ConnectNotReadyError();
  }

  const pending = await db
    .select()
    .from(payment)
    .where(
      and(
        eq(payment.payeeUserId, userId),
        eq(payment.status, "succeeded"),
        isNull(payment.stripeTransferId),
      ),
    );

  const transferred: string[] = [];
  const failed: Array<{ paymentId: string; error: string }> = [];

  for (const row of pending) {
    try {
      const updated = await transferPaymentToConnect(row.id, userId);
      if (updated.stripeTransferId) {
        transferred.push(updated.id);
      }
    } catch (error) {
      failed.push({
        paymentId: row.id,
        error: error instanceof Error ? error.message : "Transfer failed",
      });
    }
  }

  return {
    transferredCount: transferred.length,
    transferredPaymentIds: transferred,
    failed,
    account: status.account,
  };
}
