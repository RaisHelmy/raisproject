export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
    public readonly details?: unknown,
    public readonly reference?: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const Errors = {
  unauthorized: (msg = "Please sign in to continue.") => new AppError("UNAUTHORIZED", msg, 401),
  forbidden: (msg = "You don't have permission to do that.") => new AppError("FORBIDDEN", msg, 403),
  notFound: (what = "Record") => new AppError("NOT_FOUND", `${what} not found.`, 404),
  validation: (msg: string, details?: unknown) => new AppError("VALIDATION_ERROR", msg, 400, details),
  conflict: (msg: string) => new AppError("CONFLICT", msg, 409),
  rateLimited: () => new AppError("RATE_LIMITED", "Too many requests. Please try again shortly.", 429),
  invalidState: (msg: string) => new AppError("INVALID_STATE", msg, 409),
  tooLarge: (max: number) => new AppError("FILE_TOO_LARGE", `File exceeds the ${Math.round(max / 1048576)} MB upload limit.`, 413),
  unsupported: (msg: string) => new AppError("UNSUPPORTED", msg, 415),
  jira: (msg: string, reference: string, code = "JIRA_SYNC_FAILED") => new AppError(code, msg, 502, undefined, reference),
  internal: (reference: string) => new AppError("INTERNAL_ERROR", "Something went wrong. Please try again.", 500, undefined, reference),
};
