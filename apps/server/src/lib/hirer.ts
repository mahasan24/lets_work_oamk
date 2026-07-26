import { marketplaceUserProfile } from "@lets_work/db/schema/marketplace";

import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "./errors";
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

export class HirerAccessError extends ForbiddenError {
  constructor() {
    super("Hirer account required", "HIRER_ACCESS_REQUIRED");
  }
}

export class JobNotFoundError extends NotFoundError {
  constructor() {
    super("Job not found", "JOB_NOT_FOUND");
  }
}

export class JobForbiddenError extends ForbiddenError {
  constructor(message = "You do not have access to this job") {
    super(message, "JOB_FORBIDDEN");
  }
}

export class JobValidationError extends ValidationError {
  constructor(errors: string[]) {
    super(errors, undefined, "JOB_VALIDATION");
  }
}

export class JobStatusError extends ConflictError {
  constructor(message: string) {
    super(message, "JOB_STATUS");
  }
}
