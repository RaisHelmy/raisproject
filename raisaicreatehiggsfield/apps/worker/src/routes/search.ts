import { Hono } from "hono";
import { AppError, hasScope } from "@raisai/shared";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import { SearchService, type SearchKind } from "../services/search-service";

export const search = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

search.get("/search", requireAuth(), async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "projects:read")) throw new AppError("insufficient_scope", "This token cannot search.");
  const query = c.req.query("q") ?? "";
  const kinds = c.req.queries("kind") as SearchKind[] | undefined;

  const results = await new SearchService(c.env).search(auth, query, {
    limit: c.req.query("limit") ? Number(c.req.query("limit")) : undefined,
    kinds: kinds?.length ? kinds : undefined,
  });
  return c.json({ items: results, query });
});
