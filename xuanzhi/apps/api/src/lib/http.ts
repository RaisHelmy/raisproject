import type { Context } from "hono";
import type { ApiFailure, ApiSuccess } from "@xuanzhi/shared-types";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export function ok<T>(c: Context, data: T, warnings?: string[], status: ContentfulStatusCode = 200) {
  const body: ApiSuccess<T> = { success: true, data, ...(warnings?.length ? { warnings } : {}) };
  return c.json(body, status);
}
export function fail(c: Context, code: string, message: string, status: ContentfulStatusCode = 400, reference?: string, details?: unknown) {
  const body: ApiFailure = { success: false, error: { code, message, ...(reference ? { reference } : {}), ...(details ? { details } : {}) } };
  return c.json(body, status);
}
export interface PageQuery { page: number; page_size: number; offset: number }
export function parsePage(q: Record<string, string | undefined>, defaultSize = 25, max = 200): PageQuery {
  const page = Math.max(1, Number(q.page ?? "1") || 1);
  const page_size = Math.min(max, Math.max(1, Number(q.page_size ?? String(defaultSize)) || defaultSize));
  return { page, page_size, offset: (page - 1) * page_size };
}
export function clientIp(c: Context): string | null { return c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? null; }
