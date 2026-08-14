import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "@lets_work/db";
import { aiUsageLog, aiFeatureEnum } from "@lets_work/db/schema/ai";
import { env } from "@lets_work/env/server";

import { ServiceUnavailableError } from "./errors";
import type { getProfileBundle } from "./profile";

export type AiFeature = (typeof aiFeatureEnum.enumValues)[number];

export function truncate(value: string | null | undefined, max: number) {
  if (!value) return "";
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

export function asStringList(value: unknown, max: number) {
  if (!Array.isArray(value)) return [] as string[];
  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim())
    .slice(0, max);
}

export function cleanAiText(raw: string, max = 4000) {
  let text = raw.trim();
  text = text
    .replace(/^```(?:\w+)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  text = text.replace(/^["']|["']$/g, "").trim();
  if (text.length > max) {
    text = text.slice(0, max).trim();
  }
  return text;
}

export function requireGeminiApiKey() {
  if (!env.GEMINI_API_KEY) {
    throw new ServiceUnavailableError(
      "AI features are not configured. Add GEMINI_API_KEY to the server environment.",
      "AI_NOT_CONFIGURED",
    );
  }
  return env.GEMINI_API_KEY;
}

export function buildFreelancerAiContext(bundle: Awaited<ReturnType<typeof getProfileBundle>>) {
  const { user, profile, experience, portfolio, certifications } = bundle;
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
    experience: experience.slice(0, 4).map((item) => {
      const company = item.company ? ` at ${item.company}` : "";
      const desc = item.description ? `: ${truncate(item.description, 160)}` : "";
      return `- ${item.title}${company}${desc}`;
    }),
    portfolio: portfolio.slice(0, 4).map((item) => {
      const desc = item.description ? `: ${truncate(item.description, 120)}` : "";
      return `- ${item.title}${desc}`;
    }),
    certifications: certifications
      .slice(0, 3)
      .map((item) => `- ${item.name}${item.issuer ? ` (${item.issuer})` : ""}`),
  };
}

function extractGeminiText(response: {
  text: () => string;
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}) {
  try {
    return cleanAiText(response.text() ?? "");
  } catch {
    // Blocked / empty candidates — fall back to raw parts if present.
    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const joined = parts
      .map((part) => (typeof part.text === "string" ? part.text : ""))
      .join("")
      .trim();
    return cleanAiText(joined);
  }
}

export async function generateGeminiText(input: {
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  /** Prefer application/json when the caller will parse structured output. */
  responseMimeType?: "text/plain" | "application/json";
}) {
  const apiKey = requireGeminiApiKey();
  const modelName = env.GEMINI_MODEL;
  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: input.temperature ?? 0.6,
      maxOutputTokens: input.maxOutputTokens ?? 1024,
      ...(input.responseMimeType ? { responseMimeType: input.responseMimeType } : {}),
    },
  });

  try {
    const result = await model.generateContent(input.prompt);
    const text = extractGeminiText(result.response);
    if (!text) {
      throw new ServiceUnavailableError(
        "AI returned an empty response. Please try again.",
        "AI_EMPTY_RESPONSE",
      );
    }
    const usage = result.response.usageMetadata;
    return {
      text,
      model: modelName,
      promptTokens: usage?.promptTokenCount,
      completionTokens: usage?.candidatesTokenCount,
      totalTokens: usage?.totalTokenCount,
      finishReason: result.response.candidates?.[0]?.finishReason ?? null,
    };
  } catch (error) {
    if (error instanceof ServiceUnavailableError) throw error;
    console.error("[ai] gemini generateContent failed", { model: modelName, error });
    const detail = error instanceof Error ? error.message : String(error);
    const modelGone = /404|not found|no longer available|deprecated/i.test(detail);
    throw new ServiceUnavailableError(
      modelGone
        ? `AI model "${modelName}" is unavailable. Set GEMINI_MODEL to a current model (e.g. gemini-3.5-flash).`
        : "AI assistant is temporarily unavailable. Try again in a moment.",
      "AI_PROVIDER_ERROR",
    );
  }
}

export async function logAiUsage(input: {
  userId: string;
  feature: AiFeature;
  model: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}) {
  try {
    await db.insert(aiUsageLog).values({
      id: crypto.randomUUID(),
      userId: input.userId,
      feature: input.feature,
      model: input.model,
      promptTokens: input.promptTokens ?? null,
      completionTokens: input.completionTokens ?? null,
      totalTokens: input.totalTokens ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      metadata: input.metadata ?? null,
    });
  } catch (error) {
    console.error("[ai] failed to log usage", error);
  }
}
