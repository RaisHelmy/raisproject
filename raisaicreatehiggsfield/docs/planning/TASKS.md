# Task Backlog

Legend: `[ ]` todo, `[x]` done, `[~]` in progress. `depends:` lists task ids.
`docs:` lists what to read. `[hard]` marks tasks that may need Opus.
Tasks are sized for one session each (roughly 1–3 hours of focused work).

---

## Phase 0 — Foundation

### E0.1 Repository & tooling
- [x] 0.1.1 Init Bun workspaces: `apps/web`, `apps/worker`, `packages/shared`, `packages/sdk`, `packages/seed-models`; root scripts `dev`, `build`, `test`, `typecheck`, `lint`. docs: SYSTEM.md
- [x] 0.1.2 `wrangler.jsonc` with bindings: D1 `DB`, R2 `ASSETS`, AI `AI`, Queues `generation-jobs`/`events`, Workflow `RAIS_WORKFLOW_RUN`, cron for sync, static assets for web build. docs: SYSTEM.md, CLOUDFLARE-AI.md
- [x] 0.1.3 Hono app skeleton with `requestId` middleware, JSON error envelope, health route, structured logger. docs: SYSTEM.md, API-MCP-SDK.md
- [x] 0.1.4 Vitest setup: workers pool for `apps/worker`, node for packages; `bun test` runs both. docs: TESTING.md
- [x] 0.1.5 `packages/shared`: `AppError` + error codes, `PortType`, money helpers (`sen`, `formatMYR`), `AuthContext` type.
- [x] 0.1.6 React app shell: Bun bundler build, Bootstrap + Icons, router, beginner nav (Create, Projects, Templates, History), balance chip placeholder, EmptyState component. docs: UX.md

### E0.2 Database
- [x] 0.2.1 Migration 0001: users, organizations, organization_members, sessions, api_keys, mcp_tokens, audit_log. docs: DATA-MODEL.md
- [x] 0.2.2 Migration 0002: projects, project_members. 
- [x] 0.2.3 Migration 0003: models, model_pricing, model_favorites, model_usage_stats.
- [x] 0.2.4 Migration 0004: assets, asset_versions.
- [x] 0.2.5 Migration 0005: generations, generation_inputs, generation_outputs.
- [x] 0.2.6 Migration 0006: workflows, workflow_versions, workflow_drafts, workflow_runs, node_runs, node_cache.
- [x] 0.2.7 Migration 0007: templates, template_versions.
- [x] 0.2.8 Migration 0008: balance_transactions, balances, payments, usage_records.
- [x] 0.2.9 Migration 0009: webhooks, webhook_deliveries, connectors.
- [x] 0.2.10 Repository layer pattern + one repository per aggregate with typed row mappers; D1 batch helper. depends: 0.2.1–0.2.9

### E0.3 Auth
- [x] 0.3.1 Email+password signup/login/logout with hashed passwords (scrypt/argon via WebCrypto-compatible lib), HttpOnly session cookie, CSRF token. Personal org auto-created. docs: SYSTEM.md
- [x] 0.3.2 `AuthContext` builder middleware for session, API key, MCP token; scope vocabulary in shared. depends: 0.3.1
- [x] 0.3.3 Web: login/signup pages, account page with "Advanced mode" toggle persisted in user settings. depends: 0.3.1
- [x] 0.3.4 Audit log service + events for login, key created. depends: 0.3.2

### E0.4 Billing core
- [x] 0.4.1 [hard] `LedgerService`: deposit, reserve, charge, refund, adjustment; single D1 batch per op; balance materialization; unit tests incl. racing reserves. docs: BILLING.md
- [x] 0.4.2 `GET /balance`, `GET /balance/transactions`; admin manual deposit route. depends: 0.4.1
- [x] 0.4.3 Web: balance chip, Balance page with transactions, "Add Balance" placeholder (manual for MVP). depends: 0.4.2
- [x] 0.4.4 Customer/admin DTO split + leakage snapshot test. docs: ADR-006

### E0.5 Provider & registry skeleton
- [x] 0.5.1 `AIProvider` interface, `ProviderJob`, canonical input types; `FakeAIProvider` with failure injection and usage reporting. docs: MODEL-REGISTRY.md, TESTING.md
- [x] 0.5.2 `ModelDefinition` Zod schema, capability vocabulary, `ParameterDef`; `ModelRepository`; `ModelService.list/get` with capability filters (enabled only for customers). docs: MODEL-REGISTRY.md
- [x] 0.5.3 `packages/seed-models`: curated JSON for 3 Workers AI image models (flux-1-schnell, flux-2-klein-9b, stable-diffusion-xl-lightning), 2 LLMs (llama-3.3-70b-instruct-fp8-fast, gemma-4-26b-a4b-it), 1 vision (llama-3.2-11b-vision-instruct), 1 TTS (melotts), 1 STT (whisper-large-v3-turbo), 1 third-party video (vidu/q3-turbo). Verify each schema against docs. docs: CLOUDFLARE-AI.md
- [x] 0.5.4 Seed script inserting models as `enabled` in dev with pricing rows. depends: 0.5.2, 0.5.3
- [x] 0.5.5 CI: GitHub Actions or equivalent running typecheck + tests on push.

---

## Phase 1 — MVP vertical slice

### E1.1 Pricing & estimation
- [x] 1.1.1 [hard] `PricingService.estimate(model, input)` implementing shapes: tile_step, megapixel_tiered, tokens, audio_minute, characters, video_seconds, flat; markup/fx/rounding/minimum; `approximate` flag. Tests per shape. docs: BILLING.md, CLOUDFLARE-AI.md
- [x] 1.1.2 `POST /models/:id/estimate`; `GET /models` includes typical-request estimate per model. depends: 1.1.1
- [x] 1.1.3 Actual-cost computation from provider usage; fallback to estimate with `cost_basis`. depends: 1.1.1

### E1.2 Cloudflare provider
- [x] 1.2.1 [hard] `CloudflareAIProvider.execute` for text-to-image via `env.AI.run`, parameter mapping via `mapsTo`, output written to R2, returns usage. docs: CLOUDFLARE-AI.md, MODEL-REGISTRY.md
- [x] 1.2.2 Text generation (chat + json-mode) and vision input mapping. depends: 1.2.1
- [x] 1.2.3 Third-party async model support: `state` handling, `getJob` polling, download of result URL into R2, gateway header config. Test with a video model when enabled. depends: 1.2.1
- [x] 1.2.4 Input validation against model `input_schema_json` with actionable errors (§112). depends: 1.2.1

### E1.3 Assets
- [x] 1.3.1 `AssetService`: create from upload (presigned R2 PUT or direct PUT through worker for <10 MB), create from generation output, versions, list/get/delete, ownership checks. docs: DATA-MODEL.md
- [x] 1.3.2 Signed GET URLs, thumbnail generation job on `events` queue (Workers image resizing or client-side fallback). depends: 1.3.1
- [x] 1.3.3 Web: Assets page (advanced nav), `FileUploader`, `AssetPicker` with multi-select order badges honoring `maxReferenceImages`. depends: 1.3.1

### E1.4 Workflow engine core
- [x] 1.4.1 [hard] `WorkflowDocument` Zod schema, node registry (`registerNode`), port compatibility table, graph utilities (topo sort, cycle detection, reachability). docs: WORKFLOW-ENGINE.md
- [x] 1.4.2 [hard] Validator returning all errors with codes; tests for every code. depends: 1.4.1
- [x] 1.4.3 Node definitions: input.text, input.image, input.variable, prompt, output, merge, http (allowlist, timeout, connector auth ref). depends: 1.4.1
- [x] 1.4.4 [hard] `ai.model` node: dynamic ports from model capabilities, estimate, execute via provider, generation row creation; presets ai.image/ai.video/ai.text. depends: 1.4.3, 1.2.1, 1.1.1
- [x] 1.4.5 Estimator: `estimateWorkflow` summing nodes with approximate flag. depends: 1.4.4
- [x] 1.4.6 [hard] In-process scheduler/executor (used by tests and dev): waves, maxParallel, cache keys + node_cache, retry policy, budget pause, cancel, partial run, rerunOf. depends: 1.4.4
- [x] 1.4.7 [hard] `RaisWorkflowRun` Cloudflare Workflow runner adapting the scheduler to `step.do/sleep`; instance launch from service. depends: 1.4.6
- [x] 1.4.8 `WorkflowExecutionService.start/cancel/get`: validate → estimate → reserve → run rows → launch; settlement on completion; events emitted. depends: 1.4.7, 0.4.1
- [x] 1.4.9 `GET /workflow-runs/:id/events` SSE + polling fallback. depends: 1.4.8

### E1.5 Generation (Quick Create backend)
- [x] 1.5.1 `GenerationService.create` wrapping single-node workflow (ADR-004), idempotency key, `POST /generations`, `GET /generations`, `GET /generations/:id`, cancel. depends: 1.4.8
- [x] 1.5.2 Generation history query with filters (type, project, model, date, status, cost). depends: 1.5.1

### E1.6 Projects
- [x] 1.6.1 `ProjectService` CRUD, default project per org, ownership checks; routes. 
- [x] 1.6.2 Web: Projects page with empty state, create modal, project detail listing generations/assets/workflows. depends: 1.6.1

### E1.7 Quick Create UI
- [x] 1.7.1 Create home cards (Image, Video, Audio, Text, Movie, Workflow); Movie and Audio show "coming soon" until phases 2–3. docs: UX.md
- [x] 1.7.2 `ModelSelector`: groups (Recommended/Fast/Quality/Cheap/Cinematic/Experimental/All), cost per model, favorites, recently used; filters by required capability when a reference image is attached. depends: 1.1.2
- [x] 1.7.3 Capability-driven control renderer from `parameters[]` (basic vs advanced), `CostEstimate` live re-estimate with debounce. depends: 1.7.2
- [x] 1.7.4 Image Quick Create page: prompt, reference (if capability), model, aspect ratio, estimate, Generate; result panel with `FinalCost`, actions. depends: 1.7.3, 1.5.1
- [x] 1.7.5 Text Quick Create and Video Quick Create (prompt/image → model) reusing the same renderer. depends: 1.7.4
- [x] 1.7.6 Insufficient balance dialog with estimate/available/Add Balance (§29). depends: 1.7.4
- [x] 1.7.7 History page with filter chips and `GenerationCard`. depends: 1.5.2

### E1.8 Workflow editor UI
- [x] 1.8.1 `GET /nodes` palette endpoint; workflow CRUD routes; draft autosave `PATCH /workflows/:id`; version freeze route. depends: 1.4.3
- [x] 1.8.2 [hard] `NodeEditor` on React Flow: custom `NodeCard`, typed handles, connection validation from compatibility table, keyboard shortcuts (delete, duplicate, undo/redo, fit), autosave indicator. docs: UX.md, ADR-005
- [x] 1.8.3 Beginner palette + "More nodes" searchable library by category. depends: 1.8.2
- [x] 1.8.4 Node config panel using the capability-driven renderer, per-node estimate, Run Node (partial run). depends: 1.8.2, 1.7.3
- [x] 1.8.5 Run/Stop with live statuses via SSE, output previews in nodes, failure panel (Reason/Retry/Edit/Skip/Stop), run-from-here. depends: 1.4.9, 1.8.2
- [x] 1.8.6 Workflow cost preview modal before run (§28) and insufficient balance handling. depends: 1.4.5
- [x] 1.8.7 Advanced debug drawer (input/output/time/model/request id/cost/retries). depends: 1.8.5
- [x] 1.8.8 Workflows list page with empty state; "Open in Workflow" from a generation. depends: 1.8.1

### E1.9 Templates (save + reuse)
- [x] 1.9.1 `TemplateService`: create from workflow version, declare variables from `input.variable` nodes, publish version, execute (binds template_version_id). docs: DATA-MODEL.md
- [x] 1.9.2 Routes: templates CRUD, publish, execute. depends: 1.9.1
- [x] 1.9.3 Web: "Save as Template" from editor/generation, Templates page (own), Use Template form generated from variables → estimate → run. depends: 1.9.2
- [x] 1.9.4 Template versioning test: old runs keep old version. depends: 1.9.1

### E1.10 MVP hardening
- [x] 1.10.1 Rate limiting middleware (API, generation starts, runs, uploads). docs: API-MCP-SDK.md
- [x] 1.10.2 Workflow limits enforcement (nodes, edges, fan-out, parallel, concurrent runs). depends: 1.4.2
- [x] 1.10.3 Playwright smoke: signup → deposit (admin) → image create → history shows charged amount and balance.
- [x] 1.10.4 Mobile pass on Create/History/Templates/Projects.
- [!] 1.10.5 Deploy to Cloudflare staging. BLOCKED: needs Cloudflare account credentials (D1 id, R2 bucket, queues). Commands are documented in README.md; run `bun run db:migrate:remote` then `wrangler deploy` once a database_id is set.

---

## Phase 2 — Platform

### E2.1 Audio & more media
- [x] 2.1.1 TTS node/quick create (melotts, aura) with audio asset output and player preview.
- [x] 2.1.2 STT node (whisper) → text; subtitles SRT/VTT generator utility node.
- [~] 2.1.3 Music generation. Two music models (ElevenLabs Music v2, MiniMax Music 2.6) are now in the registry as `discovered` via the catalog import. Neither has a published rate, so both wait on an admin entering one and a passing test run before they can be offered.
- [x] 2.1.4 Image editing / inpainting / upscale capabilities via image-to-image models (flux-2-klein, pruna p-image-upscale) with mask input where supported.
- [x] 2.1.5 Multi-image reference support end to end (image[] ports, picker limits).

### E2.2 Model tooling
- [x] 2.2.1 Model catalog sync job from Workers AI REST (`discovered` only) + admin diff view. docs: MODEL-REGISTRY.md
- [x] 2.2.2 Admin model management: enable/disable, pricing, markup, tags, limits, test run.
- [x] 2.2.3 Model comparison: same prompt across N models, side-by-side results, per-model cost.
- [x] 2.2.4 Compatibility warnings + "Compatible models" suggestion in editor and templates (§91).

### E2.3 Public templates
- [x] 2.3.1 Visibility (private/unlisted/public), `/templates/:id` public page, duplicate/fork, usage count, preview asset.
- [x] 2.3.2 Template categories and search.

### E2.4 API & keys
- [x] 2.4.1 API keys UI + routes (create/name/scope/expiry/revoke/last used), key shown once.
- [x] 2.4.2 Full REST coverage per API table, OpenAPI document generated from Zod schemas, contract tests.
- [x] 2.4.3 Developer docs page in-app (advanced nav).

### E2.5 MCP
- [x] 2.5.1 [hard] MCP server at `/mcp` (Streamable HTTP), token auth, scopes, request ids, all 16 tools mapped to services. docs: API-MCP-SDK.md
- [x] 2.5.2 MCP tokens UI; usage tracked in usage_records with actor type.
- [x] 2.5.3 MCP tests: every tool, scope denial, balance enforcement.

### E2.6 Usage & webhooks
- [x] 2.6.1 Usage rollups (daily job) and `GET /usage`; Usage page with Highcharts (daily, monthly, count, by category, by model, by project).
- [x] 2.6.2 Webhooks CRUD, signed delivery via events queue with retries, deliveries log UI.
- [x] 2.6.3 Low-balance threshold setting + `balance.low` event + banner.
- [!] 2.6.4 Payment provider integration. BLOCKED: needs a payment account. Deposits work today through the admin route; PaymentService writes the same ledger entry once a gateway is connected.

### E2.7 Additional nodes
- [x] 2.7.1 transform (JSON path / template), condition, router, split, delay.
- [x] 2.7.2 bounded loop with iteration limit and cost cap.
- [x] 2.7.3 Workflow import/export JSON, duplicate, fork.

---

## Phase 3 — Movie mode

- [x] 3.1 Migration 0010: movies, characters, locations, scenes, shots, timeline_tracks, timeline_items. docs: DATA-MODEL.md
- [x] 3.2 `MovieService` + routes for all entities; project kind `movie`.
- [x] 3.3 [hard] Story generation system workflow: idea → LLM (json-mode) → structured title/logline/synopsis/characters/locations/scenes/shots; editable forms. 
- [x] 3.4 Characters & locations UI with reference images and voice config; character consistency passes references into compatible models with warnings.
- [x] 3.5 Scenes & shots editor with cinematic controls (model-aware) and `PromptBuilder` node compiling them.
- [x] 3.6 Storyboard grid: generate/regenerate shot images, versions, select version, compare.
- [x] 3.7 Shot video generation (image-to-video) with versions; per-shot "Open in Workflow".
- [x] 3.8 Dialogue → TTS per character voice; SFX/music generation; subtitles from script.
- [x] 3.9 [hard] Timeline component: tracks, items, trim/split/move/duplicate/mute/volume/fade; persisted to timeline tables.
- [~] 3.10 Export: edit manifest, subtitles and a runnable ffmpeg script are produced and stored as assets. Muxing to a single MP4 inside a Worker is not possible (no ffmpeg, no filesystem); finishing it in-product needs Cloudflare Containers or Stream, which is the remaining piece.
- [x] 3.11 Movie stepper UI and mobile storyboard view; budget control `maxCost` per movie run (§139).

---

## Phase 4 — Automation & ecosystem

- [x] 4.1 `@raisai/sdk` package: typed client, wait helpers, webhook verify, README, publish to npm.
- [x] 4.2 Webhook trigger node + `POST /hooks/:id` ingress mapping payload to variables.
- [x] 4.3 Schedule node (once/hourly/daily/weekly/cron) on Cloudflare cron + Workflows sleep.
- [x] 4.4 MCP tool node calling external MCP servers via connectors.
- [x] 4.4.1 Connectors: encrypted-at-rest credentials, CRUD routes, test-connection tool listing, and a page to manage them.
- [x] 4.5 [hard] Agent node with tool list, memory, and hard budget stop.
- [x] 4.6 Marketplace: public templates with categories, search, popularity sorting and duplication. Ratings and author pages are deliberately left out until there is a reason for them.
- [x] 4.7 Collaboration: workspace members with owner/admin/member roles, ownership transfer, shared balance and projects.
- [x] 4.8 Global search across projects/assets/generations/templates/workflows/characters/scenes/shots.
- [!] 4.9 Code node. NOT BUILT BY DECISION: CLAUDE.md §133 says never run user code in a normal Worker without isolation. The HTTP, transform, condition and MCP nodes cover the cases people reach for; a code node needs Dynamic Workers or a sandbox first.

## Phase 5 — gaps found by auditing the spec against the app

Backends that existed with no way for anyone to reach them, and spec sections
with no implementation at all. Found by re-reading CLAUDE.md against the
running app rather than against the backlog.

- [x] 5.1 Connectors: encrypted credentials, CRUD, test connection, MCP node picker. (§137, §109)
- [x] 5.2 Webhook deliveries log UI. (§62)
- [x] 5.3 Admin model management UI: price, tag, test, enable. (§124)
- [x] 5.4 Cancel a generation or run, with the `cancel_generation` MCP tool. (§24, §57)
- [x] 5.5 Automation UI: schedules and incoming triggers, both with spending limits. (§135, §136)
- [x] 5.6 Model favourites: mark a model, see My Models. (§90)
- [x] 5.7 Public template page at /templates/:id with preview and Use. (§53)
- [x] 5.8 Shot version history: keep every generation of a shot, pick one. (§40, §41)
- [x] 5.9 Timeline split, move and duplicate. (§46)
- [x] 5.10 Cinematic controls on a shot: shot type, camera move, lens, lighting. (§38)
- [x] 5.11 Import Cloudflare's whole published catalog: 220 models as `discovered`, searchable in the admin page. (§7, §125)
- [x] 5.12 Live prices: account sync reads each model's current rate from Cloudflare and writes it as a new pricing row, never touching a hand-entered rate. (§72, §125)

---

## Phase 6 — Canvas to production

The node editor is now the Canvas (ADR-007). Its full task plan, with file
lists, acceptance criteria and verification per task, is in
`docs/planning/CANVAS-PRODUCTION.md`. Work that file top to bottom; tick tasks
there, and mirror epic completion here.

- [ ] E6.1 Document model, load, save, versions
- [ ] E6.2 Editing interactions (add, wire, group, resize, undo, snap)
- [ ] E6.3 Assets, uploads and R2 (thumbnails, multipart video, picker)
- [ ] E6.4 Generation nodes, capability-driven inspector, run + SSE, ringgit prices
- [ ] E6.5 Agent panel that edits the graph
- [ ] E6.6 Sharing, templates
- [ ] E6.7 Mobile and accessibility
- [ ] E6.8 Performance and resilience
- [ ] E6.9 Hardening, cleanup, docs
