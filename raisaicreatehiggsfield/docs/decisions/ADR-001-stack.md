# ADR-001: Stack

**Status**: accepted (2026-09-05)

- Runtime: Cloudflare Workers (Hono router), D1, R2, Queues, Workflows, Workers AI + AI Gateway.
- Frontend: Bun, React 18, TypeScript, Bootstrap 5, Bootstrap Icons, Highcharts. No Tailwind. React Flow for the canvas only (ADR-005).
- Monorepo: Bun workspaces (`apps/web`, `apps/worker`, `packages/shared`, `packages/sdk`, `packages/seed-models`).
- Validation: Zod schemas in `packages/shared`, reused by API, MCP, SDK, engine.
- Tests: Vitest (+ workers pool), Playwright smoke.

**Why**: matches CLAUDE.md §97, §157–158; minimal libraries; one language end to end.
