import { Elysia, t } from "elysia";

import { runAction } from "../lib/http";
import { createReport, listReportsForUser } from "../lib/reports";
import { COOKIE_AUTH_SECURITY } from "../lib/openapi-tags";
import { betterAuthPlugin } from "../plugins/auth";

const reportTypeSchema = t.Union([
  t.Literal("spam"),
  t.Literal("fraud"),
  t.Literal("harassment"),
  t.Literal("abuse"),
  t.Literal("other"),
]);

const reportStatusSchema = t.Union([
  t.Literal("open"),
  t.Literal("under_review"),
  t.Literal("resolved"),
  t.Literal("dismissed"),
]);

export const reportRoutes = new Elysia({
  prefix: "/api/reports",
  detail: {
    tags: ["Reports"],
    security: COOKIE_AUTH_SECURITY,
  },
})
  .use(betterAuthPlugin)
  .get(
    "/",
    async ({ user, query, status }) => {
      const result = await runAction(() =>
        listReportsForUser(user.id, {
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
        status: t.Optional(reportStatusSchema),
      }),
      detail: { summary: "List reports filed by the current user" },
    },
  )
  .post(
    "/",
    async ({ user, body, status }) => {
      const result = await runAction(() => createReport(user.id, body));
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      body: t.Object({
        reportType: reportTypeSchema,
        description: t.String({ minLength: 20 }),
        reportedUserId: t.Optional(t.Union([t.String(), t.Null()])),
        reportedJobId: t.Optional(t.Union([t.String(), t.Null()])),
        reportedProposalId: t.Optional(t.Union([t.String(), t.Null()])),
        reportedMessageId: t.Optional(t.Union([t.String(), t.Null()])),
      }),
      detail: {
        summary: "File a content or user report",
        description:
          "Report a user, job, proposal, or chat message. At least one target id is required.",
      },
    },
  );
