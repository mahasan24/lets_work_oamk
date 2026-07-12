import { Elysia, t } from "elysia";

import { HirerAccessError, JobForbiddenError, JobNotFoundError, requireHirerProfile } from "../lib/hirer";
import { getHirerProposal, listHirerJobProposals } from "../lib/hirer-proposals";
import {
  ProposalForbiddenError,
  ProposalNotFoundError,
} from "../lib/proposals";
import { betterAuthPlugin } from "../plugins/auth";
import { COOKIE_AUTH_SECURITY } from "../lib/openapi-tags";

type ErrorResponse = { status: number; body: { error: string } };

function handleHirerProposalError(error: unknown): ErrorResponse | null {
  if (error instanceof HirerAccessError) {
    return { status: 403, body: { error: error.message } };
  }
  if (error instanceof JobNotFoundError || error instanceof ProposalNotFoundError) {
    return { status: 404, body: { error: error.message } };
  }
  if (error instanceof JobForbiddenError || error instanceof ProposalForbiddenError) {
    return { status: 403, body: { error: error.message } };
  }
  return null;
}

async function runHirerProposalAction<T>(userId: string, action: () => Promise<T>) {
  try {
    await requireHirerProfile(userId);
    return { ok: true as const, data: await action() };
  } catch (error) {
    const mapped = handleHirerProposalError(error);
    if (mapped) {
      return { ok: false as const, status: mapped.status, body: mapped.body };
    }
    throw error;
  }
}

export const hirerProposalRoutes = new Elysia({
  prefix: "/api/hirer",
  detail: {
    tags: ["Hirer Proposals"],
    security: COOKIE_AUTH_SECURITY,
  },
})
  .use(betterAuthPlugin)
  .get(
    // Param must be `:id` (same name as `/api/hirer/jobs/:id` in job routes)
    "/jobs/:id/proposals",
    async ({ user, params, query, status }) => {
      const result = await runHirerProposalAction(user.id, () =>
        listHirerJobProposals(params.id, user.id, {
          status: query.status,
          sort: query.sort,
        }),
      );
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ id: t.String() }),
      query: t.Object({
        status: t.Optional(
          t.Union([
            t.Literal("submitted"),
            t.Literal("shortlisted"),
            t.Literal("accepted"),
            t.Literal("rejected"),
            t.Literal("withdrawn"),
          ]),
        ),
        sort: t.Optional(
          t.Union([t.Literal("newest"), t.Literal("rate_low"), t.Literal("rate_high")]),
        ),
      }),
      detail: {
        summary: "List proposals for a job",
        description: "View and compare submitted proposals for a hirer-owned job.",
      },
    },
  )
  .get(
    "/proposals/:id",
    async ({ user, params, status }) => {
      const result = await runHirerProposalAction(user.id, () =>
        getHirerProposal(params.id, user.id),
      );
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ id: t.String() }),
      detail: { summary: "Get proposal details" },
    },
  );
