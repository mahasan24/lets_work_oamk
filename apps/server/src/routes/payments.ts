import { Elysia, t } from "elysia";

import { runAction } from "../lib/http";
import {
  createMilestoneFundingCheckout,
  getCheckoutSessionSummary,
  getPaymentForUser,
  listPaymentsForUser,
} from "../lib/payments";
import {
  getConnectStatus,
  refreshConnectOnboarding,
  startConnectOnboarding,
  transferPaymentToConnect,
  transferPendingPayoutsForUser,
} from "../lib/stripe-connect";
import { COOKIE_AUTH_SECURITY } from "../lib/openapi-tags";
import { betterAuthPlugin } from "../plugins/auth";

export const paymentRoutes = new Elysia({
  prefix: "/api/payments",
  detail: {
    tags: ["Payments"],
    security: COOKIE_AUTH_SECURITY,
  },
})
  .use(betterAuthPlugin)
  .get(
    "/",
    async ({ user, query, status }) => {
      const result = await runAction(() =>
        listPaymentsForUser(user.id, {
          page: query.page,
          limit: query.limit,
          status: query.status,
          role: query.role,
        }),
      );
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      query: t.Object({
        page: t.Optional(t.Numeric()),
        limit: t.Optional(t.Numeric()),
        status: t.Optional(
          t.Union([
            t.Literal("pending"),
            t.Literal("held"),
            t.Literal("succeeded"),
            t.Literal("refunded"),
            t.Literal("failed"),
          ]),
        ),
        role: t.Optional(t.Union([t.Literal("payer"), t.Literal("payee")])),
      }),
      detail: {
        summary: "List payment history",
        description: "Paginated ledger of payments where the user is payer or payee.",
      },
    },
  )
  .get(
    "/connect/status",
    async ({ user, status }) => {
      const result = await runAction(() => getConnectStatus(user.id));
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      detail: { summary: "Get Stripe Connect payout status" },
    },
  )
  .post(
    "/connect/onboard",
    async ({ user, status }) => {
      const result = await runAction(() => startConnectOnboarding(user.id));
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      detail: {
        summary: "Start Stripe Connect onboarding",
        description: "Creates an Express account if needed and returns an Account Link URL.",
      },
    },
  )
  .post(
    "/connect/refresh",
    async ({ user, status }) => {
      const result = await runAction(() => refreshConnectOnboarding(user.id));
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      detail: { summary: "Refresh Stripe Connect onboarding link" },
    },
  )
  .post(
    "/connect/transfer-pending",
    async ({ user, status }) => {
      const result = await runAction(() => transferPendingPayoutsForUser(user.id));
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      detail: {
        summary: "Transfer all pending payouts",
        description:
          "Sends succeeded escrow funds without a transfer to the freelancer Connect account.",
      },
    },
  )
  .post(
    "/:paymentId/transfer",
    async ({ user, params, status }) => {
      const result = await runAction(async () => {
        await transferPaymentToConnect(params.paymentId, user.id);
        return getPaymentForUser(params.paymentId, user.id);
      });
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ paymentId: t.String() }),
      detail: { summary: "Transfer a single payment to Connect" },
    },
  )
  .post(
    "/milestones/:milestoneId/fund",
    async ({ user, params, status }) => {
      const result = await runAction(() =>
        createMilestoneFundingCheckout(params.milestoneId, user.id),
      );
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ milestoneId: t.String() }),
      detail: {
        summary: "Fund milestone escrow",
        description:
          "Creates a Stripe Checkout Session so the hirer can fund a pending milestone into escrow.",
      },
    },
  )
  .get(
    "/checkout/:sessionId",
    async ({ user, params, status }) => {
      const result = await runAction(() => getCheckoutSessionSummary(params.sessionId, user.id));
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ sessionId: t.String() }),
      detail: {
        summary: "Get Checkout Session summary",
        description: "Used by the success page after Stripe Checkout redirects back.",
      },
    },
  )
  .get(
    "/:paymentId",
    async ({ user, params, status }) => {
      const result = await runAction(() => getPaymentForUser(params.paymentId, user.id));
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ paymentId: t.String() }),
      detail: { summary: "Get payment by ID" },
    },
  );
