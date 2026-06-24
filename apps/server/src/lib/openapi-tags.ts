export const OPENAPI_TAGS = [
  {
    name: "Health",
    description: "Service health and availability checks",
  },
  {
    name: "Better Auth",
    description: "Sign-up, sign-in, sessions, and password recovery",
  },
  {
    name: "Profile",
    description: "Marketplace profile, portfolio, certifications, and uploads",
  },
  {
    name: "Jobs",
    description: "Public job catalog and reference data",
  },
  {
    name: "Hirer Jobs",
    description: "Hirer job drafts, publishing, and lifecycle management",
  },
] as const;

export const COOKIE_AUTH_SECURITY = [{ cookieAuth: [] }];
