import { Elysia, t } from "elysia";

import { requireAdmin } from "../lib/admin";
import { getAdminOverviewAnalytics } from "../lib/admin-analytics";
import { getAdminMe, searchAdminUsers, setUserSuspended } from "../lib/admin-users";
import { listAdminDisputes, markDisputeUnderReview, resolveAdminDispute } from "../lib/disputes";
import { runGuardedAction } from "../lib/http";
import {
  approveVerification,
  listPendingVerifications,
  rejectVerification,
} from "../lib/verification-admin";
import { COOKIE_AUTH_SECURITY } from "../lib/openapi-tags";
import { betterAuthPlugin } from "../plugins/auth";

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
    "/me",
    async ({ user }) => {
      return getAdminMe(user.id);
    },
    {
      auth: true,
      detail: {
        summary: "Admin session flags",
        description: "Returns whether the current user is a platform admin and suspension state.",
      },
    },
  )
  .get(
    "/overview",
    async ({ user, status }) => {
      const result = await runAdminAction(user.id, () => getAdminOverviewAnalytics());
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      detail: { summary: "Platform overview analytics" },
    },
  )
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
  )
  .get(
    "/disputes",
    async ({ user, query, status }) => {
      const result = await runAdminAction(user.id, () =>
        listAdminDisputes({
          page: query.page,
          limit: query.limit,
          status: query.status,
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
          t.Union([t.Literal("open"), t.Literal("under_review"), t.Literal("all")]),
        ),
      }),
      detail: { summary: "List open disputes for mediation" },
    },
  )
  .post(
    "/disputes/:id/under-review",
    async ({ user, params, status }) => {
      const result = await runAdminAction(user.id, () => markDisputeUnderReview(params.id));
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ id: t.String() }),
      detail: { summary: "Mark dispute under review" },
    },
  )
  .post(
    "/disputes/:id/resolve",
    async ({ user, params, body, status }) => {
      const result = await runAdminAction(user.id, () =>
        resolveAdminDispute(params.id, user.id, body),
      );
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ id: t.String() }),
      body: t.Object({
        resolutionStatus: t.Union([
          t.Literal("resolved_client"),
          t.Literal("resolved_freelancer"),
          t.Literal("closed"),
        ]),
        resolution: t.String({ minLength: 10 }),
        restoreContractStatus: t.Optional(
          t.Union([
            t.Literal("active"),
            t.Literal("paused"),
            t.Literal("cancelled"),
            t.Literal("completed"),
          ]),
        ),
      }),
      detail: { summary: "Resolve a dispute" },
    },
  )
  .get(
    "/users/search",
    async ({ user, query, status }) => {
      const result = await runAdminAction(user.id, () => searchAdminUsers(query.q));
      if (!result.ok) return status(result.status, result.body);
      return { items: result.data };
    },
    {
      auth: true,
      query: t.Object({
        q: t.String({ minLength: 2 }),
      }),
      detail: { summary: "Search users by name or email" },
    },
  )
  .post(
    "/users/:id/suspend",
    async ({ user, params, body, status }) => {
      const result = await runAdminAction(user.id, () =>
        setUserSuspended(params.id, user.id, { suspended: true, reason: body.reason }),
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
      detail: { summary: "Suspend a user account" },
    },
  )
  .post(
    "/users/:id/unsuspend",
    async ({ user, params, status }) => {
      const result = await runAdminAction(user.id, () =>
        setUserSuspended(params.id, user.id, { suspended: false }),
      );
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ id: t.String() }),
      detail: { summary: "Reinstate a suspended user" },
    },
  );
