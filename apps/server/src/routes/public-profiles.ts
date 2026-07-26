import { Elysia, t } from "elysia";

import {
  getPublicClientProfile,
  getPublicFreelancerProfile,
  searchFreelancers,
} from "../lib/public-profiles";
import { runAction as runPublicProfileAction } from "../lib/http";

/**
 * `skills` arrives as a repeated query param, which Elysia surfaces as a string
 * when only one value is present.
 */
function toSkillList(value: string | string[] | undefined) {
  if (!value) return undefined;
  return Array.isArray(value) ? value : [value];
}

export const freelancerDirectoryRoutes = new Elysia({
  prefix: "/api/freelancers",
  detail: {
    tags: ["Public Profiles"],
  },
})
  .get(
    "/",
    async ({ query, status }) => {
      const result = await runPublicProfileAction(() =>
        searchFreelancers({
          search: query.search,
          skills: toSkillList(query.skills),
          country: query.country,
          availability: query.availability,
          minRate: query.minRate,
          maxRate: query.maxRate,
          minRating: query.minRating,
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
        skills: t.Optional(t.Union([t.String(), t.Array(t.String())])),
        country: t.Optional(t.String()),
        availability: t.Optional(
          t.Union([t.Literal("available"), t.Literal("limited"), t.Literal("unavailable")]),
        ),
        minRate: t.Optional(t.String()),
        maxRate: t.Optional(t.String()),
        minRating: t.Optional(t.String()),
        sort: t.Optional(
          t.Union([
            t.Literal("recommended"),
            t.Literal("rating"),
            t.Literal("rate_low"),
            t.Literal("rate_high"),
            t.Literal("newest"),
          ]),
        ),
        page: t.Optional(t.Numeric()),
        limit: t.Optional(t.Numeric()),
      }),
      detail: {
        summary: "Search freelancers",
        description:
          "Public freelancer directory with search, skill, country, rate, rating, and availability filters.",
      },
    },
  )
  .get(
    "/:id",
    async ({ params, status }) => {
      const result = await runPublicProfileAction(() => getPublicFreelancerProfile(params.id));
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      params: t.Object({ id: t.String() }),
      detail: {
        summary: "Get public freelancer profile",
        description: "Public profile with portfolio, certifications, and work history.",
      },
    },
  );

export const clientDirectoryRoutes = new Elysia({
  prefix: "/api/clients",
  detail: {
    tags: ["Public Profiles"],
  },
}).get(
  "/:id",
  async ({ params, status }) => {
    const result = await runPublicProfileAction(() => getPublicClientProfile(params.id));
    if (!result.ok) return status(result.status, result.body);
    return result.data;
  },
  {
    params: t.Object({ id: t.String() }),
    detail: {
      summary: "Get public client profile",
      description: "Public hirer profile with company details and open job count.",
    },
  },
);
