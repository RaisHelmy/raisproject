// Typed domain errors, mapped to HTTP only at the edge (src/routes/). Never
// throw strings (CLAUDE.md §15).
export abstract class DomainError extends Error {
  abstract readonly code: string;
  abstract readonly httpStatus: number;
}

export class NotFoundError extends DomainError {
  readonly code = "not_found";
  readonly httpStatus = 404;
  constructor(entity: string) {
    super(`${entity} not found`);
  }
}

export class ValidationError extends DomainError {
  readonly code = "validation_error";
  readonly httpStatus = 422;
  constructor(message: string, readonly fieldErrors?: Array<{ key: string; message: string }>) {
    super(message);
  }
}

export class UnauthenticatedError extends DomainError {
  readonly code = "unauthenticated";
  readonly httpStatus = 401;
  constructor(message = "Authentication required") {
    super(message);
  }
}

export class ForbiddenError extends DomainError {
  readonly code = "forbidden";
  readonly httpStatus = 403;
  constructor(message = "Not authorised") {
    super(message);
  }
}

export class ConflictError extends DomainError {
  readonly code = "conflict";
  readonly httpStatus = 409;
  constructor(message: string) {
    super(message);
  }
}
