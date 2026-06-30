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

export function mergeJobCategorySuggestions(profileCategories?: string[] | null) {
  const merged = new Set<string>(JOB_CATEGORY_SUGGESTIONS);

  if (Array.isArray(profileCategories)) {
    for (const category of profileCategories) {
      const trimmed = category?.trim();
      if (trimmed) merged.add(trimmed);
    }
  }

  return [...merged].sort((a, b) => a.localeCompare(b));
}

export const COMPANY_SIZE_OPTIONS = [
  { value: "1", label: "Just me" },
  { value: "2-10", label: "2–10 employees" },
  { value: "11-50", label: "11–50 employees" },
  { value: "51-200", label: "51–200 employees" },
  { value: "201-500", label: "201–500 employees" },
  { value: "500+", label: "500+ employees" },
] as const;

export const HIRER_TYPE_OPTIONS = [
  { value: "individual", label: "Individual client" },
  { value: "company", label: "Company / organization" },
] as const;
