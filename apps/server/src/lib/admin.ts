import { db } from "@lets_work/db";
import { platformUser } from "@lets_work/db/schema/platform";
import { eq } from "drizzle-orm";

export class AdminForbiddenError extends Error {
  constructor() {
    super("Admin access required");
    this.name = "AdminForbiddenError";
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
