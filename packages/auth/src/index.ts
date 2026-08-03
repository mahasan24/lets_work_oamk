import { createDb } from "@lets_work/db";
import * as schema from "@lets_work/db/schema/auth";
import { env } from "@lets_work/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { openAPI } from "better-auth/plugins";

import { sendEmailVerificationEmail, sendPasswordResetEmail } from "./lib/mail";
import { createRedisSecondaryStorage } from "./lib/redis";

const isProduction = env.NODE_ENV === "production";

const googleAuth =
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? {
        socialProviders: {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
            prompt: "select_account" as const,
          },
        },
      }
    : {};

export function createAuth() {
  const db = createDb();

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: schema,
    }),
    secondaryStorage: createRedisSecondaryStorage(),
    trustedOrigins: [env.CORS_ORIGIN],
    ...googleAuth,
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        void sendPasswordResetEmail({
          to: user.email,
          name: user.name,
          url,
        }).catch((error) => {
          console.error("Failed to send password reset email:", error);
        });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        void sendEmailVerificationEmail({
          to: user.email,
          name: user.name,
          url,
        }).catch((error) => {
          console.error("Failed to send verification email:", error);
        });
      },
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
      storage: "secondary-storage",
      customRules: {
        "/sign-in/email": {
          window: 60,
          max: 10,
        },
        "/sign-up/email": {
          window: 60,
          max: 5,
        },
        "/request-password-reset": {
          window: 60,
          max: 5,
        },
        "/forget-password": {
          window: 60,
          max: 5,
        },
        "/send-verification-email": {
          window: 60,
          max: 5,
        },
      },
    },
    session: {
      storeSessionInDatabase: true,
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    plugins: [openAPI()],
    advanced: {
      defaultCookieAttributes: {
        sameSite: isProduction ? "none" : "lax",
        secure: isProduction,
        httpOnly: true,
      },
    },
  });
}

export { stripeClient } from "./lib/stripe";
export { getRedis } from "./lib/redis";
export { sendEmail, sendEmailVerificationEmail, sendPasswordResetEmail } from "./lib/mail";
export const auth = createAuth();
