import { Elysia, t } from "elysia";

import { runAction } from "../lib/http";
import {
  createMilestoneFundingCheckout,
  getCheckoutSessionSummary,
  getPaymentForUser,
} from "../lib/payments";
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
