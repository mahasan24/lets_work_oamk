import { getCountryLabel } from "./profile-options";

const AVAILABILITY_LABELS = {
  available: "Available now",
  limited: "Limited availability",
  unavailable: "Not available",
} as const;

export function getAvailabilityLabel(status: keyof typeof AVAILABILITY_LABELS) {
  return AVAILABILITY_LABELS[status];
}

export function formatHourlyRate(rate: string | null, currency: string) {
  if (!rate) return null;

  const amount = Number(rate);
  if (!Number.isFinite(amount)) return null;

  try {
    const formatted = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
    return `${formatted}/hr`;
  } catch {
    return `${amount} ${currency}/hr`;
  }
}

export function formatRating(rating: string | null) {
  if (!rating) return null;

  const value = Number(rating);
  return Number.isFinite(value) ? value.toFixed(1) : null;
}

export function formatLocation(country: string | null, city: string | null) {
  return [city, getCountryLabel(country)].filter(Boolean).join(", ") || null;
}

export function formatMonthYear(value: string | null) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

export function formatDateRange(start: string | null, end: string | null, isCurrent: boolean) {
  const from = formatMonthYear(start);
  if (!from) return isCurrent ? "Present" : null;

  return `${from} – ${isCurrent ? "Present" : (formatMonthYear(end) ?? "Present")}`;
}
