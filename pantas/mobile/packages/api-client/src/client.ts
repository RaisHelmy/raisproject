import { getStoredSessionId } from "./tokenStore";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * Set per-app via EXPO_PUBLIC_API_BASE_URL (Expo inlines EXPO_PUBLIC_* env
 * vars at build time) — e.g. https://pantas.<subdomain>.workers.dev, or a
 * LAN IP (not "localhost") for local dev on a physical device.
 */
function getBaseUrl(): string {
  const url = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (!url) {
    throw new Error(
      "EXPO_PUBLIC_API_BASE_URL is not set — add it to the app's .env before making API calls",
    );
  }
  return url.replace(/\/$/, "");
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const sessionId = await getStoredSessionId();
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (sessionId) headers["Authorization"] = `Bearer ${sessionId}`;

  const res = await fetch(`${getBaseUrl()}/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiError(res.status, (data && data.error) || `HTTP ${res.status}`);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body ?? {}),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body ?? {}),
};
