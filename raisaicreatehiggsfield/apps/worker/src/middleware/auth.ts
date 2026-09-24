import type { MiddlewareHandler } from "hono";
import { AppError, SCOPES, type AuthContext } from "@raisai/shared";
import type { Env } from "../env";
import type { AppVariables } from "./request-id";
import { SESSION_COOKIE, parseCookies, verifySignedValue } from "../auth/cookies";
import { CredentialService } from "../services/credential-service";
import { SessionRepository } from "../repositories/sessions";
import { UserRepository } from "../repositories/users";
import { OrganizationRepository } from "../repositories/organizations";

export type AuthVariables = AppVariables & { auth: AuthContext };

/** Populates `auth` from the session cookie. Does not require it — see requireAuth. */
export const attachAuth = (): MiddlewareHandler<{ Bindings: Env; Variables: AuthVariables }> => async (c, next) => {
  const secret = c.env.SESSION_SECRET ?? "dev-insecure-secret";
  const cookies = parseCookies(c.req.header("cookie") ?? null);
  const raw = cookies[SESSION_COOKIE];
  const requestId = c.get("requestId");

  // A bearer credential identifies API and MCP callers. Checked first so a
  // stale browser cookie cannot shadow an explicit key.
  const authorization = c.req.header("authorization");
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    const secret = authorization.slice(7).trim();
    const context = await new CredentialService(c.env).authenticate(secret, requestId);
    if (context) {
      c.set("auth", context);
      await next();
      return;
    }
    throw new AppError("unauthorized", "That API key is not valid.", {
      action: "Check the key, or create a new one in Developer settings.",
    });
  }

  if (raw) {
    const sessionId = await verifySignedValue(secret, raw);
    if (sessionId) {
      const sessions = new SessionRepository(c.env);
      const session = await sessions.findValid(sessionId);
      if (session) {
        const users = new UserRepository(c.env);
        const orgs = new OrganizationRepository(c.env);
        const [user, org] = await Promise.all([
          users.findById(session.user_id),
          orgs.findDefaultForUser(session.user_id),
        ]);
        if (user && org) {
          c.set("auth", {
            userId: user.id,
            orgId: org.id,
            actorType: "user",
            scopes: SCOPES,
            requestId,
            isAdmin: user.role === "admin",
            credentialId: session.id,
          });
        }
      }
    }
  }
  await next();
};

/** Route guard: 401s if attachAuth did not find a valid session. Api key / MCP auth land in tasks 2.4-2.5. */
export const requireAuth = (): MiddlewareHandler<{ Bindings: Env; Variables: AuthVariables }> => async (c, next) => {
  if (!c.get("auth")) {
    throw new AppError("unauthorized", "Sign in to continue.", { action: "Log in and try again." });
  }
  await next();
};
