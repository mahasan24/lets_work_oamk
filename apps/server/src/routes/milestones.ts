import { Elysia, t } from "elysia";

import {
  approveContractMilestone,
  createContractMilestone,
  deleteContractMilestone,
  listContractMilestones,
  requestContractMilestoneRevision,
  startContractMilestone,
  submitContractMilestone,
  updateContractMilestone,
} from "../lib/milestones";
import { runAction as runMilestoneAction } from "../lib/http";
import { COOKIE_AUTH_SECURITY } from "../lib/openapi-tags";
import { betterAuthPlugin } from "../plugins/auth";

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
    "/:id/milestones",
    async ({ user, params, status }) => {
      const result = await runMilestoneAction(() => listContractMilestones(params.id, user.id));
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ id: t.String() }),
      detail: { summary: "List contract milestones" },
    },
  )
  .post(
    "/:id/milestones",
    async ({ user, params, body, status }) => {
      const result = await runMilestoneAction(() =>
        createContractMilestone(params.id, user.id, body),
      );
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ id: t.String() }),
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
