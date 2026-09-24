import { tenantDb } from "../../db/client";
import { verifySsoToken } from "../../core/auth/sso";
import { createAgentSession } from "./agent-login";
import type { RouteHandler } from "../router";

/**
 * GET /api/auth/sso?token=…
 *
 * Super-admin single sign-on from the saas.raishelmy.uk landing page. The
 * tenant is resolved from the Host header exactly like every other request
 * (CLAUDE.md §6), the agent is looked up by email *within that tenant*
 * (§7: never by email alone), and the session is minted by the same
 * createAgentSession() the password login uses — no second session type.
 *
 * Failure responses are short plain text (the browser lands here directly,
 * not the SPA's fetch wrapper), and never include stack traces.
 */
export const agentSso: RouteHandler = async (request, env, _ctx, _params, data) => {
  const secret = env.SAAS_SSO_SECRET;
  if (!secret) return text("SSO is not configured", 503);

  const token = new URL(request.url).searchParams.get("token");
  if (!token) return text("Missing token", 400);

  const verified = await verifySsoToken(token, secret);
  if (!verified) return text("Invalid or expired token", 401);

  if (data.tenant.billingState === "suspended") {
    // Same rule as password login (CLAUDE.md §12).
    return text("This account is suspended", 403);
  }

  const db = tenantDb(env.HYPERDRIVE, data.tenantId);
  const agent = await db.agents.findByEmail(verified.email);
  if (!agent) return text("No agent with that email in this tenant", 403);

  const cookie = await createAgentSession(env, data, agent.id);

  // Where the SPA sends an agent after a normal login (src/ui/pages/AgentLogin.tsx).
  return new Response(null, {
    status: 302,
    headers: {
      Location: "/tickets",
      "Set-Cookie": cookie,
      "Cache-Control": "no-store",
    },
  });
};

function text(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
