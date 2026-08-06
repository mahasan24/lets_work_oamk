import { createUploadSignature } from "@lets_work/media";
import { Elysia, t } from "elysia";

import { requireFreelancerProfile } from "../lib/freelancer";
import { runGuardedAction } from "../lib/http";
import {
  getFreelancerProposalForJob,
  saveFreelancerProposalDraft,
  submitFreelancerProposal,
  withdrawFreelancerProposal,
} from "../lib/proposals";
import { generateProposalCoverLetter } from "../lib/ai-proposal";
import { betterAuthPlugin } from "../plugins/auth";
import { COOKIE_AUTH_SECURITY } from "../lib/openapi-tags";

const proposalAttachmentSchema = t.Object({
  id: t.Optional(t.String()),
  url: t.String(),
  fileName: t.String(),
  mimeType: t.Optional(t.Nullable(t.String())),
});

const proposalWriteSchema = t.Object({
  coverLetter: t.Optional(t.String()),
  proposedRate: t.Optional(t.Nullable(t.String())),
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
  attachments: t.Optional(t.Array(proposalAttachmentSchema)),
});

const runFreelancerAction = <T>(userId: string, action: () => Promise<T>) =>
  runGuardedAction(() => requireFreelancerProfile(userId), action);

export const freelancerProposalRoutes = new Elysia({
  prefix: "/api/freelancer",
  detail: {
    tags: ["Freelancer Proposals"],
    security: COOKIE_AUTH_SECURITY,
  },
})
  .use(betterAuthPlugin)
  .get(
    "/proposals/uploads/sign",
    async ({ user, status }) => {
      const result = await runFreelancerAction(user.id, async () =>
        createUploadSignature("proposal-attachments"),
      );
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    { auth: true, detail: { summary: "Sign proposal attachment upload" } },
  )
  .get(
    "/jobs/:jobId/proposal",
    async ({ user, params, status }) => {
      const result = await runFreelancerAction(user.id, () =>
        getFreelancerProposalForJob(params.jobId, user.id),
      );
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ jobId: t.String() }),
      detail: { summary: "Get my proposal for a job" },
    },
  )
  .put(
    "/jobs/:jobId/proposal",
    async ({ user, params, body, status }) => {
      const result = await runFreelancerAction(user.id, () =>
        saveFreelancerProposalDraft(params.jobId, user.id, body),
      );
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ jobId: t.String() }),
      body: proposalWriteSchema,
      detail: { summary: "Save proposal draft" },
    },
  )
  .post(
    "/jobs/:jobId/proposal/ai-assist",
    async ({ user, params, body, status }) => {
      const result = await runFreelancerAction(user.id, () =>
        generateProposalCoverLetter({
          jobId: params.jobId,
          userId: user.id,
          mode: body.mode,
          coverLetter: body.coverLetter,
        }),
      );
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ jobId: t.String() }),
      body: t.Object({
        mode: t.Union([t.Literal("generate"), t.Literal("enhance")]),
        coverLetter: t.Optional(t.String()),
      }),
      detail: {
        summary: "AI draft or enhance proposal cover letter",
        description:
          "Uses Gemini with the job posting and freelancer profile to generate or improve the cover letter.",
      },
    },
  )
  .post(
    "/jobs/:jobId/proposal/submit",
    async ({ user, params, body, status }) => {
      const result = await runFreelancerAction(user.id, () =>
        submitFreelancerProposal(params.jobId, user.id, body ?? undefined),
      );
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ jobId: t.String() }),
      body: t.Optional(proposalWriteSchema),
      detail: {
        summary: "Submit proposal",
        description: "Validates and submits a draft proposal.",
      },
    },
  )
  .post(
    "/proposals/:id/withdraw",
    async ({ user, params, status }) => {
      const result = await runFreelancerAction(user.id, () =>
        withdrawFreelancerProposal(params.id, user.id),
      );
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ id: t.String() }),
      detail: { summary: "Withdraw submitted proposal" },
    },
  );
