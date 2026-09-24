export class AppError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 400, public readonly details?: unknown, public readonly reference?: string) {
    super(message); this.name = "AppError";
  }
}
export const Errors = {
  unauthorized: (msg = "Please sign in to continue.") => new AppError("UNAUTHORIZED", msg, 401),
  forbidden: (msg = "You don't have permission to do that.") => new AppError("FORBIDDEN", msg, 403),
  notFound: (what = "Record") => new AppError("NOT_FOUND", `${what} not found.`, 404),
  validation: (msg: string, details?: unknown) => new AppError("VALIDATION_ERROR", msg, 400, details),
  conflict: (msg: string) => new AppError("CONFLICT", msg, 409),
  rateLimited: (msg = "Too many requests. Please try again shortly.") => new AppError("RATE_LIMITED", msg, 429),
  tooLarge: (max: number) => new AppError("FILE_TOO_LARGE", `File exceeds the ${Math.round(max / 1048576)} MB upload limit.`, 413),
  unsupported: (msg: string) => new AppError("UNSUPPORTED", msg, 415),
  /** Plan gate. `required_plan` lets the UI render the upgrade dialog. */
  upgradeRequired: (msg: string, required_plan: string | null, feature: string) => new AppError("UPGRADE_REQUIRED", msg, 402, { required_plan, feature }),
  quota: (msg: string, details?: unknown) => new AppError("QUOTA_EXCEEDED", msg, 429, details),
  provider: (msg: string, reference: string) => new AppError("AI_PROVIDER_ERROR", msg, 502, undefined, reference),
  notConfigured: (msg: string) => new AppError("NOT_CONFIGURED", msg, 503),
};
