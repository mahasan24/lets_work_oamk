import { createUploadSignature } from "@lets_work/media";
import { Elysia, t } from "elysia";

import {
  HirerAccessError,
  JobForbiddenError,
  JobNotFoundError,
  JobStatusError,
  JobValidationError,
  requireHirerProfile,
} from "../lib/hirer";
import { JOB_CATEGORY_SUGGESTIONS, SUPPORTED_CURRENCIES } from "../lib/job-constants";
import {
  closeHirerJob,
  createHirerJob,
  deleteHirerJob,
  getHirerJob,
  getHirerJobPublishReadiness,
  getPublicJobBySlug,
  listHirerJobs,
  pauseHirerJob,
  publishHirerJob,
  resumeHirerJob,
  updateHirerJob,
} from "../lib/jobs";
import { betterAuthPlugin } from "../plugins/auth";

const jobAttachmentSchema = t.Object({
  id: t.Optional(t.String()),
  url: t.String(),
  fileName: t.String(),
  mimeType: t.Optional(t.Nullable(t.String())),
});

const jobWriteSchema = t.Object({
  title: t.Optional(t.String()),
  description: t.Optional(t.String()),
  category: t.Optional(t.String()),
  requiredSkills: t.Optional(t.Array(t.String())),
  budgetType: t.Optional(t.Union([t.Literal("hourly"), t.Literal("one_time")])),
  budgetMin: t.Optional(t.Nullable(t.String())),
  budgetMax: t.Optional(t.Nullable(t.String())),
  hourlyRateMin: t.Optional(t.Nullable(t.String())),
  hourlyRateMax: t.Optional(t.Nullable(t.String())),
  remoteOnly: t.Optional(t.Boolean()),
  country: t.Optional(t.Nullable(t.String())),
  currency: t.Optional(t.String()),
  experienceLevel: t.Optional(
    t.Nullable(
      t.Union([t.Literal("entry"), t.Literal("intermediate"), t.Literal("expert")]),
    ),
  ),
  estimatedDuration: t.Optional(
    t.Nullable(
      t.Union([
        t.Literal("less_than_month"),
        t.Literal("one_to_three_months"),
        t.Literal("three_to_six_months"),
        t.Literal("more_than_six_months"),
      ]),
    ),
  ),
  weeklyHours: t.Optional(t.Nullable(t.Number())),
  preferredTimezone: t.Optional(t.Nullable(t.String())),
  tags: t.Optional(t.Array(t.String())),
  attachments: t.Optional(t.Array(jobAttachmentSchema)),
});

type ErrorResponse = { status: number; body: { error: string; errors?: string[] } };

function handleJobError(error: unknown): ErrorResponse | null {
  if (error instanceof HirerAccessError) {
    return { status: 403, body: { error: error.message } };
  }
  if (error instanceof JobNotFoundError) {
    return { status: 404, body: { error: error.message } };
  }
  if (error instanceof JobForbiddenError) {
    return { status: 403, body: { error: error.message } };
  }
  if (error instanceof JobValidationError) {
    return { status: 422, body: { error: error.message, errors: error.errors } };
  }
  if (error instanceof JobStatusError) {
    return { status: 409, body: { error: error.message } };
  }
  return null;
}

async function runHirerAction<T>(userId: string, action: () => Promise<T>) {
  try {
    await requireHirerProfile(userId);
    return { ok: true as const, data: await action() };
  } catch (error) {
    const mapped = handleJobError(error);
    if (mapped) {
      return { ok: false as const, status: mapped.status, body: mapped.body };
    }
    throw error;
  }
}

async function runPublicAction<T>(action: () => Promise<T>) {
  try {
    return { ok: true as const, data: await action() };
  } catch (error) {
    const mapped = handleJobError(error);
    if (mapped) {
      return { ok: false as const, status: mapped.status, body: mapped.body };
    }
    throw error;
  }
}

export const jobRoutes = new Elysia({ prefix: "/api/jobs" })
  .get("/categories", () => ({
    categories: JOB_CATEGORY_SUGGESTIONS,
    currencies: SUPPORTED_CURRENCIES,
  }))
  .get(
    "/public/:slug",
    async ({ params, status }) => {
      const result = await runPublicAction(() => getPublicJobBySlug(params.slug));
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      params: t.Object({
        slug: t.String(),
      }),
    },
  );

export const hirerJobRoutes = new Elysia({ prefix: "/api/hirer/jobs" })
  .use(betterAuthPlugin)
  .get(
    "/uploads/sign",
    async ({ user, status }) => {
      const result = await runHirerAction(user.id, async () =>
        createUploadSignature("job-attachments"),
      );

      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    { auth: true },
  )
  .get(
    "/",
    async ({ user, query, status }) => {
      const result = await runHirerAction(user.id, () =>
        listHirerJobs(user.id, {
          status: query.status,
          search: query.search,
          page: query.page,
          limit: query.limit,
        }),
      );

      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      query: t.Object({
        status: t.Optional(
          t.Union([
            t.Literal("draft"),
            t.Literal("open"),
            t.Literal("closed"),
            t.Literal("paused"),
          ]),
        ),
        search: t.Optional(t.String()),
        page: t.Optional(t.Numeric()),
        limit: t.Optional(t.Numeric()),
      }),
    },
  )
  .get(
    "/:id",
    async ({ user, params, status }) => {
      const result = await runHirerAction(user.id, () => getHirerJob(params.id, user.id));
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ id: t.String() }),
    },
  )
  .get(
    "/:id/readiness",
    async ({ user, params, status }) => {
      const result = await runHirerAction(user.id, () =>
        getHirerJobPublishReadiness(params.id, user.id),
      );
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ id: t.String() }),
    },
  )
  .post(
    "/",
    async ({ user, body, status }) => {
      const result = await runHirerAction(user.id, () => createHirerJob(user.id, body));
      if (!result.ok) return status(result.status, result.body);
      return status(201, result.data);
    },
    {
      auth: true,
      body: jobWriteSchema,
    },
  )
  .patch(
    "/:id",
    async ({ user, params, body, status }) => {
      const result = await runHirerAction(user.id, () =>
        updateHirerJob(params.id, user.id, body),
      );
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ id: t.String() }),
      body: jobWriteSchema,
    },
  )
  .delete(
    "/:id",
    async ({ user, params, status }) => {
      const result = await runHirerAction(user.id, () => deleteHirerJob(params.id, user.id));
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ id: t.String() }),
    },
  )
  .post(
    "/:id/publish",
    async ({ user, params, status }) => {
      const result = await runHirerAction(user.id, () => publishHirerJob(params.id, user.id));
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ id: t.String() }),
    },
  )
  .post(
    "/:id/pause",
    async ({ user, params, status }) => {
      const result = await runHirerAction(user.id, () => pauseHirerJob(params.id, user.id));
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ id: t.String() }),
    },
  )
  .post(
    "/:id/resume",
    async ({ user, params, status }) => {
      const result = await runHirerAction(user.id, () => resumeHirerJob(params.id, user.id));
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ id: t.String() }),
    },
  )
  .post(
    "/:id/close",
    async ({ user, params, status }) => {
      const result = await runHirerAction(user.id, () => closeHirerJob(params.id, user.id));
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ id: t.String() }),
    },
  );
