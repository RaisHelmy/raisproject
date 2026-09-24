# Security

- **Passwords**: PBKDF2-SHA256, 100 000 iterations (Workers WebCrypto cap), per-user salt; uniform-timing verification for unknown users.
- **Sessions**: 32-byte random token, SHA-256 hash stored, HttpOnly + Secure + SameSite=None cookie, 14-day TTL, `last_seen_at` touch, purge via cron. Password reset revokes all sessions.
- **API keys**: `xz_…` random, hash stored, prefix shown; Enterprise only (`allow_api_access`).
- **CSRF**: cookie-authenticated mutations require `X-Requested-With: XuanZhi` and a trusted `Origin`; API keys, Stripe webhook and OAuth callbacks are exempt by design.
- **Rate limiting**: fixed-window counters in Postgres per user/IP on login, register, reset, chat, uploads, knowledge search, share.
- **Authorization**: `requireAuth`, `requireAdmin`, `requireSuperAdmin`; users only ever access their own conversations/uploads (every query is scoped by `user_id`); knowledge visibility filtered in SQL.
- **Secrets**: provider API keys entered by admins are AES-256-GCM encrypted with `ENCRYPTION_KEY` and never returned; env secrets never reach the client.
- **Webhooks**: Stripe signature (`t=…,v1=…`) verified with HMAC-SHA256 and a 5-minute tolerance.
- **OAuth**: server-side `state` (15 min, single use) + PKCE (Google/Microsoft); identity from the ID token; Apple client secret is an ES256 JWT signed in the Worker.
- **Audit**: admin and security events (`user.login`, `admin.model_disabled`, `admin.plan_price_changed`, `admin.prompt_changed`, `admin.document_deleted`, …) with actor, resource, IP, result and before/after details.
- **Logging**: structured JSON with request ids; keys, tokens, passwords and message contents are redacted.
- **Uploads**: type allow-list, size limit, stored in R2 under per-user/per-KB keys, processed asynchronously.
