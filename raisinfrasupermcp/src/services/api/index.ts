import type { ApiClient } from "./client";
import { DemoClient } from "./demoClient";
import { HttpClient } from "./httpClient";

/**
 * Mode selection: `VITE_API_MODE=connected` (or ?mode=connected) uses the Worker; otherwise the app runs in DEMO mode.
 */
export function createApiClient(): ApiClient {
  const param = new URLSearchParams(window.location.search).get("mode");
  const mode = param ?? import.meta.env.VITE_API_MODE ?? localStorage.getItem("supermcp.mode") ?? "demo";
  if (param) localStorage.setItem("supermcp.mode", param);
  return mode === "connected" ? new HttpClient() : new DemoClient();
}
export * from "./client";
