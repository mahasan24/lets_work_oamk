import { Elysia, t } from "elysia";

import { listContractTimeline } from "../lib/contract-events";
import { getContractProgressSummary } from "../lib/contract-progress";
import {
  cancelUserContract,
  completeUserContract,
  disputeUserContract,
  getUserContract,
  listUserContracts,
  pauseUserContract,
  resumeUserContract,
} from "../lib/contracts";
import { runAction as runContractAction } from "../lib/http";
import { COOKIE_AUTH_SECURITY } from "../lib/openapi-tags";
import { betterAuthPlugin } from "../plugins/auth";

const contractStatusSchema = t.Union([
  t.Literal("draft"),
  t.Literal("active"),
  t.Literal("paused"),
  t.Literal("completed"),
  t.Literal("cancelled"),
  t.Literal("disputed"),
]);

export const contractRoutes = new Elysia({
  prefix: "/api/contracts",
  detail: {
    tags: ["Contracts"],
    security: COOKIE_AUTH_SECURITY,
  },
})
  .use(betterAuthPlugin)
  .get(
    "/progress-summary",
    async ({ user, query, status }) => {
      const result = await runContractAction(() =>
        getContractProgressSummary(user.id, { role: query.role }),
      );
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      query: t.Object({
        role: t.Optional(t.Union([t.Literal("hirer"), t.Literal("freelancer")])),
      }),
      detail: {
        summary: "Contract progress summary",
        description: "Overdue milestones, completion stats, and active contract progress.",
      },
    },
  )
  .get(
    "/",
    async ({ user, query, status }) => {
      const result = await runContractAction(() =>
        listUserContracts(user.id, {
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
        status: t.Optional(contractStatusSchema),
        role: t.Optional(t.Union([t.Literal("hirer"), t.Literal("freelancer")])),
      }),
      detail: {
        summary: "List contracts",
        description: "List contracts where the authenticated user is hirer or freelancer.",
      },
    },
  )
  .get(
    "/:id/timeline",
    async ({ user, params, status }) => {
      const result = await runContractAction(() => listContractTimeline(params.id, user.id));
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ id: t.String() }),
      detail: { summary: "Get contract timeline" },
    },
  )
  .get(
    "/:id",
    async ({ user, params, status }) => {
      const result = await runContractAction(() => getUserContract(params.id, user.id));
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ id: t.String() }),
      detail: { summary: "Get contract details" },
    },
  )
  .post(
    "/:id/pause",
    async ({ user, params, status }) => {
      const result = await runContractAction(() => pauseUserContract(params.id, user.id));
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ id: t.String() }),
      detail: { summary: "Pause an active contract" },
    },
  )
  .post(
    "/:id/resume",
    async ({ user, params, status }) => {
      const result = await runContractAction(() => resumeUserContract(params.id, user.id));
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ id: t.String() }),
      detail: { summary: "Resume a paused contract" },
    },
  )
  .post(
    "/:id/dispute",
    async ({ user, params, body, status }) => {
      const result = await runContractAction(() => disputeUserContract(params.id, user.id, body));
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ id: t.String() }),
      body: t.Object({
        reason: t.String({ minLength: 5 }),
        description: t.String({ minLength: 20 }),
        milestoneId: t.Optional(t.Nullable(t.String())),
      }),
      detail: { summary: "Open a contract dispute" },
    },
  )
  .post(
    "/:id/complete",
    async ({ user, params, status }) => {
      const result = await runContractAction(() => completeUserContract(params.id, user.id));
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ id: t.String() }),
      detail: {
        summary: "Complete a contract",
        description: "Mark an active contract as completed.",
      },
    },
  )
  .post(
    "/:id/cancel",
    async ({ user, params, status }) => {
      const result = await runContractAction(() => cancelUserContract(params.id, user.id));
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ id: t.String() }),
      detail: {
        summary: "Cancel a contract",
        description: "Hirer cancels a draft or active contract.",
      },
    },
  );
