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
  {
    name: "Hirer Proposals",
    description: "Hirer proposal review, shortlisting, messaging, and hiring",
  },
  {
    name: "Contracts",
    description: "Contract listing, details, completion, and cancellation",
  },
  {
    name: "Milestones",
    description: "Milestone planning, submissions, and approval on active contracts",
  },
  {
    name: "Payments",
    description: "Stripe Checkout funding and milestone escrow",
  },
  {
    name: "Invoices",
    description: "Milestone escrow invoices and printable HTML receipts",
  },
  {
    name: "Reviews",
    description: "Contract reviews and public reputation",
  },
  {
    name: "Disputes",
    description: "Contract disputes raised by hirers or freelancers",
  },
  {
    name: "Notifications",
    description: "In-app notifications and unread state",
  },
  {
    name: "Realtime",
    description: "Authenticated websocket event gateway",
  },
  {
    name: "Chat",
    description: "Conversation threads, message delivery, and read state",
  },
] as const;

export const COOKIE_AUTH_SECURITY = [{ cookieAuth: [] }];
