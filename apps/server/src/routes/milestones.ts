import { Elysia, t } from "elysia";

import {
  ContractForbiddenError,
  ContractNotFoundError,
  ContractStatusError,
} from "../lib/contracts";
import {
  approveContractMilestone,
  createContractMilestone,
  deleteContractMilestone,
  listContractMilestones,
  MilestoneForbiddenError,
  MilestoneNotFoundError,
  MilestoneStatusError,
  MilestoneValidationError,
  requestContractMilestoneRevision,
  startContractMilestone,
  submitContractMilestone,
  updateContractMilestone,
} from "../lib/milestones";
import { COOKIE_AUTH_SECURITY } from "../lib/openapi-tags";
import { betterAuthPlugin } from "../plugins/auth";

type ErrorResponse = { status: number; body: { error: string } };

function handleMilestoneError(error: unknown): ErrorResponse | null {
  if (error instanceof ContractNotFoundError || error instanceof MilestoneNotFoundError) {
    return { status: 404, body: { error: error.message } };
  }
  if (error instanceof ContractForbiddenError || error instanceof MilestoneForbiddenError) {
    return { status: 403, body: { error: error.message } };
  }
  if (
    error instanceof ContractStatusError ||
    error instanceof MilestoneStatusError ||
    error instanceof MilestoneValidationError
  ) {
    return { status: 400, body: { error: error.message } };
  }
  return null;
}

async function runMilestoneAction<T>(action: () => Promise<T>) {
  try {
    return { ok: true as const, data: await action() };
  } catch (error) {
    const mapped = handleMilestoneError(error);
    if (mapped) {
      return { ok: false as const, status: mapped.status, body: mapped.body };
    }
    throw error;
  }
}

const milestoneBody = t.Object({
  title: t.String({ minLength: 1 }),
  description: t.Optional(t.String()),
  amount: t.String({ minLength: 1 }),
  dueDate: t.Optional(t.String()),
  sortOrder: t.Optional(t.Numeric()),
});

const milestoneUpdateBody = t.Object({
  title: t.Optional(t.String({ minLength: 1 })),
  description: t.Optional(t.String()),
  amount: t.Optional(t.String({ minLength: 1 })),
  dueDate: t.Optional(t.String()),
  sortOrder: t.Optional(t.Numeric()),
});

export const contractMilestoneRoutes = new Elysia({
  prefix: "/api/contracts",
  detail: {
    tags: ["Milestones"],
    security: COOKIE_AUTH_SECURITY,
  },
})
  .use(betterAuthPlugin)
  .get(
    "/:contractId/milestones",
    async ({ user, params, status }) => {
      const result = await runMilestoneAction(() =>
        listContractMilestones(params.contractId, user.id),
      );
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ contractId: t.String() }),
      detail: { summary: "List contract milestones" },
    },
  )
  .post(
    "/:contractId/milestones",
    async ({ user, params, body, status }) => {
      const result = await runMilestoneAction(() =>
        createContractMilestone(params.contractId, user.id, body),
      );
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ contractId: t.String() }),
      body: milestoneBody,
      detail: { summary: "Create a contract milestone" },
    },
  );

export const milestoneActionRoutes = new Elysia({
  prefix: "/api/milestones",
  detail: {
    tags: ["Milestones"],
    security: COOKIE_AUTH_SECURITY,
  },
})
  .use(betterAuthPlugin)
  .patch(
    "/:id",
    async ({ user, params, body, status }) => {
      const result = await runMilestoneAction(() =>
        updateContractMilestone(params.id, user.id, body),
      );
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ id: t.String() }),
      body: milestoneUpdateBody,
      detail: { summary: "Update a pending milestone" },
    },
  )
  .delete(
    "/:id",
    async ({ user, params, status }) => {
      const result = await runMilestoneAction(() => deleteContractMilestone(params.id, user.id));
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ id: t.String() }),
      detail: { summary: "Delete a pending milestone" },
    },
  )
  .post(
    "/:id/start",
    async ({ user, params, status }) => {
      const result = await runMilestoneAction(() => startContractMilestone(params.id, user.id));
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ id: t.String() }),
      detail: { summary: "Start working on a milestone" },
    },
  )
  .post(
    "/:id/submit",
    async ({ user, params, body, status }) => {
      const result = await runMilestoneAction(() =>
        submitContractMilestone(params.id, user.id, body),
      );
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ id: t.String() }),
      body: t.Object({
        note: t.Optional(t.String()),
        attachmentUrl: t.Optional(t.String()),
      }),
      detail: { summary: "Submit milestone deliverables" },
    },
  )
  .post(
    "/:id/approve",
    async ({ user, params, status }) => {
      const result = await runMilestoneAction(() => approveContractMilestone(params.id, user.id));
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ id: t.String() }),
      detail: { summary: "Approve a submitted milestone" },
    },
  )
  .post(
    "/:id/request-revision",
    async ({ user, params, body, status }) => {
      const result = await runMilestoneAction(() =>
        requestContractMilestoneRevision(params.id, user.id, body),
      );
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ id: t.String() }),
      body: t.Object({
        note: t.String({ minLength: 1 }),
      }),
      detail: { summary: "Request milestone revisions" },
    },
  );
