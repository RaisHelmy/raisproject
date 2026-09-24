# API, MCP and SDK

All three are thin adapters over the same services (§56, §161).

## REST `/api/v1` (§60)
Auth: session cookie or `Authorization: Bearer <api key>`. Every response has
`x-request-id`. Errors: `{ error: { code, message, action?, details? } }` with
actionable messages (§112). Pagination: `?cursor=&limit=` returning `{ items, nextCursor }`.

| Method & path | Scope | Notes |
| --- | --- | --- |
| GET /models, GET /models/:id | models:read | filters: task, capability, group, q |
| POST /models/:id/estimate | models:read | body = canonical input → `{ estimatedSen, approximate }` |
| POST /generations | generations:write | Idempotency-Key; returns 202 with generation |
| GET /generations, GET /generations/:id, POST /generations/:id/cancel | generations:read/write | |
| GET/POST /projects, GET/PATCH/DELETE /projects/:id | projects:* | |
| GET/POST /workflows, GET/PATCH/DELETE /workflows/:id | workflows:read/write | PATCH saves draft |
| POST /workflows/:id/versions | workflows:write | freeze draft into version |
| POST /workflows/:id/validate, POST /workflows/:id/estimate | workflows:read | |
| POST /workflows/:id/run | workflows:execute | body: variables, fromNodeIds?, rerunOf?, maxCostSen? |
| GET /workflow-runs, GET /workflow-runs/:id, POST /workflow-runs/:id/cancel, GET /workflow-runs/:id/events (SSE) | workflows:read/execute | |
| GET /templates (public+own), GET /templates/:id, POST /templates, POST /templates/:id/publish, POST /templates/:id/execute | templates:read/write/execute | |
| GET /assets, GET /assets/:id, POST /assets/uploads (presigned), POST /assets/:id/versions, DELETE /assets/:id | assets:read/write | |
| GET /balance, GET /balance/transactions, POST /balance/deposits | billing:read/write | |
| GET /usage?range= | billing:read | dashboard aggregates |
| GET/POST/DELETE /api-keys, /mcp-tokens, /webhooks | account:* | never returns full key after create |
| GET /nodes | workflows:read | serializable node definitions for the palette |
| /admin/* | admin | models, pricing, users, revenue, provider cost |
| POST /hooks/:id | (webhook secret) | workflow webhook trigger |

## MCP (§57–59, §106)
Transport: Streamable HTTP at `/mcp`, bearer `mcp_token`. Tools map 1:1 to
services; each handler builds `AuthContext` with scopes and `requestId`.

`list_models, get_model, estimate_cost, create_generation, get_generation,
cancel_generation, list_templates, get_template, execute_template,
list_workflows, execute_workflow, get_workflow_run, get_asset, list_assets,
get_balance, get_usage`

Long jobs: `create_generation` / `execute_*` return ids immediately; agents
poll `get_*`. Resource URIs `raisai://assets/{id}` expose asset metadata + signed URL.
Rate limits identical to API. No admin tools over MCP.

## Node SDK `@raisai/sdk` (§61)
Thin typed client generated from `packages/shared` DTOs. Surface:
`models.list/get/estimate`, `generations.create/get/wait/cancel`,
`workflows.list/get/run/wait`, `templates.list/get/execute`,
`assets.list/get/upload`, `balance.get`, `usage.get`, `webhooks.verify(sig)`.
`wait()` polls with backoff. No business logic.

## Webhooks (§62)
Events: `generation.completed|failed`, `workflow.completed|failed`,
`asset.created`, `template.executed`, `balance.low`. Payload
`{ event, id, timestamp, resource: { type, id }, status, outputs?, cost: { chargedSen, currency } }`
signed with HMAC-SHA256 header `x-raisai-signature`. Delivery via `events`
queue, 5 attempts with backoff.

## Rate limits (§107)
Per org: API 600 req/min, MCP 300 req/min, generation starts 30/min, workflow
runs 10/min, uploads 60/min. Implemented with a KV/DO counter; return 429 with
`retry-after`.
