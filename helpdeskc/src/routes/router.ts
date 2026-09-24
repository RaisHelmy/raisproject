import type { Env, RequestData } from "./env";

export type RouteHandler = (
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  params: Record<string, string>,
  data: RequestData,
) => Promise<Response>;

interface Route {
  method: string;
  segments: string[]; // e.g. ["api", "tickets", ":id"]
  handler: RouteHandler;
}

/**
 * Deliberately hand-rolled instead of pulling in a routing library — the
 * route table is small and this keeps bundle size and dependency count
 * down (CLAUDE.md §15: no new dependency without justifying it).
 */
export class Router {
  private routes: Route[] = [];

  private add(method: string, pattern: string, handler: RouteHandler) {
    this.routes.push({ method, segments: pattern.split("/").filter(Boolean), handler });
  }

  get(pattern: string, handler: RouteHandler) { this.add("GET", pattern, handler); }
  post(pattern: string, handler: RouteHandler) { this.add("POST", pattern, handler); }
  put(pattern: string, handler: RouteHandler) { this.add("PUT", pattern, handler); }
  delete(pattern: string, handler: RouteHandler) { this.add("DELETE", pattern, handler); }

  match(method: string, pathname: string): { handler: RouteHandler; params: Record<string, string> } | null {
    const pathSegments = pathname.split("/").filter(Boolean);
    for (const route of this.routes) {
      if (route.method !== method) continue;
      if (route.segments.length !== pathSegments.length) continue;

      const params: Record<string, string> = {};
      let matched = true;
      for (let i = 0; i < route.segments.length; i++) {
        const seg = route.segments[i]!;
        if (seg.startsWith(":")) {
          params[seg.slice(1)] = pathSegments[i]!;
        } else if (seg !== pathSegments[i]) {
          matched = false;
          break;
        }
      }
      if (matched) return { handler: route.handler, params };
    }
    return null;
  }
}
