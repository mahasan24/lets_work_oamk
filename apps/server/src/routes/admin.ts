import { Elysia, t } from "elysia";

import { AdminForbiddenError, requireAdmin } from "../lib/admin";
import {
  approveVerification,
  listPendingVerifications,
  rejectVerification,
  VerificationNotFoundError,
} from "../lib/verification-admin";
import { betterAuthPlugin } from "../plugins/auth";
import { COOKIE_AUTH_SECURITY } from "../lib/openapi-tags";

type ErrorResponse = { status: number; body: { error: string } };

function handleAdminError(error: unknown): ErrorResponse | null {
  if (error instanceof AdminForbiddenError) {
    return { status: 403, body: { error: error.message } };
  }
  if (error instanceof VerificationNotFoundError) {
    return { status: 404, body: { error: error.message } };
  }
  if (error instanceof Error) {
    return { status: 409, body: { error: error.message } };
  }
  return null;
}

async function runAdminAction<T>(userId: string, action: () => Promise<T>) {
  try {
    await requireAdmin(userId);
    return { ok: true as const, data: await action() };
  } catch (error) {
    const mapped = handleAdminError(error);
    if (mapped) {
      return { ok: false as const, status: mapped.status, body: mapped.body };
    }
    throw error;
  }
}

export const adminRoutes = new Elysia({
  prefix: "/api/admin",
  detail: {
    tags: ["Admin"],
    security: COOKIE_AUTH_SECURITY,
  },
})
  .use(betterAuthPlugin)
  .get(
    "/verifications",
    async ({ user, status }) => {
      const result = await runAdminAction(user.id, () => listPendingVerifications());
      if (!result.ok) return status(result.status, result.body);
      return { items: result.data };
    },
    {
      auth: true,
      detail: {
        summary: "List pending identity verifications",
        description: "Admin-only queue of users awaiting identity review.",
      },
    },
  )
  .post(
    "/verifications/:id/approve",
    async ({ user, params, status }) => {
      const result = await runAdminAction(user.id, () => approveVerification(params.id));
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ id: t.String() }),
      detail: { summary: "Approve identity verification" },
    },
  )
  .post(
    "/verifications/:id/reject",
    async ({ user, params, body, status }) => {
      const result = await runAdminAction(user.id, () =>
        rejectVerification(params.id, body.reason),
      );
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ id: t.String() }),
      body: t.Object({
        reason: t.Optional(t.String()),
      }),
      detail: { summary: "Reject identity verification" },
    },
  );
