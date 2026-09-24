import type { MiddlewareHandler } from "hono";
import { AppError } from "@raisai/shared";
import type { Env } from "../env";
import type { AuthVariables } from "./auth";

export const requireAdmin = (): MiddlewareHandler<{ Bindings: Env; Variables: AuthVariables }> => async (c, next) => {
  const auth = c.get("auth");
  if (!auth) throw new AppError("unauthorized", "Sign in to continue.");
  if (!auth.isAdmin) throw new AppError("forbidden", "This action requires an administrator account.");
  await next();
};
