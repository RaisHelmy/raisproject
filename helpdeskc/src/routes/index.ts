import { resolveTenantForHost } from "../db/tenant-resolution";
import { platformDb } from "../db/platform-client";
import { tenantDb } from "../db/client";
import { hashToken, SESSION_COOKIE_NAME } from "../core/auth/tokens";
import { toErrorResponse } from "./error-response";
import { Router } from "./router";
import type { Env, RequestData } from "./env";

import { agentLogin } from "./api/agent-login";
import { agentSso } from "./api/agent-sso";
import { requestMagicLink } from "./api/contact-magic-link";
import { verifyMagicLink } from "./api/contact-magic-link-verify";
import { contactPasswordLogin } from "./api/contact-password-login";
import { setContactPassword } from "./api/contact-set-password";
import { logout } from "./api/logout";
import { getCurrentSession } from "./api/auth-me";
import { listTemplates } from "./api/templates-list";
import { listTickets } from "./api/tickets-list";
import { createTicket } from "./api/tickets-create";
import { getTicket } from "./api/ticket-get";
import { createTicketMessage } from "./api/ticket-messages";
import { transitionTicket } from "./api/ticket-transition";
import { presignAttachmentUpload } from "./api/attachment-presign";
import { finalizeAttachmentUpload } from "./api/attachment-finalize";
import { downloadAttachment } from "./api/attachment-download";

import { listAccounts } from "./api/accounts-list";
import { createAccount } from "./api/accounts-create";
import { getAccount } from "./api/account-get";
import { updateAccount } from "./api/account-update";
import { createTeam } from "./api/account-teams-create";
import { updateTeam } from "./api/team-update";
import { createContact } from "./api/account-contacts-create";
import { updateContact } from "./api/contact-update";

import { listRoles } from "./api/roles-list";
import { createRole } from "./api/roles-create";
import { updateRole } from "./api/role-update";
import { archiveRole } from "./api/role-archive";

import { listAgents } from "./api/agents-list";
import { inviteAgent } from "./api/agent-invite";
import { acceptAgentInvite } from "./api/agent-accept-invite";
import { assignAgentRole, removeAgentRole } from "./api/agent-roles";

import { createTemplate } from "./api/templates-create";
import { getTemplate } from "./api/template-get";
import { createTemplateVersion } from "./api/template-new-version";
import { archiveTemplate } from "./api/template-archive";

import { handleEmailQueue } from "../jobs/queue-consumers/email";
import type { EmailJob } from "../jobs/email";
import { runSlaBreachCheck } from "../jobs/cron/sla-breach";
import { runAutoCloseResolved } from "../jobs/cron/auto-close";

export { TicketSequence } from "../durable-objects/ticket-sequence";

const router = new Router();
router.post("/api/auth/agent/login", agentLogin);
router.get("/api/auth/sso", agentSso);
router.post("/api/auth/contact/magic-link", requestMagicLink);
router.post("/api/auth/contact/magic-link/verify", verifyMagicLink);
router.post("/api/auth/contact/password-login", contactPasswordLogin);
router.post("/api/auth/contact/set-password", setContactPassword);
router.post("/api/auth/logout", logout);
router.get("/api/auth/me", getCurrentSession);
router.post("/api/auth/agent/accept-invite", acceptAgentInvite);
router.get("/api/templates", listTemplates);

router.get("/api/tickets", listTickets);
router.post("/api/tickets", createTicket);
router.get("/api/tickets/:id", getTicket);
router.post("/api/tickets/:id/messages", createTicketMessage);
router.post("/api/tickets/:id/transition", transitionTicket);
router.post("/api/tickets/:id/attachments/presign", presignAttachmentUpload);
router.post("/api/tickets/:id/attachments/finalize", finalizeAttachmentUpload);
router.get("/api/attachments/:id/download", downloadAttachment);

router.get("/api/accounts", listAccounts);
router.post("/api/accounts", createAccount);
router.get("/api/accounts/:id", getAccount);
router.put("/api/accounts/:id", updateAccount);
router.post("/api/accounts/:id/teams", createTeam);
router.put("/api/teams/:id", updateTeam);
router.post("/api/accounts/:id/contacts", createContact);
router.put("/api/contacts/:id", updateContact);

router.get("/api/roles", listRoles);
router.post("/api/roles", createRole);
router.put("/api/roles/:id", updateRole);
router.delete("/api/roles/:id", archiveRole);

router.get("/api/agents", listAgents);
router.post("/api/agents", inviteAgent);
router.post("/api/agents/:id/roles", assignAgentRole);
router.delete("/api/agents/:id/roles/:roleId", removeAgentRole);

router.post("/api/templates", createTemplate);
router.get("/api/templates/:id", getTemplate);
router.post("/api/templates/:id/versions", createTemplateVersion);
router.delete("/api/templates/:id", archiveTemplate);

function parseCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

/** Resolves tenant + session for every request. Same logic a Pages `_middleware.ts` would have run — kept here now that this is a single Worker (CLAUDE.md §6). */
async function resolveRequestData(request: Request, env: Env): Promise<RequestData | Response> {
  const hostname = new URL(request.url).hostname.toLowerCase();

  const resolved = await resolveTenantForHost(env.KV, env.HYPERDRIVE, hostname);
  if (!resolved) return new Response("Not found", { status: 404 });

  const platform = platformDb(env.HYPERDRIVE);
  const tenant = await platform.tenants.getById(resolved.tenantId);
  if (!tenant) return new Response("Not found", { status: 404 });

  let session: RequestData["session"] = null;
  const rawToken = parseCookie(request.headers.get("Cookie"), SESSION_COOKIE_NAME);
  if (rawToken) {
    const tokenHash = await hashToken(rawToken);
    const db = tenantDb(env.HYPERDRIVE, tenant.id);
    const record = await db.sessions.findByTokenHash(tokenHash);
    // §6.2: the resolved tenant is a hint, not authorisation. §6.3: sessions
    // are host-scoped, not tenant-wide.
    if (record && record.hostname === hostname && !record.revokedAt && Date.parse(record.expiresAt) > Date.now()) {
      session = { id: record.id, subjectType: record.subjectType, subjectId: record.subjectId };
    }
  }

  return {
    hostname,
    tenantId: tenant.id,
    tenant: { id: tenant.id, slug: tenant.slug, billingState: tenant.billingState },
    session,
  };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Replaces the Workers Cron Trigger (moved to Ubuntu cron — see CLAUDE.md
    // note in wrangler.jsonc). Same jobs `scheduled()` used to run.
    if (url.pathname === "/internal/cron") {
      if (request.method !== "POST" || request.headers.get("X-Cron-Secret") !== env.CRON_SECRET) {
        return new Response("Unauthorized", { status: 401 });
      }
      await runSlaBreachCheck(env);
      await runAutoCloseResolved(env);
      return new Response("ok");
    }

    if (url.pathname.startsWith("/api/")) {
      try {
        const data = await resolveRequestData(request, env);
        if (data instanceof Response) return data;

        const match = router.match(request.method, url.pathname);
        if (!match) return new Response("Not found", { status: 404 });

        return await match.handler(request, env, ctx, match.params, data);
      } catch (err) {
        return toErrorResponse(err);
      }
    }

    // Everything else is the React app's static assets (CLAUDE.md §2/§13).
    return env.ASSETS.fetch(request);
  },

  async queue(batch: MessageBatch<EmailJob>, env: Env): Promise<void> {
    await handleEmailQueue(batch, env);
  },

  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    // Runs every 15 minutes (wrangler.jsonc). Both jobs iterate tenants and
    // use the due-soon / resolved indexes — never a full ticket scan
    // (CLAUDE.md §10).
    ctx.waitUntil(runSlaBreachCheck(env));
    ctx.waitUntil(runAutoCloseResolved(env));
  },
} satisfies ExportedHandler<Env, EmailJob>;
