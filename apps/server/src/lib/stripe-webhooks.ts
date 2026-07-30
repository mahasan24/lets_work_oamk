import { stripeClient } from "@lets_work/auth";
import { db } from "@lets_work/db";
import { stripeWebhookEvent } from "@lets_work/db/schema/payments";
import { env } from "@lets_work/env/server";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";

import { markPaymentHeldFromCheckout } from "./payments";

export async function verifyStripeWebhookEvent(rawBody: string, signature: string | null) {
  if (!signature) {
    throw new Error("Missing Stripe signature");
  }

  return stripeClient.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
}

async function alreadyProcessed(stripeEventId: string) {
  const [existing] = await db
    .select({ id: stripeWebhookEvent.id, processedAt: stripeWebhookEvent.processedAt })
    .from(stripeWebhookEvent)
    .where(eq(stripeWebhookEvent.stripeEventId, stripeEventId))
    .limit(1);

  return Boolean(existing?.processedAt);
}

async function recordWebhookEvent(event: Stripe.Event) {
  await db
    .insert(stripeWebhookEvent)
    .values({
      id: crypto.randomUUID(),
      stripeEventId: event.id,
      eventType: event.type,
      payload: event as unknown as Record<string, unknown>,
    })
    .onConflictDoNothing({ target: stripeWebhookEvent.stripeEventId });
}

async function markWebhookProcessed(stripeEventId: string) {
  await db
    .update(stripeWebhookEvent)
    .set({ processedAt: new Date() })
    .where(eq(stripeWebhookEvent.stripeEventId, stripeEventId));
}

export async function processStripeWebhookEvent(event: Stripe.Event) {
  if (await alreadyProcessed(event.id)) {
    return { ok: true as const, duplicate: true };
  }

  await recordWebhookEvent(event);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "payment") {
          await markPaymentHeldFromCheckout(session.id);
        }
        break;
      }
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        await markPaymentHeldFromCheckout(session.id);
        break;
      }
      default:
        break;
    }

    await markWebhookProcessed(event.id);
    return { ok: true as const, duplicate: false };
  } catch (error) {
    console.error("[stripe-webhook] failed to process event", event.id, event.type, error);
    throw error;
  }
}
