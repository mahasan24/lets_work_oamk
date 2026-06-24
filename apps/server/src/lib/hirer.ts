import { marketplaceUserProfile } from "@lets_work/db/schema/marketplace";

import { ensureProfile } from "./profile";

function isHirerProfile(profile: typeof marketplaceUserProfile.$inferSelect) {
  return profile.accountType === "hirer" || profile.activeRole === "hirer";
}

export async function requireHirerProfile(userId: string) {
  const profile = await ensureProfile(userId);

  if (!isHirerProfile(profile)) {
    throw new HirerAccessError();
  }

  return profile;
}

export class HirerAccessError extends Error {
  constructor() {
    super("Hirer account required");
    this.name = "HirerAccessError";
  }
}

export class JobNotFoundError extends Error {
  constructor() {
    super("Job not found");
    this.name = "JobNotFoundError";
  }
}

export class JobForbiddenError extends Error {
  constructor(message = "You do not have access to this job") {
    super(message);
    this.name = "JobForbiddenError";
  }
}

export class JobValidationError extends Error {
  errors: string[];

  constructor(errors: string[]) {
    super(errors.join("; "));
    this.name = "JobValidationError";
    this.errors = errors;
  }
}

export class JobStatusError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JobStatusError";
  }
}
