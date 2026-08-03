import { Elysia, t } from "elysia";

import { runAction } from "../lib/http";
import {
  createContractReview,
  listContractReviews,
  listPublicReviewsForUser,
} from "../lib/reviews";
import { COOKIE_AUTH_SECURITY } from "../lib/openapi-tags";
import { betterAuthPlugin } from "../plugins/auth";

export const contractReviewRoutes = new Elysia({
  prefix: "/api/contracts",
  detail: {
    tags: ["Reviews"],
    security: COOKIE_AUTH_SECURITY,
  },
})
  .use(betterAuthPlugin)
  .get(
    "/:id/reviews",
    async ({ user, params, status }) => {
      const result = await runAction(() => listContractReviews(params.id, user.id));
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ id: t.String() }),
      detail: {
        summary: "List reviews for a contract",
        description: "Returns both parties' reviews and whether the caller can still leave one.",
      },
    },
  )
  .post(
    "/:id/reviews",
    async ({ user, params, body, status }) => {
      const result = await runAction(() => createContractReview(params.id, user.id, body));
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ id: t.String() }),
      body: t.Object({
        rating: t.Number({ minimum: 1, maximum: 5 }),
        comment: t.Optional(t.Union([t.String({ maxLength: 2000 }), t.Null()])),
        isPublic: t.Optional(t.Boolean()),
      }),
      detail: {
        summary: "Leave a review on a completed contract",
      },
    },
  );

export const publicReviewRoutes = new Elysia({
  prefix: "/api/freelancers",
  detail: {
    tags: ["Reviews"],
  },
}).get(
  "/:id/reviews",
  async ({ params, query, status }) => {
    const result = await runAction(() =>
      listPublicReviewsForUser(params.id, { page: query.page, limit: query.limit }),
    );
    if (!result.ok) return status(result.status, result.body);
    return result.data;
  },
  {
    params: t.Object({ id: t.String() }),
    query: t.Object({
      page: t.Optional(t.Numeric()),
      limit: t.Optional(t.Numeric()),
    }),
    detail: {
      summary: "List public reviews for a freelancer",
    },
  },
);
