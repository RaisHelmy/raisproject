# ADR-003: Cloudflare Workflows executes WorkflowRuns

**Status**: accepted (2026-09-05)

**Decision**: the engine (validation, scheduling, typing, estimation) is pure TS.
Execution of a run is a Cloudflare Workflow instance; each node is a `step.do`
with the node's retry config; polling of async provider jobs uses `step.sleep`.
Queues are used for side effects (webhooks, thumbnails, rollups) and catalog sync.

**Why**: durable steps, per-step retries, 30 min per step, built-in
`waitForEvent` for future approval/budget pauses, and Vitest mocks for steps.
Avoids building our own checkpointing on Queues + D1.

**Alternatives**: Queues-only orchestrator (more code, fragile checkpoints);
Durable Object per run (stateful but no durable retries/sleeps out of the box).

**Risk**: local dev of Workflows; mitigate with the engine's in-process runner
used in tests and `wrangler dev`.
