import { db } from "@lets_work/db";
import { job } from "@lets_work/db/schema/jobs";
import { eq } from "drizzle-orm";

import { asStringList, generateGeminiText, logAiUsage, truncate } from "./ai-gemini";
import { BadRequestError, ForbiddenError, NotFoundError, ServiceUnavailableError } from "./errors";

export type JobDescriptionAiMode = "generate" | "enhance";

function parseOptimizerJson(text: string) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    const description = typeof parsed.description === "string" ? parsed.description.trim() : "";
    const suggestedTitle =
      typeof parsed.suggestedTitle === "string" ? parsed.suggestedTitle.trim() : undefined;
    const suggestedSkills = asStringList(parsed.suggestedSkills, 12);
    if (!description) return null;
    return {
      description: truncate(description, 5000),
      suggestedTitle: suggestedTitle ? truncate(suggestedTitle, 120) : undefined,
      suggestedSkills: suggestedSkills.length > 0 ? suggestedSkills : undefined,
    };
  } catch {
    return null;
  }
}

export async function optimizeJobDescription(input: {
  jobId: string;
  userId: string;
  mode: JobDescriptionAiMode;
  title?: string;
  category?: string;
  description?: string;
  requiredSkills?: string[];
}) {
  const [jobRow] = await db.select().from(job).where(eq(job.id, input.jobId)).limit(1);
  if (!jobRow) {
    throw new NotFoundError("Job not found", "JOB_NOT_FOUND");
  }
  if (jobRow.hirerUserId !== input.userId) {
    throw new ForbiddenError("You do not own this job", "JOB_FORBIDDEN");
  }

  const title = (input.title ?? jobRow.title ?? "").trim();
  const category = (input.category ?? jobRow.category ?? "").trim();
  const description = (input.description ?? jobRow.description ?? "").trim();
  const requiredSkills = input.requiredSkills ?? asStringList(jobRow.requiredSkills, 20);

  if (input.mode === "enhance" && description.length < 20) {
    throw new BadRequestError(
      "Add a short draft first, or use Write with AI to generate one.",
      "AI_DRAFT_TOO_SHORT",
    );
  }
  if (input.mode === "generate" && title.length < 3) {
    throw new BadRequestError(
      "Add a job title before generating a description.",
      "AI_TITLE_REQUIRED",
    );
  }

  const shared = `
You help hiring clients write clear freelance job posts on Lets Work.
Return ONLY JSON (no markdown):
{
  "description": "full job description body",
  "suggestedTitle": "optional improved title",
  "suggestedSkills": ["skill1","skill2"]
}
Rules:
- description should be 120–350 words, professional, specific, and scannable with short paragraphs.
- Cover scope, deliverables, requirements, and collaboration style when known.
- Do not invent company names or confidential details.
- suggestedSkills should be concrete tools/skills (max 10).
`.trim();

  const prompt =
    input.mode === "enhance"
      ? `${shared}

Task: Improve this draft job description. Keep the client's intent, make it clearer and more compelling for freelancers.

CURRENT TITLE: ${title || "(none)"}
CATEGORY: ${category || "(none)"}
SKILLS: ${JSON.stringify(requiredSkills)}
CURRENT DESCRIPTION:
"""
${description}
"""
`
      : `${shared}

Task: Write a strong job description from the title/category/skills provided.

TITLE: ${title}
CATEGORY: ${category || "(none)"}
SKILLS: ${JSON.stringify(requiredSkills)}
NOTES FROM HIRER (optional draft):
"""
${description || "(empty)"}
"""
`;

  const generated = await generateGeminiText({
    prompt,
    temperature: input.mode === "enhance" ? 0.45 : 0.65,
    maxOutputTokens: 1400,
  });

  const parsed = parseOptimizerJson(generated.text);
  if (!parsed || parsed.description.length < 50) {
    throw new ServiceUnavailableError(
      "AI returned an incomplete job description. Please try again.",
      "AI_EMPTY_RESPONSE",
    );
  }

  await logAiUsage({
    userId: input.userId,
    feature: "job_description",
    model: generated.model,
    entityType: "job",
    entityId: input.jobId,
    metadata: { mode: input.mode },
    promptTokens: generated.promptTokens,
    completionTokens: generated.completionTokens,
    totalTokens: generated.totalTokens,
  });

  return {
    ...parsed,
    mode: input.mode,
    model: generated.model,
  };
}
