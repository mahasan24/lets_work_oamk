import { auth } from "@lets_work/auth";
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
import { JOB_CATEGORY_SUGGESTIONS, mergeJobCategories, SUPPORTED_CURRENCIES } from "../lib/job-constants";
import {
  cancelHirerJob,
  closeHirerJob,
  createHirerJob,
  deleteHirerJob,
  fillHirerJob,
  getHirerJob,
  getHirerJobPublishReadiness,
  getPublicJobBySlug,
  listHirerJobs,
  listPublicJobs,
  pauseHirerJob,
  publishHirerJob,
  resumeHirerJob,
  startReviewHirerJob,
  updateHirerJob,
} from "../lib/jobs";
import { ensureProfile } from "../lib/profile";
import { betterAuthPlugin } from "../plugins/auth";
import { COOKIE_AUTH_SECURITY } from "../lib/openapi-tags";

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

export const jobRoutes = new Elysia({
  prefix: "/api/jobs",
  detail: {
    tags: ["Jobs"],
  },
})
  .get(
    "/categories",
    async ({ request }) => {
      const session = await auth.api.getSession({ headers: request.headers });
      let categories: string[] = [...JOB_CATEGORY_SUGGESTIONS];

      if (session?.user) {
        const profile = await ensureProfile(session.user.id);
        categories = mergeJobCategories(
          Array.isArray(profile.jobCategories) ? profile.jobCategories : [],
        );
      }

      return {
        categories,
        currencies: SUPPORTED_CURRENCIES,
      };
    },
    {
      detail: {
        summary: "List job categories and currencies",
        description:
          "Reference data for job posting forms. Merges hirer profile categories when authenticated.",
      },
    },
  )
  .get(
    "/",
    async ({ query, status }) => {
      const result = await runPublicAction(() =>
        listPublicJobs({
          search: query.search,
          category: query.category,
          experienceLevel: query.experienceLevel,
          budgetType: query.budgetType,
          minBudget: query.minBudget,
          maxBudget: query.maxBudget,
          postedWithin: query.postedWithin,
          remoteOnly: query.remoteOnly,
          sort: query.sort,
          page: query.page,
          limit: query.limit,
        }),
      );
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      query: t.Object({
        search: t.Optional(t.String()),
        category: t.Optional(t.String()),
        experienceLevel: t.Optional(
          t.Union([t.Literal("entry"), t.Literal("intermediate"), t.Literal("expert")]),
        ),
        budgetType: t.Optional(t.Union([t.Literal("hourly"), t.Literal("one_time")])),
        minBudget: t.Optional(t.String()),
        maxBudget: t.Optional(t.String()),
        postedWithin: t.Optional(
          t.Union([t.Literal("24h"), t.Literal("7d"), t.Literal("30d")]),
        ),
        remoteOnly: t.Optional(t.Boolean()),
        sort: t.Optional(t.Union([t.Literal("newest"), t.Literal("budget_high")])),
        page: t.Optional(t.Numeric()),
        limit: t.Optional(t.Numeric()),
      }),
      detail: {
        summary: "Browse open jobs",
        description:
          "Public job feed for freelancers with search, category, budget, experience, and date filters.",
      },
    },
  )
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
      detail: {
        summary: "Get published job by slug",
        description: "Returns a single open or in-review job for public viewing.",
      },
    },
  );

export const hirerJobRoutes = new Elysia({
  prefix: "/api/hirer/jobs",
  detail: {
    tags: ["Hirer Jobs"],
    security: COOKIE_AUTH_SECURITY,
  },
})
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
    { auth: true, detail: { summary: "Sign job attachment upload" } },
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
            t.Literal("in_review"),
            t.Literal("filled"),
            t.Literal("closed"),
            t.Literal("cancelled"),
            t.Literal("paused"),
          ]),
        ),
        search: t.Optional(t.String()),
        page: t.Optional(t.Numeric()),
        limit: t.Optional(t.Numeric()),
      }),
      detail: {
        summary: "List hirer jobs",
        description: "Paginated list of jobs owned by the authenticated hirer.",
      },
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
      detail: { summary: "Get hirer job by ID" },
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
      detail: {
        summary: "Check publish readiness",
        description: "Returns validation errors that must be resolved before publishing.",
      },
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
      detail: { summary: "Create job draft" },
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
      detail: { summary: "Update job" },
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
      detail: { summary: "Delete draft job" },
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
      detail: { summary: "Publish job", description: "Moves a draft job to open status." },
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
      detail: { summary: "Pause open job" },
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
      detail: { summary: "Resume paused job" },
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
      detail: { summary: "Close job" },
    },
  )
  .post(
    "/:id/review",
    async ({ user, params, status }) => {
      const result = await runHirerAction(user.id, () =>
        startReviewHirerJob(params.id, user.id),
      );
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ id: t.String() }),
      detail: { summary: "Start reviewing proposals", description: "Moves an open job to in review." },
    },
  )
  .post(
    "/:id/fill",
    async ({ user, params, status }) => {
      const result = await runHirerAction(user.id, () => fillHirerJob(params.id, user.id));
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ id: t.String() }),
      detail: { summary: "Mark job as filled" },
    },
  )
  .post(
    "/:id/cancel",
    async ({ user, params, status }) => {
      const result = await runHirerAction(user.id, () => cancelHirerJob(params.id, user.id));
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ id: t.String() }),
      detail: { summary: "Cancel job" },
    },
  );
