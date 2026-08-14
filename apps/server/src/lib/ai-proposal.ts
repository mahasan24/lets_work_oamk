import { db } from "@lets_work/db";
import { aiUsageLog } from "@lets_work/db/schema/ai";
import { job } from "@lets_work/db/schema/jobs";
import { env } from "@lets_work/env/server";
import { eq } from "drizzle-orm";

import { generateGeminiText } from "./ai-gemini";
import { BadRequestError, NotFoundError, ServiceUnavailableError } from "./errors";
import { getProfileBundle } from "./profile";

export type ProposalAiMode = "generate" | "enhance";

const COVER_LETTER_MIN = 50;
const COVER_LETTER_MAX = 2500;

function truncate(value: string | null | undefined, max: number) {
  if (!value) return "";
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function cleanCoverLetter(raw: string) {
  let text = raw.trim();
  // Strip common markdown fences / quotes models sometimes wrap output in
  text = text
    .replace(/^```(?:\w+)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  text = text.replace(/^["']|["']$/g, "").trim();
  if (text.length > COVER_LETTER_MAX) {
    text = text.slice(0, COVER_LETTER_MAX).trim();
  }
  return text;
}

function asStringList(value: unknown, max: number) {
  if (!Array.isArray(value)) return [] as string[];
  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim())
    .slice(0, max);
}

function buildFreelancerContext(bundle: Awaited<ReturnType<typeof getProfileBundle>>) {
  const { user, profile, experience, portfolio, certifications } = bundle;
  const experienceLines = experience.slice(0, 4).map((item) => {
    const company = item.company ? ` at ${item.company}` : "";
    const desc = item.description ? `: ${truncate(item.description, 160)}` : "";
    return `- ${item.title}${company}${desc}`;
  });
  const portfolioLines = portfolio.slice(0, 4).map((item) => {
    const desc = item.description ? `: ${truncate(item.description, 120)}` : "";
    return `- ${item.title}${desc}`;
  });
  const certLines = certifications
    .slice(0, 3)
    .map((item) => `- ${item.name}${item.issuer ? ` (${item.issuer})` : ""}`);

  return {
    name: user.name,
    headline: profile.headline,
    bio: truncate(profile.bio, 600),
    skills: asStringList(profile.skills, 20),
    jobCategories: asStringList(profile.jobCategories, 8),
    hourlyRate: profile.hourlyRate,
    currency: profile.currency ?? "USD",
    country: profile.country,
    city: profile.city,
    timezone: profile.timezone,
    availabilityStatus: profile.availabilityStatus,
    hoursPerWeek: profile.hoursPerWeek,
    avgRating: profile.avgRating,
    reviewCount: profile.reviewCount,
    jobsCompleted: profile.jobsCompleted,
    experience: experienceLines,
    portfolio: portfolioLines,
    certifications: certLines,
  };
}

function buildJobContext(row: typeof job.$inferSelect) {
  return {
    title: row.title,
    category: row.category,
    description: truncate(row.description, 1800),
    requiredSkills: row.requiredSkills ?? [],
    tags: row.tags ?? [],
    budgetType: row.budgetType,
    budgetMin: row.budgetMin,
    budgetMax: row.budgetMax,
    hourlyRateMin: row.hourlyRateMin,
    hourlyRateMax: row.hourlyRateMax,
    currency: row.currency,
    experienceLevel: row.experienceLevel,
    estimatedDuration: row.estimatedDuration,
    weeklyHours: row.weeklyHours,
    remoteOnly: row.remoteOnly,
    preferredTimezone: row.preferredTimezone,
    country: row.country,
  };
}

function buildPrompt(input: {
  mode: ProposalAiMode;
  jobContext: ReturnType<typeof buildJobContext>;
  freelancer: ReturnType<typeof buildFreelancerContext>;
  coverLetter?: string;
}) {
  const sharedRules = `
You write proposal cover letters for a freelance marketplace called Lets Work.
Rules:
- Output ONLY the cover letter body. No title, no markdown headings, no bullet list of meta notes.
- Write in first person as the freelancer.
- Be specific to THIS job and THIS freelancer profile. Do not invent employers, degrees, or projects not listed.
- Keep it professional, warm, and concise (about 150–280 words).
- Mention relevant skills that overlap with the job when possible.
- Do not include placeholders like [Your Name] — use the real name if provided.
- Do not include a subject line.
`.trim();

  const contextBlock = `
JOB:
${JSON.stringify(input.jobContext, null, 2)}

FREELANCER PROFILE:
${JSON.stringify(input.freelancer, null, 2)}
`.trim();

  if (input.mode === "enhance") {
    return `${sharedRules}

Task: Improve the freelancer's draft cover letter. Keep their intent and voice, but make it clearer, stronger, and better tailored to the job. Fill in missing profile-based strengths where appropriate. Do not make it longer than ~320 words.

CURRENT DRAFT:
"""
${input.coverLetter?.trim() ?? ""}
"""

${contextBlock}`;
  }

  return `${sharedRules}

Task: Write a new cover letter from scratch using the freelancer profile and job details. Automatically weave in relevant experience, skills, and portfolio highlights so the freelancer does not have to fill those in manually.

${contextBlock}`;
}

async function logUsage(input: {
  userId: string;
  jobId: string;
  mode: ProposalAiMode;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}) {
  try {
    await db.insert(aiUsageLog).values({
      id: crypto.randomUUID(),
      userId: input.userId,
      feature: "proposal_draft",
      model: input.model,
      promptTokens: input.promptTokens ?? null,
      completionTokens: input.completionTokens ?? null,
      totalTokens: input.totalTokens ?? null,
      entityType: "job",
      entityId: input.jobId,
      metadata: { mode: input.mode },
    });
  } catch (error) {
    console.error("[ai] failed to log usage", error);
  }
}

export async function generateProposalCoverLetter(input: {
  jobId: string;
  userId: string;
  mode: ProposalAiMode;
  coverLetter?: string;
}) {
  if (!env.GEMINI_API_KEY) {
    throw new ServiceUnavailableError(
      "AI proposal assistant is not configured. Add GEMINI_API_KEY to the server environment.",
      "AI_NOT_CONFIGURED",
    );
  }

  if (input.mode === "enhance") {
    const draft = input.coverLetter?.trim() ?? "";
    if (draft.length < 20) {
      throw new BadRequestError(
        "Add a short draft first, or use Write with AI to generate one.",
        "AI_DRAFT_TOO_SHORT",
      );
    }
  }

  const [jobRow] = await db.select().from(job).where(eq(job.id, input.jobId)).limit(1);
  if (!jobRow) {
    throw new NotFoundError("Job not found", "JOB_NOT_FOUND");
  }
  if (jobRow.status !== "open" && jobRow.status !== "in_review") {
    throw new BadRequestError("This job is not accepting proposals", "JOB_NOT_OPEN");
  }

  const profile = await getProfileBundle(input.userId);
  const prompt = buildPrompt({
    mode: input.mode,
    jobContext: buildJobContext(jobRow),
    freelancer: buildFreelancerContext(profile),
    coverLetter: input.coverLetter,
  });

  const generated = await generateGeminiText({
    prompt,
    temperature: input.mode === "enhance" ? 0.55 : 0.7,
    maxOutputTokens: 1024,
  });

  const coverLetter = cleanCoverLetter(generated.text);
  if (coverLetter.length < COVER_LETTER_MIN) {
    throw new ServiceUnavailableError(
      "AI returned an incomplete cover letter. Please try again.",
      "AI_EMPTY_RESPONSE",
    );
  }

  await logUsage({
    userId: input.userId,
    jobId: input.jobId,
    mode: input.mode,
    model: generated.model,
    promptTokens: generated.promptTokens,
    completionTokens: generated.completionTokens,
    totalTokens: generated.totalTokens,
  });

  return {
    coverLetter,
    mode: input.mode,
    model: generated.model,
  };
}
