export class ApiHttpError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const notFound = (message = "Not found") => new ApiHttpError(404, "NOT_FOUND", message);
export const unauthorized = (message = "Unauthorized") =>
  new ApiHttpError(401, "UNAUTHORIZED", message);
export const forbidden = (message = "Forbidden") => new ApiHttpError(403, "FORBIDDEN", message);
export const badRequest = (message: string, details?: unknown) =>
  new ApiHttpError(400, "VALIDATION", message, details);
export const conflict = (message: string) => new ApiHttpError(409, "CONFLICT", message);
