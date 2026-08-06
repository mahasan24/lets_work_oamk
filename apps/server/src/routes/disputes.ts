import { Elysia, t } from "elysia";

import { runAction } from "../lib/http";
import {
  getActiveDisputeForContract,
  getDisputeForUser,
  listDisputesForUser,
} from "../lib/disputes";
import { COOKIE_AUTH_SECURITY } from "../lib/openapi-tags";
import { betterAuthPlugin } from "../plugins/auth";

const disputeStatusSchema = t.Union([
  t.Literal("open"),
  t.Literal("under_review"),
  t.Literal("resolved_client"),
  t.Literal("resolved_freelancer"),
  t.Literal("closed"),
]);

export const disputeRoutes = new Elysia({
  prefix: "/api/disputes",
  detail: {
    tags: ["Disputes"],
    security: COOKIE_AUTH_SECURITY,
  },
})
  .use(betterAuthPlugin)
  .get(
    "/",
    async ({ user, query, status }) => {
      const result = await runAction(() =>
        listDisputesForUser(user.id, {
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
        status: t.Optional(disputeStatusSchema),
      }),
      detail: { summary: "List disputes for the current user" },
    },
  )
  .get(
    "/by-contract/:contractId",
    async ({ user, params, status }) => {
      const result = await runAction(() => getActiveDisputeForContract(params.contractId, user.id));
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ contractId: t.String() }),
      detail: { summary: "Get the active dispute for a contract, if any" },
    },
  )
  .get(
    "/:disputeId",
    async ({ user, params, status }) => {
      const result = await runAction(() => getDisputeForUser(params.disputeId, user.id));
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ disputeId: t.String() }),
      detail: { summary: "Get dispute details" },
    },
  );
