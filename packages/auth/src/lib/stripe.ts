import Stripe from "stripe";

import { env } from "@lets_work/env/server";

export const stripeClient = new Stripe(env.STRIPE_SECRET_KEY);
