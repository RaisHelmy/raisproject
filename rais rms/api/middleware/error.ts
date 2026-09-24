import type { ErrorHandler } from "hono";
import { ZodError } from "zod";
import type { AppEnv } from "../types";
import { ApiHttpError } from "../lib/errors";

export const errorHandler: ErrorHandler<AppEnv> = (err, c) => {
  if (err instanceof ApiHttpError) {
    return c.json(
      { ok: false, error: { code: err.code, message: err.message, details: err.details } },
      err.status as 400,
    );
  }
  if (err instanceof ZodError) {
    return c.json(
      {
        ok: false,
        error: { code: "VALIDATION", message: "Invalid input", details: err.flatten() },
      },
      400,
    );
  }
  console.error(`[${c.get("requestId") ?? "?"}]`, err);
  return c.json(
    { ok: false, error: { code: "INTERNAL", message: "Unexpected error" } },
    500,
  );
};
