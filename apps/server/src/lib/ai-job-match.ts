import { aiRecommendation } from "@lets_work/db/schema/ai";
import { db } from "@lets_work/db";

import { buildFreelancerAiContext, generateGeminiText, logAiUsage, truncate } from "./ai-gemini";
import { BadRequestError, ServiceUnavailableError } from "./errors";
import { listFreelancerJobFeed } from "./freelancer-jobs";
import { getProfileBundle } from "./profile";

type RankedItem = {
  jobId: string;
  aiScore: number;
  reason: string;
};

function parseRankedJson(text: string): RankedItem[] {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const row = item as Record<string, unknown>;
        const jobId = typeof row.jobId === "string" ? row.jobId : null;
        const reason = typeof row.reason === "string" ? row.reason.trim() : "";
        const scoreRaw = row.aiScore ?? row.score;
        const aiScore =
          typeof scoreRaw === "number"
            ? scoreRaw
            : typeof scoreRaw === "string"
              ? Number(scoreRaw)
              : NaN;
        if (!jobId || !reason || !Number.isFinite(aiScore)) return null;
        return {
          jobId,
          reason: truncate(reason, 220),
          aiScore: Math.max(0, Math.min(100, Math.round(aiScore))),
        };
      })
      .filter((item): item is RankedItem => item != null);
  } catch {
    return [];
  }
}

export async function getAiJobRecommendations(userId: string, input?: { limit?: number }) {
  const limit = Math.min(Math.max(input?.limit ?? 8, 1), 12);

  const profile = await getProfileBundle(userId);
  const skills = Array.isArray(profile.profile.skills)
    ? (profile.profile.skills as string[]).filter((s) => typeof s === "string" && s.trim())
    : [];
  if (skills.length === 0) {
    throw new BadRequestError(
      "Add skills to your profile so AI can recommend matching jobs.",
      "AI_PROFILE_SKILLS_REQUIRED",
    );
  }

  const feed = await listFreelancerJobFeed(userId, {
    tab: "best_match",
    page: 1,
    limit: Math.max(limit * 2, 16),
  });

  if (feed.items.length === 0) {
    return { items: [], model: null as string | null, profileSkills: feed.profileSkills };
  }

  const candidates = feed.items.slice(0, 16).map((item) => ({
    jobId: item.id,
    title: item.title,
    category: item.category,
    description: truncate(item.description, 400),
    requiredSkills: item.requiredSkills.slice(0, 12),
    matchPercent: item.matchPercent,
    matchedSkills: item.matchedSkills,
    budgetType: item.budgetType,
    experienceLevel: item.experienceLevel,
  }));

  const freelancer = buildFreelancerAiContext(profile);
  const prompt = `
You are a job-matching assistant for the Lets Work freelance marketplace.
Rank the candidate jobs for THIS freelancer. Prefer skill overlap, relevant experience, and realistic budget/experience fit.
Do not invent skills or experience.

Return ONLY a JSON array (no markdown), with at most ${limit} objects:
[{"jobId":"...","aiScore":0-100,"reason":"one short sentence why this job fits"}]

Use only jobIds from the candidate list.

FREELANCER:
${JSON.stringify(freelancer, null, 2)}

CANDIDATE JOBS:
${JSON.stringify(candidates, null, 2)}
`.trim();

  const generated = await generateGeminiText({
    prompt,
    temperature: 0.35,
    maxOutputTokens: 1200,
  });

  const ranked = parseRankedJson(generated.text);
  if (ranked.length === 0) {
    throw new ServiceUnavailableError(
      "AI returned an incomplete recommendation list. Please try again.",
      "AI_EMPTY_RESPONSE",
    );
  }

  const byId = new Map(feed.items.map((item) => [item.id, item]));
  const seen = new Set<string>();
  const items = ranked
    .filter((row) => {
      if (!byId.has(row.jobId) || seen.has(row.jobId)) return false;
      seen.add(row.jobId);
      return true;
    })
    .slice(0, limit)
    .map((row) => ({
      ...byId.get(row.jobId)!,
      aiScore: row.aiScore,
      aiReason: row.reason,
    }));

  if (items.length === 0) {
    throw new ServiceUnavailableError(
      "AI recommendations could not be matched to jobs. Please try again.",
      "AI_EMPTY_RESPONSE",
    );
  }

  await logAiUsage({
    userId,
    feature: "job_match",
    model: generated.model,
    entityType: "user",
    entityId: userId,
    metadata: { candidateCount: candidates.length, resultCount: items.length },
    promptTokens: generated.promptTokens,
    completionTokens: generated.completionTokens,
    totalTokens: generated.totalTokens,
  });

  try {
    await db.insert(aiRecommendation).values(
      items.map((item) => ({
        id: crypto.randomUUID(),
        userId,
        feature: "job_match" as const,
        jobId: item.id,
        score: (item.aiScore / 100).toFixed(4),
        output: { reason: item.aiReason, aiScore: item.aiScore },
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 6),
      })),
    );
  } catch (error) {
    console.error("[ai] failed to store job recommendations", error);
  }

  return {
    items,
    model: generated.model,
    profileSkills: feed.profileSkills,
  };
}
