# Security

BNM information is treated as sensitive. Controls implemented:

| Area | Implementation |
|---|---|
| Authentication | Email + password (PBKDF2-SHA256, 100k iterations, per-user salt, constant-time verify). Sessions are random 256-bit tokens stored hashed (SHA-256) in Postgres; HttpOnly, SameSite=Lax, Secure (on HTTPS) cookie; 7-day TTL (`SESSION_TTL_HOURS`). Personal API tokens (`rts_…`) for MCP/integrations, hashed at rest, shown once. |
| Authorisation | Roles ADMIN / APPROVER / USER via `user_roles`; `requireRole` middleware; row-level checks in services (owners see their own records, approvers see all; non-members cannot use a project). Unknown-or-forbidden records return 404 to avoid enumeration (IDOR). |
| CSRF | Mutating cookie-authenticated requests must carry `X-Requested-With: RaisTimesheet` and a matching `Origin` (if present). API-token requests are exempt (no ambient credential). |
| Secrets | `wrangler secret put` only: `SESSION_SECRET`, `ENCRYPTION_KEY`, `ANTHROPIC_API_KEY`, `JIRA_OAUTH_CLIENT_ID/SECRET`, `MCP_BOOTSTRAP_TOKEN`. Jira access/refresh/API tokens are AES-256-GCM encrypted with `ENCRYPTION_KEY`. Nothing secret is sent to the browser or MCP. |
| Uploads | `.txt` only, size limit (`MAX_UPLOAD_BYTES`, 10 MB default), binary sniff, stored in private R2 with per-import keys; raw files are never publicly accessible and are read only by the Worker. |
| Rate limiting | Fixed-window counters per IP/user for login, uploads, analysis, Jira writes, search, reports. |
| Input validation | Zod schemas on every mutating endpoint; server-side date/time/duration validation; HTML is never rendered from user input (React escapes by default). |
| Headers | `hono/secure-headers` (nosniff, frame options, referrer policy, etc.). |
| Audit | Append-only `audit_logs` for every business action with actor, before/after, reason, source and correlation id. Approved records can only be corrected by approvers with a reason; the change is noted on the linked Jira issue. |
| Logging | Structured JSON; keys matching token/secret/password/authorization/cookie are redacted; full conversations are never logged. |
| Retention | Configurable: raw WhatsApp files, reports, audit (0 = keep). Official timesheet/approval records are never auto-deleted. |
| Least privilege | Jira OAuth scopes limited to read/write work + read user. Workers bindings scoped to one Hyperdrive config (Postgres), one R2 bucket, one queue. |

## Security test coverage

Automated (vitest): password hashing/verification, AES-GCM round-trip and wrong-key rejection, constant-time compare.

Smoke-tested against the running Worker (see docs/deployment.md → Verification): unauthenticated access → 401; another user's timesheet → 404 (IDOR); POST without CSRF header → 403; non-admin on `/admin/users` → 403.

Recommended before production: run `/security-review`, add a WAF rate-limit rule at the Cloudflare edge, restrict `WEB_ORIGIN` to the production hostname, enable Access in front of the admin routes if desired.
