/**
 * Seed marketplace demo data for thesis flow testing.
 *
 * Creates:
 *   - 2 hirers with complete, verified profiles
 *   - 20 freelancers with complete, verified profiles
 *   - 35 open jobs across the two hirers
 *
 * Usage:
 *   bun run db:seed
 *   SEED_FORCE=1 bun run db:seed   # wipe previous @seed.letswork.local users first
 *
 * Writes credentials to SEED_CREDENTIALS.md at the repo root.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { hashPassword } from "better-auth/crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, like, inArray, and } from "drizzle-orm";

import { account, user } from "../schema/auth";
import { certification } from "../schema/certifications";
import { job } from "../schema/jobs";
import { marketplaceUserProfile } from "../schema/marketplace";
import { portfolioItem, workHistory } from "../schema/portfolio";
import { userVerification } from "../schema/verification";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../../..");

config({ path: path.resolve(repoRoot, "apps/server/.env") });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required (load apps/server/.env or export it)");
  process.exit(1);
}

const FORCE = process.env.SEED_FORCE === "1" || process.env.SEED_FORCE === "true";
const SEED_DOMAIN = "seed.letswork.local";
const SHARED_PASSWORD = "SeedPass123!";

const CATEGORIES = [
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
  "Product Management",
  "Customer Support",
] as const;

const SKILL_POOLS = [
  ["React", "TypeScript", "Node.js", "PostgreSQL", "Tailwind CSS"],
  ["Python", "Django", "FastAPI", "PostgreSQL", "Docker"],
  ["Figma", "UI/UX Design", "Tailwind CSS", "Framer", "Prototyping"],
  ["React Native", "Flutter", "TypeScript", "Firebase", "Mobile Development"],
  ["AWS", "Docker", "Kubernetes", "Terraform", "DevOps"],
  ["Content Writing", "SEO", "Copywriting", "WordPress", "Marketing"],
  ["Machine Learning", "Python", "TensorFlow", "Data Analysis", "Pandas"],
  ["Vue.js", "Nuxt", "TypeScript", "GraphQL", "REST APIs"],
  ["Go", "Rust", "PostgreSQL", "gRPC", "Microservices"],
  ["PHP", "Laravel", "MySQL", "Vue.js", "REST APIs"],
] as const;

const FREELANCER_NAMES = [
  "Ava Chen",
  "Noah Patel",
  "Mia Rossi",
  "Liam Okonkwo",
  "Sofia Bergman",
  "Ethan Nakamura",
  "Isla Fernandes",
  "Lucas Meyer",
  "Amelia Dubois",
  "Owen Kim",
  "Harper Singh",
  "Elijah Costa",
  "Chloe Andersson",
  "Mason Silva",
  "Ella Johansson",
  "James Rivera",
  "Grace Müller",
  "Benjamin Torres",
  "Zoe Nguyen",
  "Henry Ali",
] as const;

const COUNTRIES = ["US", "GB", "CA", "DE", "FI", "NP", "BD", "IN", "AU", "NL"] as const;
const CITIES = [
  "New York",
  "London",
  "Toronto",
  "Berlin",
  "Helsinki",
  "Kathmandu",
  "Dhaka",
  "Bangalore",
  "Sydney",
  "Amsterdam",
] as const;
const TIMEZONES = [
  "America/New_York",
  "Europe/London",
  "America/Toronto",
  "Europe/Berlin",
  "Europe/Helsinki",
  "Asia/Kathmandu",
  "Asia/Dhaka",
  "Asia/Kolkata",
  "Australia/Sydney",
  "Europe/Amsterdam",
] as const;

const JOB_TITLES = [
  "Build a marketing landing page in React",
  "Design a mobile app UI kit in Figma",
  "Set up CI/CD with GitHub Actions and Docker",
  "Write SEO blog posts for a SaaS product",
  "Develop a REST API with Node.js and Postgres",
  "Create brand identity and logo variants",
  "Implement Stripe checkout for a marketplace",
  "Build a React Native MVP for bookings",
  "Migrate legacy PHP app to Laravel",
  "Data cleaning and dashboard in Python",
  "Hire a DevOps engineer for AWS hardening",
  "Produce product demo videos",
  "UX research and wireframes for onboarding",
  "Automate reporting with Python scripts",
  "Build an admin analytics dashboard",
  "Optimize Core Web Vitals on Next.js site",
  "Create email templates and nurture sequences",
  "Implement role-based access control",
  "Design illustration set for help center",
  "Ship a GraphQL API for mobile clients",
  "Audit and improve SEO technical setup",
  "Prototype an AI chat assistant UI",
  "Containerize services with Kubernetes",
  "Write API documentation and developer guides",
  "Build a job board filter and search UX",
  "Integrate Cloudinary media uploads",
  "Create a freelancer portfolio theme",
  "Set up monitoring with alerts and dashboards",
  "Develop a milestone escrow payment flow UI",
  "Refactor TypeScript monorepo tooling",
  "Design dark-mode component library",
  "Build notification center with websockets",
  "Create onboarding flow for dual-role users",
  "Implement proposal shortlist and hire UX",
  "Performance tune PostgreSQL queries",
] as const;

type CredentialRow = {
  role: "hirer" | "freelancer";
  name: string;
  email: string;
  password: string;
};

const db = drizzle(databaseUrl);
const passwordHash = await hashPassword(SHARED_PASSWORD);

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function createJobSlug(title: string) {
  return `${slugify(title).slice(0, 60) || "job"}-${crypto.randomUUID().slice(0, 8)}`;
}

async function wipeSeedUsers() {
  const seedUsers = await db
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(like(user.email, `%@${SEED_DOMAIN}`));

  if (seedUsers.length === 0) {
    console.log("No previous seed users to wipe.");
    return;
  }

  const ids = seedUsers.map((row) => row.id);
  await db.delete(user).where(inArray(user.id, ids));
  console.log(`Wiped ${ids.length} previous seed users (@${SEED_DOMAIN}).`);
}

async function ensureUser(input: {
  email: string;
  name: string;
}): Promise<{ userId: string; created: boolean }> {
  const email = input.email.toLowerCase();
  const [existing] = await db.select().from(user).where(eq(user.email, email)).limit(1);

  if (existing) {
    await db
      .update(user)
      .set({ name: input.name, emailVerified: true })
      .where(eq(user.id, existing.id));

    const [cred] = await db
      .select()
      .from(account)
      .where(and(eq(account.userId, existing.id), eq(account.providerId, "credential")))
      .limit(1);

    if (cred) {
      await db.update(account).set({ password: passwordHash }).where(eq(account.id, cred.id));
    } else {
      await db.insert(account).values({
        id: crypto.randomUUID(),
        accountId: existing.id,
        providerId: "credential",
        userId: existing.id,
        password: passwordHash,
      });
    }

    return { userId: existing.id, created: false };
  }

  const userId = crypto.randomUUID();
  await db.insert(user).values({
    id: userId,
    name: input.name,
    email,
    emailVerified: true,
  });
  await db.insert(account).values({
    id: crypto.randomUUID(),
    accountId: userId,
    providerId: "credential",
    userId,
    password: passwordHash,
  });

  return { userId, created: true };
}

async function ensureIdentityVerified(userId: string) {
  const [existing] = await db
    .select()
    .from(userVerification)
    .where(and(eq(userVerification.userId, userId), eq(userVerification.type, "identity")))
    .limit(1);

  if (existing) {
    await db
      .update(userVerification)
      .set({
        status: "verified",
        label: "Seed identity verification",
        verifiedAt: new Date(),
      })
      .where(eq(userVerification.id, existing.id));
    return;
  }

  await db.insert(userVerification).values({
    id: crypto.randomUUID(),
    userId,
    type: "identity",
    status: "verified",
    label: "Seed identity verification",
    verifiedAt: new Date(),
  });
}

async function upsertHirerProfile(
  userId: string,
  input: {
    name: string;
    companyName: string;
    headline: string;
    index: number;
  },
) {
  const country = COUNTRIES[input.index % COUNTRIES.length]!;
  const city = CITIES[input.index % CITIES.length]!;
  const timezone = TIMEZONES[input.index % TIMEZONES.length]!;
  const categories = [...CATEGORIES].slice(0, 6);

  const values = {
    accountType: "hirer" as const,
    activeRole: "hirer" as const,
    onboardingStep: "complete" as const,
    profileCompletion: 100,
    headline: input.headline,
    bio: `${input.companyName} hires freelancers for product, design, and engineering work. We value clear communication, reliable delivery, and transparent milestones.`,
    jobCategories: categories,
    hirerType: "company" as const,
    companyName: input.companyName,
    companyWebsite: `https://example.com/${slugify(input.companyName)}`,
    companyDescription: `${input.companyName} is a product studio that partners with specialists across design, engineering, and growth. Seeded for thesis marketplace demos.`,
    companySize: "11-50",
    phoneNumber: `+1555000${String(100 + input.index).padStart(4, "0")}`,
    currency: "USD",
    country,
    city,
    location: `${city}, ${country}`,
    timezone,
    avatarUrl: null,
  };

  const [existing] = await db
    .select()
    .from(marketplaceUserProfile)
    .where(eq(marketplaceUserProfile.userId, userId))
    .limit(1);

  if (existing) {
    await db
      .update(marketplaceUserProfile)
      .set(values)
      .where(eq(marketplaceUserProfile.userId, userId));
  } else {
    await db.insert(marketplaceUserProfile).values({ userId, ...values });
  }

  await ensureIdentityVerified(userId);
}

async function upsertFreelancerProfile(userId: string, input: { name: string; index: number }) {
  const skills = [...SKILL_POOLS[input.index % SKILL_POOLS.length]!];
  const country = COUNTRIES[input.index % COUNTRIES.length]!;
  const city = CITIES[input.index % CITIES.length]!;
  const timezone = TIMEZONES[input.index % TIMEZONES.length]!;
  const primarySkill = skills[0] ?? "Software";
  const rate = (35 + (input.index % 12) * 5).toFixed(2);

  const values = {
    accountType: "freelancer" as const,
    activeRole: "freelancer" as const,
    onboardingStep: "complete" as const,
    profileCompletion: 100,
    headline: `${primarySkill} specialist · ${skills.slice(0, 3).join(" · ")}`,
    bio: `Hi, I'm ${input.name}. I help clients ship production-ready work with clear milestones and weekly updates. My focus areas include ${skills.join(", ")}. Available for remote contracts and happy to start with a short discovery call.`,
    skills,
    currency: "USD",
    hourlyRate: rate,
    country,
    city,
    location: `${city}, ${country}`,
    timezone,
    availabilityStatus: "available" as const,
    hoursPerWeek: 20 + (input.index % 4) * 5,
    avgRating: (4.2 + (input.index % 8) * 0.1).toFixed(2),
    reviewCount: 3 + (input.index % 10),
    jobsCompleted: 5 + (input.index % 15),
    phoneNumber: `+1555100${String(100 + input.index).padStart(4, "0")}`,
    avatarUrl: null,
  };

  const [existing] = await db
    .select()
    .from(marketplaceUserProfile)
    .where(eq(marketplaceUserProfile.userId, userId))
    .limit(1);

  if (existing) {
    await db
      .update(marketplaceUserProfile)
      .set(values)
      .where(eq(marketplaceUserProfile.userId, userId));
  } else {
    await db.insert(marketplaceUserProfile).values({ userId, ...values });
  }

  await ensureIdentityVerified(userId);

  // Refresh portfolio / experience / certs for a complete-looking profile.
  await db.delete(portfolioItem).where(eq(portfolioItem.userId, userId));
  await db.delete(workHistory).where(eq(workHistory.userId, userId));
  await db.delete(certification).where(eq(certification.userId, userId));

  await db.insert(portfolioItem).values([
    {
      id: crypto.randomUUID(),
      userId,
      title: `${primarySkill} case study`,
      description: `End-to-end delivery showcasing ${skills.slice(0, 3).join(", ")} for a client product launch.`,
      projectUrl: `https://example.com/projects/${slugify(input.name)}-1`,
      sortOrder: 0,
    },
    {
      id: crypto.randomUUID(),
      userId,
      title: "Open-source contribution",
      description: `Utilities and docs around ${skills[1] ?? primarySkill}.`,
      projectUrl: `https://example.com/projects/${slugify(input.name)}-2`,
      sortOrder: 1,
    },
  ]);

  await db.insert(workHistory).values({
    id: crypto.randomUUID(),
    userId,
    title: `${primarySkill} Freelancer`,
    company: "Independent",
    description: `Delivered client projects involving ${skills.join(", ")}.`,
    startDate: new Date("2021-01-01"),
    endDate: null,
    isCurrent: true,
    sortOrder: 0,
  });

  await db.insert(certification).values({
    id: crypto.randomUUID(),
    userId,
    name: `${primarySkill} Professional Certificate`,
    issuer: "Lets Work Seed Academy",
    issueDate: new Date("2023-06-01"),
    credentialId: `SEED-${input.index + 1}`,
    sortOrder: 0,
  });
}

async function seedJobsForHirer(hirerUserId: string, titles: string[]) {
  // Replace previous open seed jobs for this hirer to keep counts predictable.
  await db.delete(job).where(eq(job.hirerUserId, hirerUserId));

  const now = new Date();
  const rows = titles.map((title, index) => {
    const category = CATEGORIES[index % CATEGORIES.length]!;
    const skillSet = [...SKILL_POOLS[index % SKILL_POOLS.length]!];
    const isHourly = index % 3 !== 0;
    const budgetMin = isHourly ? null : (800 + index * 120).toFixed(2);
    const budgetMax = isHourly ? null : (1500 + index * 180).toFixed(2);
    const hourlyMin = isHourly ? (25 + (index % 10) * 5).toFixed(2) : null;
    const hourlyMax = isHourly ? (45 + (index % 10) * 5).toFixed(2) : null;

    return {
      id: crypto.randomUUID(),
      hirerUserId,
      title,
      slug: createJobSlug(title),
      description: [
        `We are looking for help on: ${title}.`,
        "",
        "Scope",
        `- Deliver production-ready work in ${category.toLowerCase()}`,
        `- Collaborate asynchronously with clear weekly updates`,
        `- Preferred skills: ${skillSet.join(", ")}`,
        "",
        "This job was created by the thesis seed script for end-to-end marketplace testing.",
      ].join("\n"),
      category,
      requiredSkills: skillSet,
      budgetType: isHourly ? ("hourly" as const) : ("one_time" as const),
      budgetMin,
      budgetMax,
      hourlyRateMin: hourlyMin,
      hourlyRateMax: hourlyMax,
      remoteOnly: true,
      country: null,
      currency: "USD",
      experienceLevel: (["entry", "intermediate", "expert"] as const)[index % 3]!,
      estimatedDuration: (
        [
          "less_than_month",
          "one_to_three_months",
          "three_to_six_months",
          "more_than_six_months",
        ] as const
      )[index % 4]!,
      weeklyHours: isHourly ? 10 + (index % 4) * 5 : null,
      preferredTimezone: TIMEZONES[index % TIMEZONES.length]!,
      tags: [category, ...skillSet.slice(0, 2)],
      attachments: [],
      status: "open" as const,
      proposalsCount: 0,
      publishedAt: now,
    };
  });

  if (rows.length > 0) {
    await db.insert(job).values(rows);
  }

  return rows.length;
}

function writeCredentialsDoc(rows: CredentialRow[], jobCount: number) {
  const lines = [
    "# Seed credentials (thesis demo)",
    "",
    "Generated by `bun run db:seed`. Do not use these accounts in real production with live Stripe keys.",
    "",
    `**Shared password for all seed accounts:** \`${SHARED_PASSWORD}\``,
    "",
    `**Jobs seeded:** ${jobCount} open jobs`,
    "",
    "## Hirers",
    "",
    "| Name | Email | Password | Sign-in |",
    "|------|-------|----------|---------|",
    ...rows
      .filter((row) => row.role === "hirer")
      .map(
        (row) =>
          `| ${row.name} | \`${row.email}\` | \`${row.password}\` | \`/login\` → hirer dashboard |`,
      ),
    "",
    "## Freelancers",
    "",
    "| # | Name | Email | Password |",
    "|---|------|-------|----------|",
    ...rows
      .filter((row) => row.role === "freelancer")
      .map(
        (row, index) => `| ${index + 1} | ${row.name} | \`${row.email}\` | \`${row.password}\` |`,
      ),
    "",
    "## Notes",
    "",
    "- All seed users are **email verified** and **identity verified**.",
    "- Profiles are marked `onboardingStep: complete` with filled portfolio / experience / certs (freelancers).",
    "- Re-run with `SEED_FORCE=1 bun run db:seed` to wipe `@seed.letswork.local` users and recreate.",
    "- Admin scaffold (separate): `bun run db:scaffold-admin` → `admin@letswork.local` / `Admin123!` at `/admin/login`.",
    "",
  ];

  const outPath = path.resolve(repoRoot, "SEED_CREDENTIALS.md");
  try {
    fs.writeFileSync(outPath, lines.join("\n"), "utf8");
    return outPath;
  } catch (error) {
    console.warn("Could not write SEED_CREDENTIALS.md (ok in Docker):", error);
    return outPath;
  }
}

if (FORCE) {
  await wipeSeedUsers();
}

const credentials: CredentialRow[] = [];

const hirers = [
  {
    name: "Nora Blake",
    email: `hirer1@${SEED_DOMAIN}`,
    companyName: "Northbeam Studio",
    headline: "Hiring product & engineering freelancers",
  },
  {
    name: "Kai Mendoza",
    email: `hirer2@${SEED_DOMAIN}`,
    companyName: "Bright Harbor Co",
    headline: "Hiring design, content, and growth specialists",
  },
] as const;

const hirerIds: string[] = [];

for (const [index, hirer] of hirers.entries()) {
  const { userId, created } = await ensureUser({ email: hirer.email, name: hirer.name });
  await upsertHirerProfile(userId, {
    name: hirer.name,
    companyName: hirer.companyName,
    headline: hirer.headline,
    index,
  });
  hirerIds.push(userId);
  credentials.push({
    role: "hirer",
    name: hirer.name,
    email: hirer.email,
    password: SHARED_PASSWORD,
  });
  console.log(`${created ? "Created" : "Updated"} hirer ${hirer.email}`);
}

for (const [index, name] of FREELANCER_NAMES.entries()) {
  const email = `freelancer${String(index + 1).padStart(2, "0")}@${SEED_DOMAIN}`;
  const { userId, created } = await ensureUser({ email, name });
  await upsertFreelancerProfile(userId, { name, index });
  credentials.push({
    role: "freelancer",
    name,
    email,
    password: SHARED_PASSWORD,
  });
  console.log(`${created ? "Created" : "Updated"} freelancer ${email}`);
}

const jobsForHirer1 = JOB_TITLES.slice(0, 18);
const jobsForHirer2 = JOB_TITLES.slice(18, 35);
const jobCount =
  (await seedJobsForHirer(hirerIds[0]!, [...jobsForHirer1])) +
  (await seedJobsForHirer(hirerIds[1]!, [...jobsForHirer2]));

const credentialsPath = writeCredentialsDoc(credentials, jobCount);

console.log("");
console.log(`Seed complete: 2 hirers, ${FREELANCER_NAMES.length} freelancers, ${jobCount} jobs.`);
console.log(`Credentials written to ${credentialsPath}`);
console.log(`Shared password: ${SHARED_PASSWORD}`);
process.exit(0);
