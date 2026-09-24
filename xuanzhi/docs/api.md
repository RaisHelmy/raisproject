# API

Base: `https://xuanzhi-api.raishelmy97.workers.dev/api`. JSON envelope `{ success, data, warnings? }` / `{ success:false, error:{ code, message, reference?, details? } }`. Cookie session (`xz_session`, HttpOnly, SameSite=None) or `Authorization: Bearer xz_…` API key (Enterprise). Mutations from the browser must send `X-Requested-With: XuanZhi` (CSRF).

## Auth
`POST /auth/register` `{name,email,password,locale?}` · `POST /auth/login` · `POST /auth/logout` · `GET /auth/me` (user + entitlements + organizations + feature flags) · `GET /auth/providers` · `POST /auth/verify {token}` · `POST /auth/resend-verification` · `POST /auth/forgot-password {email}` · `POST /auth/reset-password {token,password}` · `POST /auth/change-password` · `GET /auth/oauth/{google|microsoft|apple}/start?redirect_to=` · `GET|POST /auth/oauth/:provider/callback`

## Catalog
`GET /models` (with `available`/`required_plan` when signed in) · `GET /plans` · `GET /modes` · `GET /categories`

## Conversations & chat
`GET /conversations?search=&archived=&page=` · `POST /conversations` · `GET /conversations/:id` (conversation + messages + sources) · `PATCH /conversations/:id` `{title,is_archived,is_pinned,model_id,mode_id,use_knowledge}` · `DELETE /conversations/:id` · `POST|DELETE /conversations/:id/share` · `PATCH /conversations/:id/messages/:mid` `{feedback,is_bookmarked}`

`POST /chat/stream` (SSE) body `{conversation_id?, content, model_id?, mode_id?, use_knowledge?, upload_ids?, regenerate_message_id?, edit_message_id?}`
Events (`event:` = `type`): `meta {conversation_id,user_message_id,assistant_message_id,model_id,title?}` → `status {thinking|searching|generating}` → `sources [SourceDTO]` → `token {text}`… → `done {message, usage}` | `error {code,message,details?}` (`UPGRADE_REQUIRED` / `QUOTA_EXCEEDED` carry `details.required_plan`).
`POST /chat` — same body, returns the final message (for API keys).

## Knowledge & files
`GET /knowledge?search=&category_id=&page=` · `POST /knowledge/search {query, category_codes?, limit?}` · `GET /knowledge/:id` · `GET /knowledge/:id/chunks/:chunkId` (source viewer) · `POST /files/upload` (multipart `file`, `conversation_id?`) · `GET /files/:id`

## Account
`PATCH /account/profile` · `GET /account/entitlements` · `GET /account/usage` · `GET /account/saved` · `DELETE /account/history` · `DELETE /account` · `GET|POST /account/api-keys`, `DELETE /account/api-keys/:id` · `GET|POST /account/organizations`, `GET|POST /account/organizations/:id/members`, `DELETE …/members/:userId` · `GET /account/search?q=` (⌘K)

## Billing & share
`GET /billing/subscription` · `POST /billing/checkout {plan_id}` · `POST /billing/portal` · `POST /billing/webhook` (Stripe-signed) · `GET /share/:token` (public)

## Admin (`role admin|super_admin`)
`GET /admin/dashboard` · `GET /admin/analytics?days=` · `GET /admin/usage?days=`
`GET /admin/users`, `PATCH /admin/users/:id`, `POST /admin/users/:id/plan`, `DELETE /admin/users/:id` (super)
`GET|POST /admin/organizations`, `PATCH /admin/organizations/:id`, members endpoints
`GET /admin/providers`, `PATCH /admin/providers/:id` (`api_key` stored encrypted) · `GET|POST /admin/models`, `PATCH|DELETE /admin/models/:id` (`plan_ids` sets availability)
`GET /admin/plans`, `PATCH /admin/plans/:id` · `GET|POST /admin/modes`, `PATCH /admin/modes/:id`
`GET|POST /admin/prompts`, `GET /admin/prompts/:id`, `POST /admin/prompts/:id/versions`, `POST /admin/prompts/:id/activate/:versionId` (rollback)
`GET|POST /admin/knowledge/categories`, `PATCH|DELETE …/:id` · `GET|POST /admin/knowledge/bases`, `PATCH|DELETE …/:id`
`GET /admin/knowledge` (filters: search, category_id, language, status, visibility, author, knowledge_base_id, source_type) · `POST /admin/knowledge/upload` (multipart + metadata) · `GET /admin/knowledge/:id` · `PUT /admin/knowledge/:id` · `POST /admin/knowledge/:id/reprocess` · `POST /admin/knowledge/:id/status {enabled}` · `DELETE /admin/knowledge/:id` · `POST /admin/knowledge/demo`
`GET /admin/settings`, `PUT /admin/settings/:key` · `GET /admin/audit`

## Internal
`GET /health`, `GET /ready` · `POST /internal/cron/housekeeping` (`X-Cron-Secret`)
