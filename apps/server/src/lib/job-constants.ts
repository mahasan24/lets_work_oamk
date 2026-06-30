export const JOB_CATEGORY_SUGGESTIONS = [
  "Web Development",
  "Mobile Development",
  "UI/UX Design",
  "Graphic Design",
  "Content Writing",
  "Digital Marketing",
  "SEO",
  "Data Science",
  "Machine Learning",
  "DevOps",
  "Cloud Engineering",
  "Video Editing",
  "Animation",
  "Customer Support",
  "Virtual Assistant",
  "Accounting",
  "Legal",
  "Architecture",
  "Engineering",
  "Product Management",
] as const;

export const SUPPORTED_CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD"] as const;

export function mergeJobCategories(hirerCategories: string[] | null | undefined) {
  const merged = new Set<string>(JOB_CATEGORY_SUGGESTIONS);

  if (Array.isArray(hirerCategories)) {
    for (const category of hirerCategories) {
      const trimmed = category?.trim();
      if (trimmed) merged.add(trimmed);
    }
  }

  return [...merged].sort((a, b) => a.localeCompare(b));
}
