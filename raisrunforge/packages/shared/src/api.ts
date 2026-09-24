/** Consistent REST envelope (spec: API response format). */
export interface ApiSuccess<T> {
  data: T;
  meta: ApiMeta;
}

export interface ApiMeta {
  requestId?: string;
  mode?: "demo" | "production";
  simulated?: boolean;
  total?: number;
  page?: number;
  pageSize?: number;
  [key: string]: unknown;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export function isApiError(value: unknown): value is ApiError {
  return typeof value === "object" && value !== null && "error" in value;
}

export interface OverviewSummary {
  counts: {
    projects: number;
    applications: number;
    servers: number;
    containers: number;
    databases: number;
    deploymentsToday: number;
    healthy: number;
    degraded: number;
    failed: number;
  };
  availabilityPercent: number;
  allHealthy: boolean;
}

export interface SearchResult {
  type:
    | "project"
    | "application"
    | "server"
    | "container"
    | "database"
    | "domain"
    | "deployment"
    | "event"
    | "incident";
  id: string;
  title: string;
  subtitle?: string;
  status?: string;
  href: string;
}
