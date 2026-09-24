export type DomainErrorCode =
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "UNAUTHORIZED"
  | "VALIDATION_FAILED"
  | "CONFLICT"
  | "DEPLOYMENT_FAILED"
  | "PROVIDER_ERROR"
  | "CONFIRMATION_REQUIRED"
  | "NOT_IMPLEMENTED";

const HTTP_STATUS: Record<DomainErrorCode, number> = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  UNAUTHORIZED: 401,
  VALIDATION_FAILED: 400,
  CONFLICT: 409,
  DEPLOYMENT_FAILED: 500,
  PROVIDER_ERROR: 502,
  CONFIRMATION_REQUIRED: 428,
  NOT_IMPLEMENTED: 501,
};

/** Errors thrown by the domain layer. Transport layers map them to responses. */
export class DomainError extends Error {
  readonly status: number;
  constructor(
    readonly code: DomainErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "DomainError";
    this.status = HTTP_STATUS[code];
  }

  static notFound(resource: string, id: string): DomainError {
    return new DomainError("NOT_FOUND", `${resource} ${id} not found`, { resource, id });
  }
  static forbidden(message = "You do not have permission to perform this action", details?: Record<string, unknown>): DomainError {
    return new DomainError("FORBIDDEN", message, details);
  }
  static validation(message: string, details?: Record<string, unknown>): DomainError {
    return new DomainError("VALIDATION_FAILED", message, details);
  }
}

export function assertString(value: unknown, field: string, opts: { min?: number; max?: number; pattern?: RegExp } = {}): string {
  if (typeof value !== "string") throw DomainError.validation(`${field} is required`, { field });
  const v = value.trim();
  if (opts.min !== undefined && v.length < opts.min) throw DomainError.validation(`${field} must be at least ${opts.min} characters`, { field });
  if (opts.max !== undefined && v.length > opts.max) throw DomainError.validation(`${field} must be at most ${opts.max} characters`, { field });
  if (opts.pattern && !opts.pattern.test(v)) throw DomainError.validation(`${field} has an invalid format`, { field });
  return v;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
