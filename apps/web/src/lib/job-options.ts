export const SUPPORTED_CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD"] as const;

export const BUDGET_TYPE_OPTIONS = [
  { value: "one_time", label: "Fixed price" },
  { value: "hourly", label: "Hourly rate" },
] as const;

export const EXPERIENCE_LEVEL_OPTIONS = [
  { value: "entry", label: "Entry level" },
  { value: "intermediate", label: "Intermediate" },
  { value: "expert", label: "Expert" },
] as const;

export const ESTIMATED_DURATION_OPTIONS = [
  { value: "less_than_month", label: "Less than 1 month" },
  { value: "one_to_three_months", label: "1–3 months" },
  { value: "three_to_six_months", label: "3–6 months" },
  { value: "more_than_six_months", label: "More than 6 months" },
] as const;

export const POSTED_WITHIN_OPTIONS = [
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
] as const;

export const JOB_SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "budget_high", label: "Highest budget" },
] as const;

export const JOB_STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "open", label: "Open" },
  { value: "in_review", label: "In review" },
  { value: "paused", label: "Paused" },
  { value: "filled", label: "Filled" },
  { value: "closed", label: "Closed" },
  { value: "cancelled", label: "Cancelled" },
] as const;

export type JobStatus = (typeof JOB_STATUS_OPTIONS)[number]["value"];
export type BudgetType = (typeof BUDGET_TYPE_OPTIONS)[number]["value"];
export type ExperienceLevel = (typeof EXPERIENCE_LEVEL_OPTIONS)[number]["value"];
export type EstimatedDuration = (typeof ESTIMATED_DURATION_OPTIONS)[number]["value"];

export function getJobStatusLabel(status: JobStatus) {
  return JOB_STATUS_OPTIONS.find((item) => item.value === status)?.label ?? status;
}

export function getExperienceLevelLabel(value: ExperienceLevel | null | undefined) {
  if (!value) return "Not specified";
  return EXPERIENCE_LEVEL_OPTIONS.find((item) => item.value === value)?.label ?? value;
}

export function getDurationLabel(value: EstimatedDuration | null | undefined) {
  if (!value) return "Not specified";
  return ESTIMATED_DURATION_OPTIONS.find((item) => item.value === value)?.label ?? value;
}

export function getBudgetTypeLabel(value: BudgetType) {
  return BUDGET_TYPE_OPTIONS.find((item) => item.value === value)?.label ?? value;
}
