import { Elysia, t } from "elysia";

import {
  HirerAccessError,
  JobForbiddenError,
  JobNotFoundError,
  JobStatusError,
  requireHirerProfile,
} from "../lib/hirer";
import {
  acceptHirerProposal,
  getHirerProposal,
  listHirerJobProposals,
  messageShortlistedFreelancer,
  rejectHirerProposal,
  shortlistHirerProposal,
  unshortlistHirerProposal,
} from "../lib/hirer-proposals";
import {
  ProposalForbiddenError,
  ProposalNotFoundError,
  ProposalStatusError,
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
  if (error instanceof ProposalStatusError || error instanceof JobStatusError) {
    return { status: 400, body: { error: error.message } };
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
  )
  .post(
    "/proposals/:id/shortlist",
    async ({ user, params, status }) => {
      const result = await runHirerProposalAction(user.id, () =>
        shortlistHirerProposal(params.id, user.id),
      );
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ id: t.String() }),
      detail: {
        summary: "Shortlist a proposal",
        description: "Move a submitted proposal to shortlisted and notify the freelancer.",
      },
    },
  )
  .post(
    "/proposals/:id/unshortlist",
    async ({ user, params, status }) => {
      const result = await runHirerProposalAction(user.id, () =>
        unshortlistHirerProposal(params.id, user.id),
      );
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ id: t.String() }),
      detail: { summary: "Remove a proposal from the shortlist" },
    },
  )
  .post(
    "/proposals/:id/reject",
    async ({ user, params, status }) => {
      const result = await runHirerProposalAction(user.id, () =>
        rejectHirerProposal(params.id, user.id),
      );
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ id: t.String() }),
      detail: {
        summary: "Archive / reject a proposal",
        description: "Archive a submitted or shortlisted proposal.",
      },
    },
  )
  .post(
    "/proposals/:id/message",
    async ({ user, params, body, status }) => {
      const result = await runHirerProposalAction(user.id, () =>
        messageShortlistedFreelancer(params.id, user.id, body.body),
      );
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ id: t.String() }),
      body: t.Object({
        body: t.String({ minLength: 1, maxLength: 5000 }),
      }),
      detail: {
        summary: "Message a shortlisted freelancer",
        description: "Start or continue a job conversation with a shortlisted freelancer.",
      },
    },
  )
  .post(
    "/proposals/:id/accept",
    async ({ user, params, status }) => {
      const result = await runHirerProposalAction(user.id, () =>
        acceptHirerProposal(params.id, user.id),
      );
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ id: t.String() }),
      detail: {
        summary: "Hire from a proposal",
        description:
          "Accept a proposal, create an active contract, mark the job filled, reject other active proposals, and notify both parties.",
      },
    },
  );
