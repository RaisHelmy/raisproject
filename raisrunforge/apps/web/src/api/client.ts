import type { ApiResponse } from "@runforge/shared";

/**
 * API origin. Unset (dev) → relative `/api` served by the Vite proxy. The
 * production build sets VITE_API_URL to the runforge-api Worker origin because
 * the Pages site and the API live on different hosts.
 */
const BASE = `${import.meta.env.VITE_API_URL ?? ""}/api`;

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

/**
 * Bearer token minted by `POST /api/auth/login` or the super-admin SSO
 * endpoint (`GET /api/auth/sso`, which stores it under this exact key). Sent
 * as `Authorization: Bearer <token>` on every request while present.
 */
export const TOKEN_STORAGE_KEY = "runforge_token";
export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}
export function setAuthToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token);
    else localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
}

let demoRole: string | null = null;
export function setDemoRole(role: string | null) {
  demoRole = role;
  if (role) localStorage.setItem("runforge_demo_role", role);
  else localStorage.removeItem("runforge_demo_role");
}
export function getDemoRole(): string | null {
  if (demoRole) return demoRole;
  return localStorage.getItem("runforge_demo_role");
}

async function request<T>(method: string, path: string, body?: unknown, retried = false): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const role = getDemoRole();
  if (role) headers["X-RunForge-Demo-Role"] = role;
  const token = getAuthToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && token && !retried) {
    // The stored bearer token is no longer valid (expired, revoked, or the
    // in-memory demo world restarted). Drop it and retry once without it.
    setAuthToken(null);
    return request<T>(method, path, body, true);
  }
  const json = (await res.json()) as ApiResponse<T>;
  if (!res.ok || "error" in json) {
    const err = "error" in json ? json.error : { code: "UNKNOWN", message: `Request failed (${res.status})` };
    throw new ApiError(err.code, err.message, err.details);
  }
  return json.data;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
};
