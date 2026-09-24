/** The error shape every RaisAI endpoint returns. */
export interface ErrorBody {
  code: string;
  message: string;
  action?: string;
  details?: unknown;
}

export class RaisAIError extends Error {
  readonly code: string;
  readonly status: number;
  readonly action?: string;
  readonly details?: unknown;
  readonly requestId?: string;

  constructor(body: ErrorBody, status: number, requestId?: string) {
    super(body.action ? `${body.message} ${body.action}` : body.message);
    this.name = "RaisAIError";
    this.code = body.code;
    this.status = status;
    this.action = body.action;
    this.details = body.details;
    this.requestId = requestId;
  }

  /** True when trying again unchanged could reasonably succeed. */
  get retryable(): boolean {
    return ["rate_limited", "provider_timeout", "provider_error", "internal"].includes(this.code);
  }
}

/** Not enough balance. Carries what it would have cost and what was available. */
export class InsufficientBalanceError extends RaisAIError {
  readonly estimatedSen: number;
  readonly availableSen: number;

  constructor(body: ErrorBody, status: number, requestId?: string) {
    super(body, status, requestId);
    this.name = "InsufficientBalanceError";
    const details = (body.details ?? {}) as { estimatedSen?: number; availableSen?: number };
    this.estimatedSen = details.estimatedSen ?? 0;
    this.availableSen = details.availableSen ?? 0;
  }
}
