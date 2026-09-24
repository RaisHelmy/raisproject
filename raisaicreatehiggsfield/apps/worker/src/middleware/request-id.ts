import type { MiddlewareHandler } from "hono";
import { newId } from "@raisai/shared";
import { Logger } from "../lib/logger";

export type AppVariables = { requestId: string; logger: Logger };

export const requestId = (): MiddlewareHandler<{ Variables: AppVariables }> => async (c, next) => {
  const id = c.req.header("x-request-id") ?? newId();
  c.set("requestId", id);
  c.set("logger", new Logger({ requestId: id, path: c.req.path, method: c.req.method }));
  c.header("x-request-id", id);
  await next();
};
