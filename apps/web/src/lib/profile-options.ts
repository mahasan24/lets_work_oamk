export type ProfileOption = {
  value: string;
  label: string;
};

export const COUNTRIES: ProfileOption[] = [
  { value: "AF", label: "Afghanistan" },
  { value: "AL", label: "Albania" },
  { value: "DZ", label: "Algeria" },
  { value: "AR", label: "Argentina" },
  { value: "AU", label: "Australia" },
  { value: "AT", label: "Austria" },
  { value: "BD", label: "Bangladesh" },
  { value: "BE", label: "Belgium" },
  { value: "BR", label: "Brazil" },
  { value: "BG", label: "Bulgaria" },
  { value: "CA", label: "Canada" },
  { value: "CL", label: "Chile" },
  { value: "CN", label: "China" },
  { value: "CO", label: "Colombia" },
  { value: "HR", label: "Croatia" },
  { value: "CZ", label: "Czech Republic" },
  { value: "DK", label: "Denmark" },
  { value: "EG", label: "Egypt" },
  { value: "EE", label: "Estonia" },
  { value: "FI", label: "Finland" },
  { value: "FR", label: "France" },
  { value: "DE", label: "Germany" },
  { value: "GH", label: "Ghana" },
  { value: "GR", label: "Greece" },
  { value: "HK", label: "Hong Kong" },
  { value: "HU", label: "Hungary" },
  { value: "IN", label: "India" },
  { value: "ID", label: "Indonesia" },
  { value: "IE", label: "Ireland" },
  { value: "IL", label: "Israel" },
  { value: "IT", label: "Italy" },
  { value: "JP", label: "Japan" },
  { value: "KE", label: "Kenya" },
  { value: "KR", label: "South Korea" },
  { value: "LV", label: "Latvia" },
  { value: "LT", label: "Lithuania" },
  { value: "MY", label: "Malaysia" },
  { value: "MX", label: "Mexico" },
  { value: "NP", label: "Nepal" },
  { value: "NL", label: "Netherlands" },
  { value: "NZ", label: "New Zealand" },
  { value: "NG", label: "Nigeria" },
  { value: "NO", label: "Norway" },
  { value: "PK", label: "Pakistan" },
  { value: "PH", label: "Philippines" },
  { value: "PL", label: "Poland" },
  { value: "PT", label: "Portugal" },
  { value: "RO", label: "Romania" },
  { value: "RU", label: "Russia" },
  { value: "SA", label: "Saudi Arabia" },
  { value: "RS", label: "Serbia" },
  { value: "SG", label: "Singapore" },
  { value: "SK", label: "Slovakia" },
  { value: "SI", label: "Slovenia" },
  { value: "ZA", label: "South Africa" },
  { value: "ES", label: "Spain" },
  { value: "LK", label: "Sri Lanka" },
  { value: "SE", label: "Sweden" },
  { value: "CH", label: "Switzerland" },
  { value: "TW", label: "Taiwan" },
  { value: "TH", label: "Thailand" },
  { value: "TR", label: "Turkey" },
  { value: "UA", label: "Ukraine" },
  { value: "AE", label: "United Arab Emirates" },
  { value: "GB", label: "United Kingdom" },
  { value: "US", label: "United States" },
  { value: "VN", label: "Vietnam" },
];

export const CURRENCIES: ProfileOption[] = [
  { value: "USD", label: "USD — US Dollar" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "GBP", label: "GBP — British Pound" },
  { value: "CAD", label: "CAD — Canadian Dollar" },
  { value: "AUD", label: "AUD — Australian Dollar" },
  { value: "NZD", label: "NZD — New Zealand Dollar" },
  { value: "CHF", label: "CHF — Swiss Franc" },
  { value: "JPY", label: "JPY — Japanese Yen" },
  { value: "CNY", label: "CNY — Chinese Yuan" },
  { value: "INR", label: "INR — Indian Rupee" },
  { value: "NPR", label: "NPR — Nepalese Rupee" },
  { value: "PKR", label: "PKR — Pakistani Rupee" },
  { value: "BDT", label: "BDT — Bangladeshi Taka" },
  { value: "SGD", label: "SGD — Singapore Dollar" },
  { value: "HKD", label: "HKD — Hong Kong Dollar" },
  { value: "AED", label: "AED — UAE Dirham" },
  { value: "SAR", label: "SAR — Saudi Riyal" },
  { value: "ZAR", label: "ZAR — South African Rand" },
  { value: "BRL", label: "BRL — Brazilian Real" },
  { value: "MXN", label: "MXN — Mexican Peso" },
  { value: "SEK", label: "SEK — Swedish Krona" },
  { value: "NOK", label: "NOK — Norwegian Krone" },
  { value: "DKK", label: "DKK — Danish Krone" },
  { value: "PLN", label: "PLN — Polish Zloty" },
  { value: "TRY", label: "TRY — Turkish Lira" },
  { value: "KRW", label: "KRW — South Korean Won" },
  { value: "PHP", label: "PHP — Philippine Peso" },
  { value: "THB", label: "THB — Thai Baht" },
  { value: "IDR", label: "IDR — Indonesian Rupiah" },
  { value: "MYR", label: "MYR — Malaysian Ringgit" },
];

const FALLBACK_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Amsterdam",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Kathmandu",
  "Asia/Dhaka",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Shanghai",
  "Australia/Sydney",
];

export function getTimezoneOptions(): ProfileOption[] {
  const zones =
    typeof Intl !== "undefined" && "supportedValuesOf" in Intl
      ? Intl.supportedValuesOf("timeZone")
      : FALLBACK_TIMEZONES;

  return zones.map((zone) => ({
    value: zone,
    label: zone.replace(/_/g, " "),
  }));
}

export function getCountryLabel(code: string | null | undefined) {
  if (!code) return null;
  return COUNTRIES.find((c) => c.value === code)?.label ?? code;
}

export function getCurrencyLabel(code: string | null | undefined) {
  if (!code) return null;
  return CURRENCIES.find((c) => c.value === code)?.label ?? code;
}

export function resolveCountryValue(stored: string | null | undefined) {
  if (!stored) return "";
  if (COUNTRIES.some((country) => country.value === stored)) return stored;
  const byLabel = COUNTRIES.find(
    (country) => country.label.toLowerCase() === stored.toLowerCase(),
  );
  return byLabel?.value ?? stored;
}

export const SKILL_SUGGESTIONS = [
  "JavaScript",
  "TypeScript",
  "React",
  "Next.js",
  "Node.js",
  "Python",
  "Django",
  "FastAPI",
  "PostgreSQL",
  "MongoDB",
  "AWS",
  "Docker",
  "Kubernetes",
  "Figma",
  "UI/UX Design",
  "Tailwind CSS",
  "GraphQL",
  "REST APIs",
  "Elysia",
  "Vue.js",
  "Angular",
  "Java",
  "Spring Boot",
  "C#",
  ".NET",
  "PHP",
  "Laravel",
  "Ruby on Rails",
  "Go",
  "Rust",
  "Mobile Development",
  "React Native",
  "Flutter",
  "SEO",
  "Content Writing",
  "Data Analysis",
  "Machine Learning",
  "DevOps",
  "Project Management",
];

export const AVAILABILITY_OPTIONS = [
  { value: "available", label: "Available" },
  { value: "limited", label: "Limited availability" },
  { value: "unavailable", label: "Not available" },
] as const;
