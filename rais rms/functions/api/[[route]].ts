import { app } from "../../api/app";
import type { Bindings } from "../../api/types";
import { createDbFromHyperdrive } from "../../api/lib/db";

export const onRequest: PagesFunction<Omit<Bindings, "DB">> = (context) => {
  // Derive the D1-shaped `DB` from the real `HYPERDRIVE` binding. See
  // api/lib/db.ts for why the rest of the app still talks to `env.DB`.
  const env: Bindings = {
    ...context.env,
    DB: createDbFromHyperdrive(context.env.HYPERDRIVE),
  };
  return app.fetch(context.request, env, context as unknown as ExecutionContext);
};
