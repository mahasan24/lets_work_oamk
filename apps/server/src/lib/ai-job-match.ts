import { aiRecommendation } from "@lets_work/db/schema/ai";
import { db } from "@lets_work/db";

import { buildFreelancerAiContext, generateGeminiText, logAiUsage, truncate } from "./ai-gemini";
import { BadRequestError } from "./errors";
import { listFreelancerJobFeed } from "./freelancer-jobs";
import { getProfileBundle } from "./profile";

type RankedItem = {
  jobId: string;
  aiScore: number;
  reason: string;
};

type FeedItem = Awaited<ReturnType<typeof listFreelancerJobFeed>>["items"][number];

function extractJsonArrayPayload(text: string): string | null {
  const start = text.indexOf("[");
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i]!;
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "[") depth += 1;
    if (ch === "]") {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }

  // Truncated array — close the last complete object if possible.
  const slice = text.slice(start);
  const lastCompleteObject = slice.lastIndexOf("}");
  if (lastCompleteObject > 0) {
    return `${slice.slice(0, lastCompleteObject + 1)}]`;
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function parseRankedItem(item: unknown): RankedItem | null {
  const row = asRecord(item);
  if (!row) return null;

  const jobIdRaw = row.jobId ?? row.job_id ?? row.id;
  const jobId = typeof jobIdRaw === "string" ? jobIdRaw.trim() : null;
  const reasonRaw = row.reason ?? row.explanation ?? row.why;
  const reason = typeof reasonRaw === "string" ? reasonRaw.trim() : "";
  const scoreRaw = row.aiScore ?? row.score ?? row.matchScore ?? row.match_score;
  const aiScore =
    typeof scoreRaw === "number" ? scoreRaw : typeof scoreRaw === "string" ? Number(scoreRaw) : NaN;

  if (!jobId || !Number.isFinite(aiScore)) return null;

  return {
    jobId,
    reason: truncate(reason || "Strong profile fit for this role.", 220),
    aiScore: Math.max(0, Math.min(100, Math.round(aiScore))),
  };
}

function parseRankedJson(text: string): RankedItem[] {
  const payload = extractJsonArrayPayload(text);
  if (!payload) {
    // Some models wrap the array: { "recommendations": [...] }
    try {
      const parsed = JSON.parse(text) as unknown;
      const row = asRecord(parsed);
      const nested = row?.recommendations ?? row?.jobs ?? row?.items ?? row?.results ?? null;
      if (Array.isArray(nested)) {
        return nested.map(parseRankedItem).filter((item): item is RankedItem => item != null);
      }
    } catch {
      // fall through
    }
    return [];
  }

  try {
    const parsed = JSON.parse(payload) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(parseRankedItem).filter((item): item is RankedItem => item != null);
  } catch {
    return [];
  }
}

function fallbackRankedFromFeed(items: FeedItem[], limit: number): RankedItem[] {
  return items.slice(0, limit).map((item) => {
    const matched = item.matchedSkills.slice(0, 3).join(", ");
    const reason = matched
      ? `Strong skill overlap (${matched}).`
      : `Top match from your profile (${item.matchPercent}% skill fit).`;
    return {
      jobId: item.id,
      aiScore: Math.max(1, Math.min(100, item.matchPercent)),
      reason,
    };
  });
}

function attachRanking(feedItems: FeedItem[], ranked: RankedItem[], limit: number) {
  const byId = new Map(feedItems.map((item) => [item.id, item]));
  const seen = new Set<string>();
  return ranked
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

  // Keep the prompt compact so the model has room to finish a full JSON array.
  const candidates = feed.items.slice(0, Math.min(12, Math.max(limit + 2, 8))).map((item) => ({
    jobId: item.id,
    title: item.title,
    category: item.category,
    summary: truncate(item.description, 180),
    requiredSkills: item.requiredSkills.slice(0, 8),
    matchPercent: item.matchPercent,
    matchedSkills: item.matchedSkills.slice(0, 6),
    budgetType: item.budgetType,
    experienceLevel: item.experienceLevel,
  }));

  const freelancer = buildFreelancerAiContext(profile);
  const prompt = `
You are a job-matching assistant for the Lets Work freelance marketplace.
Rank candidate jobs for THIS freelancer. Prefer skill overlap, relevant experience, and realistic budget/experience fit.
Do not invent skills or experience.

Return a JSON array only (no markdown, no wrapper object), with at most ${limit} objects.
Each object must use exactly these keys:
{"jobId":"<id from candidate list>","aiScore":<0-100 integer>,"reason":"<one short sentence>"}

Use only jobIds from the candidate list.

FREELANCER:
${JSON.stringify({
  name: freelancer.name,
  headline: freelancer.headline,
  skills: freelancer.skills,
  jobCategories: freelancer.jobCategories,
  hourlyRate: freelancer.hourlyRate,
  experience: freelancer.experience,
})}

CANDIDATE JOBS:
${JSON.stringify(candidates)}
`.trim();

  let model: string | null = null;
  let ranked: RankedItem[] = [];

  try {
    const generated = await generateGeminiText({
      prompt,
      temperature: 0.2,
      maxOutputTokens: 4096,
      responseMimeType: "application/json",
    });
    model = generated.model;
    ranked = parseRankedJson(generated.text);

    if (ranked.length === 0) {
      console.warn("[ai] job recommendations parse empty", {
        finishReason: generated.finishReason,
        preview: generated.text.slice(0, 400),
      });
    } else {
      await logAiUsage({
        userId,
        feature: "job_match",
        model: generated.model,
        entityType: "user",
        entityId: userId,
        metadata: {
          candidateCount: candidates.length,
          parsedCount: ranked.length,
          finishReason: generated.finishReason,
        },
        promptTokens: generated.promptTokens,
        completionTokens: generated.completionTokens,
        totalTokens: generated.totalTokens,
      });
    }
  } catch (error) {
    console.error("[ai] job recommendations generation failed; using skill-match fallback", error);
  }

  let items = attachRanking(feed.items, ranked, limit);
  if (items.length === 0) {
    items = attachRanking(feed.items, fallbackRankedFromFeed(feed.items, limit), limit);
  }

  if (items.length > 0) {
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
  }

  return {
    items,
    model,
    profileSkills: feed.profileSkills,
  };
}
