import { db } from "@lets_work/db";
import { certification } from "@lets_work/db/schema/certifications";
import { marketplaceUserProfile } from "@lets_work/db/schema/marketplace";
import { portfolioItem, workHistory } from "@lets_work/db/schema/portfolio";
import { createUploadSignature, type UploadFolder } from "@lets_work/media";
import { eq, and } from "drizzle-orm";
import { Elysia, t } from "elysia";

import {
  getProfileBundle,
  initializeProfileRole,
  refreshProfileCompletion,
  submitIdentityVerification,
} from "../lib/profile";
import { betterAuthPlugin } from "../plugins/auth";
import { COOKIE_AUTH_SECURITY } from "../lib/openapi-tags";

const profileUpdateSchema = t.Object({
  headline: t.Optional(t.String()),
  bio: t.Optional(t.String()),
  skills: t.Optional(t.Array(t.String())),
  jobCategories: t.Optional(t.Array(t.String())),
  hourlyRate: t.Optional(t.Nullable(t.String())),
  currency: t.Optional(t.String()),
  country: t.Optional(t.Nullable(t.String())),
  city: t.Optional(t.Nullable(t.String())),
  location: t.Optional(t.Nullable(t.String())),
  timezone: t.Optional(t.Nullable(t.String())),
  videoIntroUrl: t.Optional(t.Nullable(t.String())),
  avatarUrl: t.Optional(t.Nullable(t.String())),
  availabilityStatus: t.Optional(
    t.Union([t.Literal("available"), t.Literal("limited"), t.Literal("unavailable")]),
  ),
  hoursPerWeek: t.Optional(t.Nullable(t.Number())),
  activeRole: t.Optional(t.Union([t.Literal("freelancer"), t.Literal("hirer")])),
  hirerType: t.Optional(t.Nullable(t.Union([t.Literal("individual"), t.Literal("company")]))),
  companyName: t.Optional(t.Nullable(t.String())),
  companyWebsite: t.Optional(t.Nullable(t.String())),
  companyDescription: t.Optional(t.Nullable(t.String())),
  companySize: t.Optional(t.Nullable(t.String())),
  phoneNumber: t.Optional(t.Nullable(t.String())),
});

export const profileRoutes = new Elysia({
  prefix: "/api/profile",
  detail: {
    tags: ["Profile"],
    security: COOKIE_AUTH_SECURITY,
  },
})
  .use(betterAuthPlugin)
  .get(
    "/me",
    async ({ user }) => {
      return getProfileBundle(user.id);
    },
    { auth: true, detail: { summary: "Get current profile", description: "Returns profile, portfolio, certifications, experience, and completion score." } },
  )
  .post(
    "/initialize",
    async ({ user, body }) => {
      return initializeProfileRole(user.id, body.accountType);
    },
    {
      auth: true,
      body: t.Object({
        accountType: t.Union([t.Literal("hirer"), t.Literal("freelancer")]),
      }),
      detail: {
        summary: "Initialize account role",
        description: "Sets the user's marketplace role during onboarding.",
      },
    },
  )
  .patch(
    "/me",
    async ({ user, body }) => {
      await db
        .update(marketplaceUserProfile)
        .set({
          ...body,
          skills: body.skills ?? undefined,
          jobCategories: body.jobCategories ?? undefined,
        })
        .where(eq(marketplaceUserProfile.userId, user.id));

      return getProfileBundle(user.id);
    },
    {
      auth: true,
      body: profileUpdateSchema,
      detail: {
        summary: "Update profile",
        description: "Partially updates freelancer or hirer profile fields.",
      },
    },
  )
  .post(
    "/verification",
    async ({ user }) => {
      return submitIdentityVerification(user.id);
    },
    {
      auth: true,
      detail: {
        summary: "Submit identity verification",
        description: "Submits the user's profile for identity verification review.",
      },
    },
  )
  .post(
    "/portfolio",
    async ({ user, body }) => {
      const id = crypto.randomUUID();
      await db.insert(portfolioItem).values({
        id,
        userId: user.id,
        title: body.title,
        description: body.description,
        projectUrl: body.projectUrl,
        imageUrl: body.imageUrl,
        sortOrder: body.sortOrder ?? 0,
      });
      await refreshProfileCompletion(user.id);
      return getProfileBundle(user.id);
    },
    {
      auth: true,
      body: t.Object({
        title: t.String({ minLength: 1 }),
        description: t.Optional(t.Nullable(t.String())),
        projectUrl: t.Optional(t.Nullable(t.String())),
        imageUrl: t.Optional(t.Nullable(t.String())),
        sortOrder: t.Optional(t.Number()),
      }),
      detail: { summary: "Add portfolio item" },
    },
  )
  .patch(
    "/portfolio/:id",
    async ({ user, params, body }) => {
      await db
        .update(portfolioItem)
        .set(body)
        .where(and(eq(portfolioItem.id, params.id), eq(portfolioItem.userId, user.id)));
      await refreshProfileCompletion(user.id);
      return getProfileBundle(user.id);
    },
    {
      auth: true,
      params: t.Object({ id: t.String() }),
      body: t.Object({
        title: t.Optional(t.String()),
        description: t.Optional(t.Nullable(t.String())),
        projectUrl: t.Optional(t.Nullable(t.String())),
        imageUrl: t.Optional(t.Nullable(t.String())),
        sortOrder: t.Optional(t.Number()),
      }),
      detail: { summary: "Update portfolio item" },
    },
  )
  .delete(
    "/portfolio/:id",
    async ({ user, params }) => {
      await db
        .delete(portfolioItem)
        .where(and(eq(portfolioItem.id, params.id), eq(portfolioItem.userId, user.id)));
      await refreshProfileCompletion(user.id);
      return getProfileBundle(user.id);
    },
    {
      auth: true,
      params: t.Object({ id: t.String() }),
      detail: { summary: "Delete portfolio item" },
    },
  )
  .post(
    "/certifications",
    async ({ user, body }) => {
      const id = crypto.randomUUID();
      await db.insert(certification).values({
        id,
        userId: user.id,
        name: body.name,
        issuer: body.issuer,
        credentialId: body.credentialId,
        credentialUrl: body.credentialUrl,
        imageUrl: body.imageUrl,
        issueDate: body.issueDate ? new Date(body.issueDate) : null,
        expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
        sortOrder: body.sortOrder ?? 0,
      });
      await refreshProfileCompletion(user.id);
      return getProfileBundle(user.id);
    },
    {
      auth: true,
      body: t.Object({
        name: t.String({ minLength: 1 }),
        issuer: t.Optional(t.Nullable(t.String())),
        credentialId: t.Optional(t.Nullable(t.String())),
        credentialUrl: t.Optional(t.Nullable(t.String())),
        imageUrl: t.Optional(t.Nullable(t.String())),
        issueDate: t.Optional(t.Nullable(t.String())),
        expiryDate: t.Optional(t.Nullable(t.String())),
        sortOrder: t.Optional(t.Number()),
      }),
      detail: { summary: "Add certification" },
    },
  )
  .delete(
    "/certifications/:id",
    async ({ user, params }) => {
      await db
        .delete(certification)
        .where(and(eq(certification.id, params.id), eq(certification.userId, user.id)));
      await refreshProfileCompletion(user.id);
      return getProfileBundle(user.id);
    },
    {
      auth: true,
      params: t.Object({ id: t.String() }),
      detail: { summary: "Delete certification" },
    },
  )
  .post(
    "/experience",
    async ({ user, body }) => {
      const id = crypto.randomUUID();
      await db.insert(workHistory).values({
        id,
        userId: user.id,
        title: body.title,
        company: body.company,
        description: body.description,
        isCurrent: body.isCurrent ?? false,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        sortOrder: body.sortOrder ?? 0,
      });
      await refreshProfileCompletion(user.id);
      return getProfileBundle(user.id);
    },
    {
      auth: true,
      body: t.Object({
        title: t.String({ minLength: 1 }),
        company: t.Optional(t.Nullable(t.String())),
        description: t.Optional(t.Nullable(t.String())),
        isCurrent: t.Optional(t.Boolean()),
        startDate: t.Optional(t.Nullable(t.String())),
        endDate: t.Optional(t.Nullable(t.String())),
        sortOrder: t.Optional(t.Number()),
      }),
      detail: { summary: "Add work experience" },
    },
  )
  .delete(
    "/experience/:id",
    async ({ user, params }) => {
      await db
        .delete(workHistory)
        .where(and(eq(workHistory.id, params.id), eq(workHistory.userId, user.id)));
      await refreshProfileCompletion(user.id);
      return getProfileBundle(user.id);
    },
    {
      auth: true,
      params: t.Object({ id: t.String() }),
      detail: { summary: "Delete work experience" },
    },
  )
  .get(
    "/uploads/sign",
    ({ query }) => {
      const folder = (query.folder ?? "portfolio") as UploadFolder;
      const allowed: UploadFolder[] = ["avatars", "portfolio", "certifications", "videos"];
      if (!allowed.includes(folder)) {
        return new Response(JSON.stringify({ error: "Invalid folder" }), { status: 400 });
      }
      return createUploadSignature(folder);
    },
    {
      auth: true,
      query: t.Object({
        folder: t.Optional(
          t.Union([
            t.Literal("avatars"),
            t.Literal("portfolio"),
            t.Literal("certifications"),
            t.Literal("videos"),
          ]),
        ),
      }),
      detail: {
        summary: "Sign Cloudinary upload",
        description: "Returns a signed payload for direct client uploads to Cloudinary.",
      },
    },
  );
