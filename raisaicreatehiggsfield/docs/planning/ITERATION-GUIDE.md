# Iteration Guide (read at the start of every session)

## Model policy
Planning and architecture are done (this docs set). Implementation iterations
should run on **Claude Sonnet** by default and **Claude Opus** for engine,
billing, or migration work. Switch with `/model` in Claude Code. Use the top
tier only if a task in TASKS.md is explicitly marked `[hard]` and Opus fails.

## Session loop
1. Read `docs/planning/TASKS.md`; pick the first unchecked task in the current
   phase (respect `depends:`).
2. Read only the architecture doc(s) the task lists under `docs:`.
3. Implement in small commits; keep `bun run typecheck` and `bun test` green.
4. Tick the task checkbox, add a one-line note under it if something deviated,
   and add any new decision as `docs/decisions/ADR-nnn-*.md`.
5. Stop after the task; do not start the next one in the same turn unless it is tiny.

## Conventions
- TypeScript strict everywhere; Zod schemas in `packages/shared` are the single
  source of truth for DTOs and workflow JSON.
- No provider or model ids in `apps/web`. Capability flags only.
- Money: sen integers; format with `formatMYR()` in shared.
- Errors: `AppError(code, message, { action, status, details })`; codes are
  snake_case and listed in `packages/shared/src/errors.ts`.
- Every service method takes `AuthContext` first.
- Every mutation logs an audit event where §111 requires.
- D1 migrations are numbered `NNNN_name.sql`, forward-only, applied with wrangler.
- Always apply them with `bun run db:migrate:local`, which uses the same
  wrangler the dev and e2e servers use. A different wrangler version writes a
  different local state schema and fails to start at all.
  Never edit a migration that has been applied anywhere, including your own
  local database. Wrangler records it as done and silently skips the new
  content, so the schema and the file drift apart. Add a new migration instead.
- Feature folders in web; one folder per aggregate in worker services/repositories.
- Tests live beside code as `*.test.ts`; use `FakeAIProvider`.
- Commit messages: `area: what` (e.g. `engine: add cycle detection`).

## Definition of done for a task
- Code + tests + types; `bun test` passes.
- Customer DTO leakage test still passes when billing/generation DTOs change.
- If UI: empty state, loading state, error state, keyboard accessible.
- If API: route documented in `docs/architecture/API-MCP-SDK.md` table if new.
- Task checked in TASKS.md.

## Where facts live
- Cloudflare capabilities/pricing: `docs/knowledge/CLOUDFLARE-AI.md` (re-verify
  against developers.cloudflare.com before hard-coding a number).
- Spec authority: `CLAUDE.md`. If a doc here conflicts with CLAUDE.md, CLAUDE.md wins;
  fix the doc.
