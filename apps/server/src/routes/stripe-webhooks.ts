import { Elysia } from "elysia";

import { processStripeWebhookEvent, verifyStripeWebhookEvent } from "../lib/stripe-webhooks";

/**
 * Stripe webhooks must receive the raw request body for signature verification.
 * Keep this route free of JSON body parsers / auth macros.
 */
export const stripeWebhookRoutes = new Elysia({
  prefix: "/api/stripe",
  detail: {
    tags: ["Payments"],
  },
}).post(
  "/webhook",
  async ({ request, set }) => {
    const signature = request.headers.get("stripe-signature");
    const rawBody = await request.text();

    let event;
    try {
      event = await verifyStripeWebhookEvent(rawBody, signature);
    } catch (error) {
      console.error("[stripe-webhook] signature verification failed", error);
      set.status = 400;
      return { error: "Invalid Stripe signature", code: "STRIPE_SIGNATURE" };
    }

    try {
      const result = await processStripeWebhookEvent(event);
      return { received: true, duplicate: result.duplicate };
    } catch (error) {
      console.error("[stripe-webhook] processing failed", error);
      set.status = 500;
      return { error: "Webhook processing failed", code: "STRIPE_WEBHOOK" };
    }
  },
  {
    parse: "none",
    detail: {
      summary: "Stripe webhook receiver",
      description:
        "Verifies Stripe signatures and processes checkout completion for escrow funding.",
      hide: true,
    },
  },
);
