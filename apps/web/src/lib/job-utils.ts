export function formatRelativeJobDate(value: string | null | undefined) {
  if (!value) return "Not published";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";

  const diffMs = date.getTime() - Date.now();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

  if (Math.abs(diffDays) < 1) {
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    if (Math.abs(diffHours) < 1) return "Just now";
    return rtf.format(diffHours, "hour");
  }

  if (Math.abs(diffDays) < 30) {
    return rtf.format(diffDays, "day");
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatBudgetRange(job: {
  budgetType: "hourly" | "one_time";
  currency: string;
  budgetMin: string | null;
  budgetMax: string | null;
  hourlyRateMin: string | null;
  hourlyRateMax: string | null;
}) {
  const symbol = job.currency === "USD" ? "$" : job.currency;

  if (job.budgetType === "hourly") {
    if (job.hourlyRateMin && job.hourlyRateMax) {
      return `${symbol}${job.hourlyRateMin}–${symbol}${job.hourlyRateMax}/hr`;
    }
    return "Hourly rate not set";
  }

  if (job.budgetMin && job.budgetMax) {
    return `${symbol}${job.budgetMin}–${symbol}${job.budgetMax}`;
  }

  return "Budget not set";
}

export function formatJobMetaLine(job: {
  budgetType: "hourly" | "one_time";
  currency: string;
  budgetMin: string | null;
  budgetMax: string | null;
  hourlyRateMin: string | null;
  hourlyRateMax: string | null;
  experienceLevel: "entry" | "intermediate" | "expert" | null;
  estimatedDuration:
    | "less_than_month"
    | "one_to_three_months"
    | "three_to_six_months"
    | "more_than_six_months"
    | null;
}) {
  const budgetLabel = job.budgetType === "hourly" ? "Hourly" : "Fixed-price";
  const experience =
    job.experienceLevel === "entry"
      ? "Entry level"
      : job.experienceLevel === "intermediate"
        ? "Intermediate"
        : job.experienceLevel === "expert"
          ? "Expert"
          : null;

  const duration =
    job.estimatedDuration === "less_than_month"
      ? "< 1 month"
      : job.estimatedDuration === "one_to_three_months"
        ? "1–3 months"
        : job.estimatedDuration === "three_to_six_months"
          ? "3–6 months"
          : job.estimatedDuration === "more_than_six_months"
            ? "6+ months"
            : null;

  return [budgetLabel, experience, formatBudgetRange(job), duration].filter(Boolean).join(" · ");
}
