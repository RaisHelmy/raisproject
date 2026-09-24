import { DomainError } from "../core/errors";
import { AuthzError } from "../core/authz";
import { jsonResponse } from "./cookies";

/** The one place domain errors become HTTP responses (CLAUDE.md §15). */
export function toErrorResponse(err: unknown): Response {
  if (err instanceof DomainError) {
    return jsonResponse({ error: err.code, message: err.message }, { status: err.httpStatus });
  }
  if (err instanceof AuthzError) {
    return jsonResponse({ error: "forbidden", message: err.message }, { status: 403 });
  }
  console.error(err);
  return jsonResponse({ error: "internal_error", message: "Something went wrong" }, { status: 500 });
}
