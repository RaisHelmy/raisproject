# Testing Strategy (§126)

Runner: Vitest with `@cloudflare/vitest-pool-workers` for worker code (Postgres (Hyperdrive)/R2/AI
bindings mocked or local), plain Vitest for `engine/`, `billing/`, `shared/`.
Frontend: Vitest + Testing Library for components; Playwright smoke for the
create → generate → history loop against `wrangler dev` with a fake provider.

## Must-have suites (map to tasks in TASKS.md)
| Area | Cases |
| --- | --- |
| Pricing/estimation | each pricing shape; rounding; minimum charge; fx; approximate flag |
| Ledger | deposit/reserve/charge/refund arithmetic; overage; negative-balance path; concurrency (two reserves racing) |
| Idempotency | replayed POST returns same generation, one reservation |
| Model registry | capability filtering; parameter mapping; sync lifecycle never auto-enables |
| Node typing | compatibility table; invalid edge rejected; `any` and array wrapping |
| Validation | every error code; all errors returned together; cycle detection; unreachable output |
| Execution | topological waves; parallel limit; cache hit marks `cached`; partial run copies upstream outputs; budget pause; cancel refunds |
| Retries | only configured codes retried; attempt count persisted; never retry invalid_input/insufficient_balance |
| Failure recovery | resume from failed node reuses completed outputs |
| Template versioning | executing after a new publish still uses the bound version |
| Permissions | cross-org access denied on every service; API scopes enforced; MCP scopes enforced |
| API | contract tests per route with a fake provider; error envelope shape |
| MCP | every tool round-trips through the service with request id and scope |
| Customer DTO leakage | snapshot test asserting no `provider_cost`, `markup`, `margin`, `provider_request_id` in customer responses |

## Fake provider
`FakeAIProvider` implements `AIProvider` with deterministic outputs (1×1 PNG,
"lorem" text, silent WAV), configurable latency, failure injection by code,
and usage reporting, so every engine and API test runs without Cloudflare AI.
