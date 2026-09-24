import type { Context } from "hono";
import type { ApiError, ApiMeta } from "@runforge/shared";
import { DomainError } from "@runforge/domain";

export function ok<T>(c: Context, data: T, meta: ApiMeta = {}, status: 200 | 201 = 200) {
  return c.json({ data, meta: { mode: "demo", requestId: c.get("requestId"), ...meta } }, status);
}

export function fail(c: Context, err: unknown) {
  if (err instanceof DomainError) {
    const body: ApiError = { error: { code: err.code, message: err.message, details: err.details } };
    return c.json(body, err.status as never);
  }
  console.error(err);
  const body: ApiError = { error: { code: "INTERNAL_ERROR", message: err instanceof Error ? err.message : "Internal error" } };
  return c.json(body, 500);
}
