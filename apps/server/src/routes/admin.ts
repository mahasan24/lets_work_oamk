import { Elysia, t } from "elysia";

import { requireAdmin } from "../lib/admin";
import {
  approveVerification,
  listPendingVerifications,
  rejectVerification,
} from "../lib/verification-admin";
import { runGuardedAction } from "../lib/http";
import { betterAuthPlugin } from "../plugins/auth";
import { COOKIE_AUTH_SECURITY } from "../lib/openapi-tags";

const runAdminAction = <T>(userId: string, action: () => Promise<T>) =>
  runGuardedAction(() => requireAdmin(userId), action);

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
