/**
 * Centralized error handling for the API.
 *
 * Every expected failure should be represented as an {@link AppError} (or one of
 * its subclasses). Routes never map status codes by hand anymore — they either
 * let the error bubble up to the global `onError` handler or run their logic
 * through the helpers in `./http`, both of which funnel through
 * {@link mapAppError}. Unknown/unexpected errors fall through to a generic 500.
 */

export type ErrorBody = {
  error: string;
  code: string;
  errors?: string[];
};

export type MappedError = {
  status: number;
  body: ErrorBody;
};

/**
 * Base class for all expected, client-facing errors. Carries the HTTP status,
 * a stable machine-readable `code`, and optional field-level `details`.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: string[];

  constructor(message: string, options: { status: number; code: string; details?: string[] }) {
    super(message);
    this.name = new.target.name;
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Bad request", code = "BAD_REQUEST") {
    super(message, { status: 400, code });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized", code = "UNAUTHORIZED") {
    super(message, { status: 401, code });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden", code = "FORBIDDEN") {
    super(message, { status: 403, code });
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found", code = "NOT_FOUND") {
    super(message, { status: 404, code });
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict", code = "CONFLICT") {
    super(message, { status: 409, code });
  }
}

export class ValidationError extends AppError {
  constructor(details: string[], message?: string, code = "VALIDATION") {
    super(message ?? details.join("; ") ?? "Validation failed", {
      status: 422,
      code,
      details,
    });
  }
}

/**
 * Maps an {@link AppError} to a response payload. Returns `null` for anything
 * else so callers can decide how to treat unexpected errors (typically a 500).
 */
export function mapAppError(error: unknown): MappedError | null {
  if (error instanceof AppError) {
    return {
      status: error.status,
      body: {
        error: error.message,
        code: error.code,
        ...(error.details && error.details.length > 0 ? { errors: error.details } : {}),
      },
    };
  }

  return null;
}

/**
 * Resolves any thrown value into a response payload, logging unexpected errors.
 * Used by the global `onError` handler as the last line of defense.
 */
export function resolveError(error: unknown): MappedError {
  const mapped = mapAppError(error);
  if (mapped) return mapped;

  // Keep console fallback so logging works even if pino isn't loaded yet.
  console.error("[api] Unhandled error:", error);

  return {
    status: 500,
    body: { error: "Internal server error", code: "INTERNAL_SERVER_ERROR" },
  };
}
