import type { Context, MiddlewareHandler } from "hono";
import type { ZodSchema } from "zod";
import type { AppEnv } from "../types";
import { badRequest } from "../lib/errors";

type Target = "json" | "query" | "param";

const store = new WeakMap<Request, Record<string, unknown>>();

export function zValidator<S extends ZodSchema>(
  target: Target,
  schema: S,
): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const raw =
      target === "json"
        ? await c.req.json().catch(() => ({}))
        : target === "query"
          ? c.req.query()
          : c.req.param();

    const result = schema.safeParse(raw);
    if (!result.success) {
      throw badRequest("Invalid input", result.error.flatten());
    }
    const bucket = store.get(c.req.raw) ?? {};
    bucket[target] = result.data;
    store.set(c.req.raw, bucket);
    await next();
  };
}

export function getValidated<T>(c: Context<AppEnv>, target: Target): T {
  const bucket = store.get(c.req.raw);
  return (bucket?.[target] ?? {}) as T;
}
