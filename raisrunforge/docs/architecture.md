# RunForge architecture notes

This file collects the "why," not the "what" — the top-level README and each
package's own code comments cover day-to-day usage. Read this when deciding
where a new piece of functionality belongs.

## Layering rule

```text
apps/web        → talks only to the REST API (never imports @runforge/providers directly)
apps/api        → thin Hono routes; no business logic, only request parsing + calling domain services
packages/domain → owns every business rule, permission check, and event/audit write
packages/providers → infrastructure adapters behind typed interfaces (Demo, Docker, Cloud Run, Cloudflare, ...)
packages/database  → D1/R2 persistence, implementing packages/domain's repository interfaces
packages/shared     → types every other package imports; no logic, no dependencies
```

If you're adding a feature and unsure where it goes: does it decide
*whether* an action is allowed, or *what happens* to control-plane state?
That's `packages/domain`. Does it talk to a server/container/database that
isn't RunForge's own D1? That's a provider. Everything else is routing or
rendering.

## Why REST and MCP share `RunForge` (packages/domain/src/runforge.ts)

The product spec is explicit: "Do not duplicate business logic between REST
and MCP." Both `apps/api/src/routes/*` and
`packages/domain/src/mcp/mcp-service.ts` are constructed with the same
`RunForge` instance and call the same service methods
(`rf.applications.restart(ctx, id)`, etc.). A new capability exposed to MCP
is, by construction, also exposed to REST and vice versa — there's no
parallel implementation to keep in sync.

## Why permissions live in the domain layer, not the route handlers

`PermissionService.require(ctx, permission)` is called *inside* each domain
service method, not in the Hono route. That means:

- MCP tool calls get the exact same enforcement as REST calls, without the
  MCP dispatcher needing its own copy of the rules.
- A new REST endpoint or MCP tool can't accidentally skip authorization —
  it's enforced inside the service method it has to call to do anything.

## Why the Demo Provider computes deployment progress from wall-clock time

`DemoApplicationProvider.getDeploymentProgress` derives the current stage
from `Date.now() - startedAt`, not from stored mutable state. That makes it
safe to call from multiple concurrent requests (or after a Worker isolate
recycle, as long as `DemoWorld` itself survives) without a lock — the state
machine is a pure function of elapsed time.
