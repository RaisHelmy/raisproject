/** Error codes are snake_case and stable; clients and MCP agents branch on them. */
export const ErrorCodes = {
  internal: "internal",
  not_found: "not_found",
  validation_failed: "validation_failed",
  unauthorized: "unauthorized",
  forbidden: "forbidden",
  permission_denied: "permission_denied",
  insufficient_scope: "insufficient_scope",
  rate_limited: "rate_limited",
  conflict: "conflict",
  idempotency_conflict: "idempotency_conflict",
  insufficient_balance: "insufficient_balance",
  invalid_input: "invalid_input",
  model_not_found: "model_not_found",
  model_not_enabled: "model_not_enabled",
  model_incompatible: "model_incompatible",
  unsupported_parameter: "unsupported_parameter",
  workflow_invalid: "workflow_invalid",
  workflow_limit_exceeded: "workflow_limit_exceeded",
  budget_exceeded: "budget_exceeded",
  provider_error: "provider_error",
  provider_timeout: "provider_timeout",
  cancelled: "cancelled",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export const defaultStatusForCode: Record<ErrorCode, number> = {
  internal: 500,
  not_found: 404,
  validation_failed: 400,
  unauthorized: 401,
  forbidden: 403,
  permission_denied: 403,
  insufficient_scope: 403,
  rate_limited: 429,
  conflict: 409,
  idempotency_conflict: 409,
  insufficient_balance: 402,
  invalid_input: 400,
  model_not_found: 404,
  model_not_enabled: 400,
  model_incompatible: 400,
  unsupported_parameter: 400,
  workflow_invalid: 400,
  workflow_limit_exceeded: 400,
  budget_exceeded: 402,
  provider_error: 502,
  provider_timeout: 504,
  cancelled: 409,
};

export interface AppErrorOptions {
  /** Suggested next step for the user, e.g. "Choose a model that supports image input." */
  action?: string;
  status?: number;
  details?: unknown;
  cause?: unknown;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly action?: string;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, opts: AppErrorOptions = {}) {
    super(message, opts.cause ? { cause: opts.cause } : undefined);
    this.name = "AppError";
    this.code = code;
    this.status = opts.status ?? defaultStatusForCode[code];
    this.action = opts.action;
    this.details = opts.details;
  }

  toJSON(): ErrorEnvelope {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.action ? { action: this.action } : {}),
        ...(this.details !== undefined ? { details: this.details } : {}),
      },
    };
  }
}

export interface ErrorEnvelope {
  error: { code: ErrorCode; message: string; action?: string; details?: unknown };
}

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}
