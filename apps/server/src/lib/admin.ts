import { db } from "@lets_work/db";
import { platformUser } from "@lets_work/db/schema/platform";
import { eq } from "drizzle-orm";

import { ForbiddenError } from "./errors";

export class AdminForbiddenError extends ForbiddenError {
  constructor() {
    super("Admin access required", "ADMIN_ACCESS_REQUIRED");
  }
}

export async function requireAdmin(userId: string) {
  const [row] = await db
    .select()
    .from(platformUser)
    .where(eq(platformUser.userId, userId))
    .limit(1);

  if (!row || row.role !== "admin") {
    throw new AdminForbiddenError();
  }

  return row;
}

export async function isAdmin(userId: string) {
  try {
    await requireAdmin(userId);
    return true;
  } catch {
    return false;
  }
}
