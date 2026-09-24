import type { Context, Env as HonoEnv } from "hono";
import { AppError, isAppError } from "@raisai/shared";
import { ZodError } from "zod";
import type { AppVariables } from "./request-id";

export function errorHandler<E extends HonoEnv & { Variables: AppVariables }>(err: unknown, c: Context<E>): Response {
  const logger = c.get("logger") as AppVariables["logger"] | undefined;
  if (isAppError(err)) {
    if (err.status >= 500) logger?.error("request.error", { code: err.code, message: err.message });
    return c.json(err.toJSON(), err.status as 400);
  }
  if (err instanceof ZodError) {
    const e = new AppError("validation_failed", "Request validation failed.", {
      action: "Fix the highlighted fields and try again.",
      details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
    return c.json(e.toJSON(), 400);
  }
  logger?.error("request.unhandled", { message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined });
  const e = new AppError("internal", "Something went wrong on our side.", { action: "Try again. If it keeps failing, contact support with the request id." });
  return c.json(e.toJSON(), 500);
}
