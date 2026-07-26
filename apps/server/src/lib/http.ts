/**
 * Shared HTTP helpers for routes: a standard way to run an action and map
 * expected errors, plus consistent pagination utilities.
 */
import { mapAppError, type ErrorBody } from "./errors";

type ActionResult<T> = { ok: true; data: T } | { ok: false; status: number; body: ErrorBody };

/**
 * Runs an action and converts expected {@link AppError}s into a `{ ok: false }`
 * result the route can hand to `status(...)`. Unexpected errors are rethrown so
 * the global `onError` handler can log them and return a 500.
 */
export async function runAction<T>(action: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await action() };
  } catch (error) {
    const mapped = mapAppError(error);
    if (mapped) {
      return { ok: false, status: mapped.status, body: mapped.body };
    }
    throw error;
  }
}

/**
 * Like {@link runAction}, but runs a guard (e.g. `requireHirerProfile`) before
 * the action. The guard's access errors are mapped the same way.
 */
export async function runGuardedAction<T>(
  guard: () => Promise<unknown>,
  action: () => Promise<T>,
): Promise<ActionResult<T>> {
  return runAction(async () => {
    await guard();
    return action();
  });
}

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type Paginated<T> = {
  items: T[];
  pagination: PaginationMeta;
};

/**
 * Normalizes raw page/limit input into safe, clamped values plus a SQL offset.
 */
export function resolvePagination(
  input?: { page?: number; limit?: number },
  options?: { defaultLimit?: number; maxLimit?: number },
) {
  const defaultLimit = options?.defaultLimit ?? 20;
  const maxLimit = options?.maxLimit ?? 100;

  const page = Math.max(Math.trunc(input?.page ?? 1), 1);
  const limit = Math.min(Math.max(Math.trunc(input?.limit ?? defaultLimit), 1), maxLimit);
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

/**
 * Builds the standard pagination envelope shared by every list endpoint.
 */
export function buildPaginationMeta(page: number, limit: number, total: number): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
  };
}
