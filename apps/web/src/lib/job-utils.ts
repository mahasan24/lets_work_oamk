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
