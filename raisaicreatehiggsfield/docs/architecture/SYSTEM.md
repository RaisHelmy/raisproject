# System Architecture

## Layering (mandatory, from CLAUDE.md §6, §56, §161)

```
Web UI (React)   REST API   MCP server   Node SDK (calls REST)
        \           |          /
         Application Services  (GenerationService, WorkflowService, ...)
                    |
   Workflow Engine  |  Billing (ledger)  |  Assets (R2+Postgres)  |  Model Registry
                    |
            Provider abstraction (AIProvider)
                    |
            CloudflareAIProvider  (Workers AI + AI Gateway unified catalog)
```

Rules:
- React never imports provider code or the database. It talks to `/api/v1/*` only.
- API routes, MCP tool handlers and the SDK contain zero business logic; they
  validate transport input, build an `AuthContext`, call a service, map errors.
- Services own permissions, balance checks, model validation, idempotency.
- Only the provider layer knows model ids and Cloudflare request shapes.
- Customer-facing serializers strip `provider_cost`, `markup`, `margin`,
  `provider_request_id` unless the caller is admin.

## Monorepo layout (Bun workspaces)

```
raisai/
  package.json            bun workspaces, root scripts
  wrangler.jsonc          worker config: Hyperdrive (Postgres), R2, AI, Queues, Workflows bindings
  apps/
    web/                  React + TypeScript + Bootstrap SPA (served by the Worker as static assets)
      src/app/            router, shell, nav (beginner vs advanced nav)
      src/features/       create | projects | templates | workflows | movies | assets | history | usage | billing | mcp | api-keys | account | admin
      src/components/     design system (Button, Modal, Drawer, Tabs, Card, Select, FileUploader, ModelSelector, CostEstimate, FinalCost, AssetPicker, NodeCard, NodeEditor, Timeline, GenerationCard, TemplateCard, ProjectCard, StatusBadge)
      src/lib/api.ts      typed fetch client generated from shared types
    worker/               Cloudflare Worker (Hono router)
      src/index.ts        fetch + queue + workflow entrypoints
      src/routes/         api/v1/*, hooks/*, mcp
      src/controllers/    thin: parse → service → respond
      src/services/       application services
      src/engine/         workflow engine (pure TS, no bindings) + CloudflareWorkflowRunner
      src/billing/        ledger, pricing, estimation
      src/providers/      AIProvider interface, cloudflare/
      src/registry/       model registry + sync
      src/storage/        R2 helpers, presigned uploads, thumbnails
      src/repositories/   DB access (Postgres via Hyperdrive), one file per aggregate
      src/auth/           sessions, api keys, mcp tokens, scopes
      src/mcp/            MCP server adapter
      migrations-pg/      Postgres SQL migrations 0001_... (old SQLite ones kept under migrations/)
  packages/
    shared/               types shared by web, worker, sdk: ModelDefinition, WorkflowDocument, port types, API DTOs
    engine-core/          (optional later) pure graph validation/scheduling if we want it importable by SDK
    sdk/                  @raisai/sdk Node.js client
    seed-models/          curated JSON for third-party models + capability overrides
  docs/
```

Keep the engine (`engine/`) free of Cloudflare bindings so it can be unit tested
with plain Vitest. The runner adapter injects `AIProvider`, `Ledger`, `AssetStore`.

## Runtime topology

- **Worker `fetch`**: API, static SPA, webhook ingress (`POST /hooks/:id`), SSE
  status stream (`GET /api/v1/workflow-runs/:id/events`) with polling fallback.
- **Cloudflare Workflow `RaisWorkflowRun`**: one instance per WorkflowRun.
  Each node becomes `step.do(nodeId)`. Retries per node config. Long provider
  jobs poll inside the step with `step.sleep` between polls.
- **Queue `generation-jobs`**: Quick Create generations that are not part of a
  workflow (kept on the same engine path by wrapping a single AI node — see
  ADR-004), so there is one execution codepath.
- **Queue `events`**: webhook deliveries, thumbnails, usage rollups, low-balance alerts.
- **Cron trigger**: model catalog sync (daily), usage aggregation.
- **Postgres**: metadata. **R2**: binaries with keys `org/{orgId}/project/{projectId}/{assetId}/v{n}.{ext}`.
- **KV** (optional): model catalog cache, public template index.
- **Durable Object** (deferred): live status hub if SSE-from-DB-polling is not enough.

## Auth model

- Browser: HttpOnly session cookie. Email + password with hashed passwords,
  OAuth later. CSRF token on mutations.
- API: `Authorization: Bearer rk_live_...` API keys with scopes, hashed at rest.
- MCP: same scope vocabulary, separate token table, request id on every call.
- `AuthContext { userId, orgId, actorType: 'user'|'api_key'|'mcp', scopes, requestId, isAdmin }`
  is the only thing services accept for identity.

## Observability

- `requestId` generated at ingress, propagated to services, provider calls, logs.
- Structured JSON logs: `{ requestId, userId, workflowRunId?, nodeRunId?, generationId?, event, ... }`.
- Audit log table for security-relevant events (§111).
