import { tenantDb } from "../../db/client";
import { clearSessionCookie, jsonResponse } from "../cookies";
import type { RouteHandler } from "../router";

export const logout: RouteHandler = async (_request, env, _ctx, _params, data) => {
  if (data.session) {
    const db = tenantDb(env.HYPERDRIVE, data.tenantId);
    await db.sessions.revoke(data.session.id);
  }
  return jsonResponse({ ok: true }, { status: 200, headers: { "Set-Cookie": clearSessionCookie() } });
};
