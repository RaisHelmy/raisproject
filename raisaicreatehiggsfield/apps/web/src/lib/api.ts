import { AppError, type ErrorEnvelope, type ErrorCode } from "@raisai/shared";
import { withCsrf } from "./csrf";

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const merged = withCsrf(init);
  const res = await fetch(`/api/v1${path}`, {
    credentials: "same-origin",
    headers: { "content-type": "application/json", ...(merged.headers ?? {}) },
    ...merged,
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const env = body as ErrorEnvelope | null;
    throw new AppError((env?.error.code ?? "internal") as ErrorCode, env?.error.message ?? res.statusText, {
      action: env?.error.action, status: res.status, details: env?.error.details,
    });
  }
  return body as T;
}
