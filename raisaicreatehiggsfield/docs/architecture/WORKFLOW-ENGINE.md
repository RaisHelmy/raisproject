# Workflow Engine

The engine is the heart of the product (§165). It is pure TypeScript in
`apps/worker/src/engine` with no Cloudflare imports, plus a thin runner that
executes it inside a Cloudflare Workflow.

## WorkflowDocument (JSON, backend-owned, §129–131)

```ts
type PortType = 'string'|'number'|'boolean'|'json'|'image'|'image[]'|'video'|'audio'|'file'|'text'|'prompt'|'model'|'array'|'object'|'any'

interface WorkflowDocument {
  version: 1
  nodes: NodeInstance[]
  edges: Edge[]
  variables: VariableDef[]
  settings?: { maxCostSen?: number; cache?: boolean; maxParallel?: number }
  meta?: { name?: string; description?: string }
}
interface NodeInstance {
  id: string            // stable within document
  type: string          // registry key e.g. "ai.model", "input.text", "output"
  version: number       // node definition version
  config: Record<string, unknown>   // static values (model id, params, template text)
  position: { x: number; y: number } // editor only, ignored by engine
  retry?: { count: number; delayMs: number; on: ('provider_timeout'|'provider_error'|'rate_limited')[] }
  cache?: boolean
}
interface Edge { id: string; from: { node: string; port: string }; to: { node: string; port: string } }
interface VariableDef { name: string; type: PortType; required: boolean; default?: unknown; label?: string; enum?: string[] }
```

## Node definitions (registry, §128, §132)

```ts
interface NodeDefinition {
  type: string; version: number; category: 'ai'|'input'|'output'|'media'|'logic'|'data'|'automation'|'developer'|'mcp'|'utility'
  label: string; description: string; beginner?: boolean   // beginner=true shows in the short palette
  inputs: PortDef[]; outputs: PortDef[]
  configSchema: ZodSchema           // validated on save and before run
  estimate(ctx: EstimateCtx): Promise<CostEstimate>   // returns 0 for non-AI nodes
  execute(ctx: ExecCtx): Promise<Record<string, PortValue>>
  dynamicPorts?(config): { inputs: PortDef[]; outputs: PortDef[] }  // ai.model changes ports by capability
}
```
`registerNode(def)` populates an in-memory map; the worker registers built-ins at
startup. Definitions are serializable (minus functions) for the palette endpoint
`GET /api/v1/nodes`.

### MVP node set (§148)
| type | inputs → outputs | notes |
| --- | --- | --- |
| `input.text` | – → text | value from config or variable binding |
| `input.image` | – → image | asset id from config / variable |
| `input.variable` | – → any | typed from `variables[]`; generic form of the two above |
| `prompt` | text*, image[]? → prompt | template with `{{var}}` interpolation; wraps into typed prompt |
| `ai.model` | dynamic by capability → dynamic | task + model + params; the only AI node in MVP |
| `ai.image` / `ai.video` / `ai.text` | sugar presets over `ai.model` with task pre-selected | same executor |
| `merge` | any[] → array/object | join strategy in config |
| `http` | json? → json, text | GET/POST/PUT/PATCH/DELETE, headers, timeout, connector auth ref, allowlist |
| `output` | any → – | marks workflow outputs; name in config |

Phase 2+: `transform` (JSONPath/jq-lite), `condition`, `router`, `split`, `loop`
(bounded), `delay`, `webhook.trigger`, `mcp.tool`, `media.*`, `audio.mix`,
`video.compose`, `agent`.

## Type compatibility
`image → image` ok; `image → image[]` ok (wrap); `text → prompt` ok; `prompt → text`
ok; `string ↔ text` ok; anything → `any` ok; everything else invalid. Table lives
in `engine/types.ts` and is used by both the editor and validation.

## Validation (§127) — returns all errors together
Checks: unknown node type/version, config schema, required inputs unconnected
and without default, invalid port types, missing model / model not enabled /
model lacks required capability, unsupported parameter for model, cycle (unless
node is a bounded loop), unreachable output, no output node, variable type
mismatch, permission on referenced assets, node count / fan-out limits, and
finally balance vs estimate. Each error: `{ code, nodeId?, edgeId?, port?, message, action? }`.

## Estimation (§28)
`estimateWorkflow(doc, vars)` = Σ node.estimate. AI node estimation uses the
model pricing shape (see BILLING.md) with the resolved parameters; unresolved
upstream sizes fall back to model defaults and the estimate is flagged
`approximate: true` → UI shows "Estimated from current provider pricing."

## Execution
1. `WorkflowExecutionService.start(doc version, vars, opts)`:
   validate → estimate → check balance → create `workflow_runs` + `node_runs(pending)`
   → ledger `reservation` → launch Cloudflare Workflow instance with `{ runId }`.
2. Runner (`RaisWorkflowRun.run`): topologically sort; schedule ready nodes in
   waves up to `maxParallel` (default 3). Each node = `step.do(nodeId, retryCfg)`:
   load inputs from completed node_runs, compute cache key
   (`sha256(type+version+config+inputs)`), serve from `node_cache` if enabled
   (status `cached`), else execute via injected ports, persist output, persist
   generation rows for AI nodes, append actual cost, check `maxCostSen`
   (pause run with status `paused`, reason `budget`, if exceeded).
3. Completion: settle reservation (charge actual, refund remainder), write
   `outputs_json`, emit `workflow.completed|failed` event to the events queue.
4. Cancellation: `cancelJob` on in-flight generation where supported, mark
   remaining `skipped`, refund reservation minus actual.
5. Partial execution (§26): `start` accepts `fromNodeIds`; upstream nodes are
   marked `skipped` with outputs copied from the source run (`rerunOf`).
6. Retry policy (§63): only retry codes in `retry.on`. `invalid_input`,
   `insufficient_balance`, `permission_denied` are never retried.
7. Resume from failed node (§64): new run with `rerunOf` + `fromNodeIds=[failed]`.

## Status streaming (§66)
Runner writes node_run status rows; `GET /workflow-runs/:id/events` serves SSE
by polling D1 every 1.5s per connection (cheap enough for MVP). Client falls
back to polling `GET /workflow-runs/:id`.

## Quick Create uses the same engine (ADR-004)
`GenerationService.create()` builds an ephemeral single-node document
(`ai.model` → `output`) and calls `WorkflowExecutionService`, so estimation,
reservation, retries, caching and history are identical. The ephemeral workflow
is stored as a hidden system workflow version so runs stay immutable.

## Limits (§108)
Defaults: 50 nodes, 200 edges, fan-out 10, loop iterations 20, 3 parallel AI
nodes, 5 concurrent runs per org, 100 MB per input file. Configurable per org.
