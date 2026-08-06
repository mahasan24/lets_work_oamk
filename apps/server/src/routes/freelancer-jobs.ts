import { Elysia, t } from "elysia";

import {
  listFreelancerJobFeed,
  listFreelancerProposals,
  saveJobForFreelancer,
  unsaveJobForFreelancer,
} from "../lib/freelancer-jobs";
import { getAiJobRecommendations } from "../lib/ai-job-match";
import { requireFreelancerProfile } from "../lib/freelancer";
import { runGuardedAction } from "../lib/http";
import { COOKIE_AUTH_SECURITY } from "../lib/openapi-tags";
import { betterAuthPlugin } from "../plugins/auth";

const runFeedAction = <T>(userId: string, action: () => Promise<T>) =>
  runGuardedAction(() => requireFreelancerProfile(userId), action);

/** Query values arrive as strings; repeated keys arrive as arrays. */
function toStringArray(value: string | string[] | undefined) {
  if (!value) return undefined;
  const values = Array.isArray(value) ? value : value.split(",");
  const normalized = values.map((item) => item.trim()).filter(Boolean);
  return normalized.length > 0 ? normalized : undefined;
}

function toNumber(value: string | undefined) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export const freelancerJobFeedRoutes = new Elysia({
  prefix: "/api/freelancer",
  detail: {
    tags: ["Freelancer Jobs"],
    security: COOKIE_AUTH_SECURITY,
  },
})
  .use(betterAuthPlugin)
  .get(
    "/job-feed",
    async ({ user, query, status }) => {
      const result = await runFeedAction(user.id, () =>
        listFreelancerJobFeed(user.id, {
          tab: query.tab,
          search: query.search,
          category: query.category,
          skills: toStringArray(query.skills),
          experienceLevel: query.experienceLevel,
          budgetType: query.budgetType,
          minBudget: query.minBudget,
          maxBudget: query.maxBudget,
          postedWithin: query.postedWithin,
          remoteOnly: query.remoteOnly === "true",
          page: toNumber(query.page),
          limit: toNumber(query.limit),
        }),
      );
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      query: t.Object({
        tab: t.Optional(
          t.Union([t.Literal("best_match"), t.Literal("newest"), t.Literal("saved")]),
        ),
        search: t.Optional(t.String()),
        category: t.Optional(t.String()),
        skills: t.Optional(t.Union([t.String(), t.Array(t.String())])),
        experienceLevel: t.Optional(
          t.Union([t.Literal("entry"), t.Literal("intermediate"), t.Literal("expert")]),
        ),
        budgetType: t.Optional(t.Union([t.Literal("hourly"), t.Literal("one_time")])),
        minBudget: t.Optional(t.String()),
        maxBudget: t.Optional(t.String()),
        postedWithin: t.Optional(t.Union([t.Literal("24h"), t.Literal("7d"), t.Literal("30d")])),
        remoteOnly: t.Optional(t.String()),
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
      detail: {
        summary: "Freelancer job feed",
        description:
          "Open jobs ranked against the freelancer's profile skills, with applied and saved state.",
      },
    },
  )
  .get(
    "/proposals",
    async ({ user, query, status }) => {
      const result = await runFeedAction(user.id, () =>
        listFreelancerProposals(user.id, {
          status: query.status,
          page: toNumber(query.page),
          limit: toNumber(query.limit),
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
            t.Literal("submitted"),
            t.Literal("shortlisted"),
            t.Literal("accepted"),
            t.Literal("rejected"),
            t.Literal("withdrawn"),
          ]),
        ),
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
      detail: { summary: "List my proposals" },
    },
  )
  .post(
    "/job-recommendations",
    async ({ user, body, status }) => {
      const result = await runFeedAction(user.id, () =>
        getAiJobRecommendations(user.id, { limit: body?.limit }),
      );
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      body: t.Optional(
        t.Object({
          limit: t.Optional(t.Numeric({ minimum: 1, maximum: 12 })),
        }),
      ),
      detail: {
        summary: "AI job recommendations",
        description:
          "Re-ranks top skill-matched open jobs with Gemini and returns short fit reasons.",
      },
    },
  )
  .post(
    "/saved-jobs/:jobId",
    async ({ user, params, status }) => {
      const result = await runFeedAction(user.id, () =>
        saveJobForFreelancer(user.id, params.jobId),
      );
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ jobId: t.String() }),
      detail: { summary: "Save a job" },
    },
  )
  .delete(
    "/saved-jobs/:jobId",
    async ({ user, params, status }) => {
      const result = await runFeedAction(user.id, () =>
        unsaveJobForFreelancer(user.id, params.jobId),
      );
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ jobId: t.String() }),
      detail: { summary: "Remove a saved job" },
    },
  );
