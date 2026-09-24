# Canvas — production task plan

This file is the complete work plan for turning the Canvas page at `/canvas`
from a static replica into the real, production-ready node editor of RaisAI
Create. It is written to be executed task by task by Claude Sonnet.

Read this file top to bottom once. Then work one task at a time, in order,
following the session loop in `docs/planning/ITERATION-GUIDE.md`.

---

## 0. How to work this file

**Model policy.** Every task here runs on Sonnet unless marked `[hard]`. For a
`[hard]` task, try Sonnet first; if it fails twice, switch to Opus.

**Session loop for every task**

1. Read the task's `docs:` list and open every file under `touch:`. Read them
   before writing anything. Do not rely on memory of what a file contains.
2. Write the code. Keep `bun run typecheck` (in `apps/web` and `apps/worker`)
   and `bunx vitest run` (in `apps/web`) green at every commit.
3. Run the **verification** listed under the task. Most tasks verify with a
   Playwright script that measures DOM geometry or checks network calls.
   A screenshot that "looks right" is not verification.
4. Tick the task's checkbox in this file and, if anything deviated from the
   plan, add a one-line note under it.
5. Stop. Do not start the next task in the same turn unless it is tiny.

**Hard rules (from CLAUDE.md, these override anything below)**

- Money is prepaid ringgit. Show `Estimated cost RM x.xx` and `Charged RM x.xx`
  via `formatMYR()` from `@raisai/shared`. Never show "credits" or a bare
  number like `✦ 68` as a price. The replica currently shows `✦ 68`; task 6.4.6
  replaces it.
- No model ids, provider names or provider logic in `apps/web`. The web app
  reads models from `GET /models` and renders controls from capability flags
  and `parameters` (§9, §155).
- Binary content goes to R2 through `AssetService`; D1 holds metadata only (§68).
- Every mutation path validates ownership through the `AuthContext` that the
  service methods already take as their first argument.
- Never edit an applied migration. Add `0015_*.sql` and later.
- The customer DTO leakage test must keep passing when you touch DTOs.

**Definition of done for a UI task**: empty state, loading state, error state,
keyboard reachable, no console errors, a Playwright check.

**Definition of done for an API task**: Zod-validated body, `AppError` codes,
scope check, test beside the route, row added to
`docs/architecture/API-MCP-SDK.md`.

---

## 1. What exists today (read this, do not re-derive it)

### Frontend

| Thing | Where | State |
|---|---|---|
| Canvas page | `apps/web/src/features/pages/CanvasPage.tsx` | Visual replica of the reference editor. Nodes, groups and pan are React state seeded from static data. Drag, pan, wheel zoom, selection, title menu, add-node popover, inspector, model picker, assets picker and Agent panel are all **UI only**. Nothing is saved, nothing runs. |
| Canvas styles | `apps/web/public/canvas.css` | Complete look. Namespaced `.cv-*`. Loaded globally from `public/index.html`. |
| Static scene data | `apps/web/src/features/pages/canvasData.ts` | `NODES`, `GROUPS`, `EDGES`, `ADD_NODE_ITEMS`, `VIDEO_PICKER`, `IMAGE_PICKER`, `VERSIONS`, `AGENT_SUGGESTIONS`, `ASSET_THUMBS`. Demo content; to be replaced by real documents (task 6.1.x) and kept only as the seed for an "Example canvas" (task 6.9.6). |
| Shared engine types (frontend copy) | `apps/web/src/features/canvas/types.ts` | `PortDef`, `NodePaletteEntry`, `NodeInstance`, `WorkflowEdge`, `WorkflowVariable`, `WorkflowDocument`, `WorkflowDTO`, `ValidationError`, `NodeRunView`. Mirrors the worker's schema. |
| API client | `apps/web/src/lib/api.ts` | `api<T>(path, init)` prefixes `/api/v1`, adds CSRF, throws `AppError`. |
| Routes | `apps/web/src/app/App.tsx` | `/canvas` and `/canvas/:id` both render `CanvasPage` (the `:id` is ignored today). Public, outside the authed `Shell`. |
| Auth | `apps/web/src/features/auth/AuthContext.tsx` | `useAuth()` gives `user`. |

The old React Flow editor was deleted on 2026-09-09 (ADR-007). `@xyflow/react`
is no longer a dependency. Do not reintroduce it; the plain-DOM renderer in
`CanvasPage.tsx` is the editor.

### Backend (all of this works and is tested)

**Document format** — `apps/worker/src/engine/document.ts`
`WorkflowDocument { version: 1, nodes: NodeInstance[], edges: Edge[], variables, settings { maxCostSen?, cache, maxParallel }, meta { name?, description? } }`.
`NodeInstance { id, type, version, config, position {x,y}, retry?, cache?, label? }`.
`Edge { id, from {node, port}, to {node, port} }`.
`hashDocument()` ignores positions, so moving nodes never creates a version.

**Node types** — `apps/worker/src/engine/nodes/*.ts`, registered by
`registerBuiltinNodes()`. Relevant ones for the Canvas:

| Engine type | Ports in → out | Canvas node it becomes |
|---|---|---|
| `prompt` | `text:text`, `images:image[]` → `prompt:prompt`, `images:image[]` | **Prompt** node |
| `input.image` | – → `image:image` | **Image** (reference) node; `config.assetId` |
| `ai.model` | from the chosen model's task → same | **Image Generation** / **Video Generation** / **Voice** nodes; `config.modelId`, `config.parameters` |
| `ai.text` | `prompt` → `text` | **LLM Assistant** node |
| `ai.speech` | `text` → `audio` | **Voice Generator** node |
| `ai.video.from-image` | `prompt`, `image` → `video` | Video Generation when an image is wired in |
| `ai.batch` | `prompts:array` → `results:array`, `count` | fan-out helper (later) |
| `output` | `value:any` → – | implicit; every leaf generator is an output |

Port types and the directed compatibility table live in
`packages/shared/src/ports.ts` (`PORT_TYPES`, `isPortCompatible(from, to)`).

**Persistence** — tables in `apps/worker/migrations/0006_workflows.sql`:
`workflows` (name, project, visibility, current_version), `workflow_versions`
(immutable `document_json` + `document_hash`), `workflow_drafts` (one mutable
draft per workflow), `workflow_runs`, `node_runs`, `node_cache`.

**Routes** — `apps/worker/src/routes/workflows.ts` and `workflow-runs.ts`:

| Route | Does |
|---|---|
| `GET /nodes` | palette: serializable node definitions |
| `GET /workflows?projectId=` | list |
| `POST /workflows` | create `{ name, projectId, description?, document? }` |
| `GET /workflows/:id` | `WorkflowDTO` with the draft (or current version) document |
| `PATCH /workflows/:id` | `{ name?, description?, document? }` — rename and/or **save draft**; returns `{ savedAt }` |
| `DELETE /workflows/:id` | soft delete |
| `POST /workflows/:id/preview` | `{ variables }` → `{ valid, errors[], estimatedSen, approximate, currency }` |
| `POST /workflows/:id/run` | `{ variables?, fromNodeIds?, rerunOfRunId?, maxCostSen? }` — freezes the draft into a version, reserves money, runs (inline or durable), returns `RunSummary` |
| `GET /workflows/:id/export`, `POST /workflows/import`, `POST /workflows/:id/duplicate` | portable JSON |
| `GET /workflow-runs/:id` | `RunSummary { id, status, estimatedCostSen, actualCostSen, outputs, nodes: NodeRunState[], error?, pauseReason? }` |
| `GET /workflow-runs/:id/events` | SSE: `event: status` with the same `RunSummary` whenever it changes, then `event: done` |
| `POST /workflow-runs/:id/cancel` | cancel |

`NodeRunState { nodeId, nodeRunId, nodeType, status: pending|running|completed|failed|skipped|cached, attempt, outputs?, actualCostSen?, estimatedCostSen?, error?, generationId?, startedAt?, completedAt? }`.

Validation (`apps/worker/src/engine/validate.ts`) returns all errors at once
with codes `cycle, duplicate_connection, empty_workflow, invalid_config,
invalid_connection, limit_exceeded, missing_input, missing_variable,
model_missing, no_output, node_version_mismatch, unknown_node_type,
unknown_port, unreachable_output`. Limits: 50 nodes, 200 edges, fan-out 10.

**Assets** — `apps/worker/src/services/asset-service.ts` + `routes/assets.ts`.
`POST /assets` is `multipart/form-data` with `file` and optional `projectId`;
it writes the bytes to the R2 bucket bound as `ASSETS` under
`assetKey(orgId, projectId, assetId, version, ext)` and inserts `assets` +
`asset_versions` rows. `GET /assets/:id/content` streams the object with a
one-year immutable cache header. `GET /assets?projectId=&kind=&cursor=` lists.
`DELETE` soft-deletes. Asset DTO: `{ id, kind, name, mime, sizeBytes, width,
height, durationMs, version, projectId, generationId, url, tags, featured,
createdAt }`. `ThumbnailService` (`services/thumbnail-service.ts`) already
resizes through the `IMAGES` binding into `thumbnail_key`, but there is no
route that serves it yet.

**Models** — `GET /models` returns enabled models with `capabilities`,
`parameters` (typed `ParameterDef`s), `task`, `tags` (`recommended`, `fast`,
`quality`, `cheap`, `cinematic`, `experimental`) and a typical estimate.
`GET /models/:id` returns one. `GET /models/compatible?capabilities=&task=`
filters to models that can serve a given node. `POST /models/:id/estimate`
prices one request. The web app already has a capability-driven control
renderer at `apps/web/src/features/models/ParameterControls.tsx`. The Canvas must build its model
pickers and inspector controls from this, never from a hard-coded list.

**Money** — `PricingService`, `LedgerService`. A run reserves the estimate,
executes, then charges the actual and refunds the rest. `RunSummary` carries
`estimatedCostSen` and `actualCostSen`. Balance: `GET /balance`.

---

## 2. How people use Higgsfield's Canvas — and what that means for ours

These are the observed usage patterns of the reference editor, taken from its
own product surface (the screenshots we replicated, the Explore promo "One
canvas. Every workflow. Moodboard, chain workflows, and share with your team",
the Agent's suggested prompts, and the tool set). Each pattern lists the
capability our Canvas needs. **Every task in section 4 exists to serve one of
these.**

### 2.1 Product-ad and UGC variations (the dominant use)
A creator uploads a product shot and a selfie or model reference, writes one
prompt, and fans it out to a **row of Image Generation nodes**, often with
different models per node (GPT Image 2, Nano Banana Pro, Seedream), to compare
looks side by side. The best stills are then wired into **Video Generation**
(Seedance, Kling) for short vertical ads. This is exactly the canvas the owner
of this repo built on the reference: aircon product + selfie → six "Bil letrik
RM400?!" images → video.
→ Needs: multi-reference image input (`image[]` port), one prompt feeding many
generators, per-node model choice, per-node cost before running, run-selected
and run-all, results becoming reusable assets, downloading results.

### 2.2 Consistent character or brand face across scenes
Several reference photos of one person or mascot, then many generations that
keep the identity. Groups are used to keep "references" separate from "outputs".
→ Needs: groups that move as a unit and label a region, references that can be
wired to any number of generators, a way to re-run only the generators that
changed (partial run `fromNodeIds`).

### 2.3 Storyboard and batch exploration
One prompt node, a grid of empty generators, click Generate on each or run
everything, then keep the good ones. Cards show resolution and aspect chips.
→ Needs: fast "add generator" (the `+` popover), duplicate node, batch size
per node, clear per-node status (queued / running / done / failed), retry on a
single node, delete the misses.

### 2.4 Still → motion → sound pipelines
Image → Video → Voice/Audio chained by wires, with the Video node accepting
text, image, video and audio ports (the four-port node in the screenshots).
→ Needs: typed ports with compatibility checks while dragging a wire, video
runs handed to the durable runner (they outlast a request), progress streaming,
video results playing inline.

### 2.5 Moodboards and reference collecting
Drop many images on the board, arrange them, sticky notes and text for
direction, then share the board with a team or client.
→ Needs: drag-and-drop and paste upload straight onto the board, assets picker
(Uploads / Generations / Liked), text and sticky tools, read-only share link,
duplicate someone's shared canvas into your own workspace.

### 2.6 Agent-built workflows
"Ask Agent" with prompts like *Create a 2-week content plan*, *Adapt copy for
each platform*, *Write the launch video script*: the agent adds and wires nodes
for the user rather than only chatting.
→ Needs: an LLM endpoint that returns a **document patch** (nodes and edges to
add) which the Canvas applies and highlights, with the cost of the LLM call
shown like any other generation.

### 2.7 Versions, templates, sharing
Version history with auto-saved timestamps and restore; save a canvas as a
template with typed inputs; unlisted/public sharing.
→ Needs: list `workflow_versions`, restore a version as the new draft, "Save
as template" from the title menu, visibility control.

### What we deliberately do differently (CLAUDE.md §3, §93–94)
- **Prices in ringgit**, never `✦ 68`. Estimated before, charged after.
- **Capability-driven inspector**: the Video node shows Duration only when the
  chosen model declares a `duration` parameter; Generate Audio only when it
  declares audio. Nothing is hard-coded per model.
- **Balance gate**: insufficient balance shows the estimate, the balance and an
  "Add balance" action instead of a disabled button.

---

## 3. Target architecture (decide once, then follow)

### 3.1 The Canvas edits a `WorkflowDocument`, nothing else
The React state in `CanvasPage.tsx` becomes a single `doc: WorkflowDocument`
plus transient editor state (`selection`, `pan`, `zoom`, `dragging`, `hover`).
Everything the user sees is derived from `doc`. Saving is `PATCH
/workflows/:id { document }`. There is no separate "canvas format".

### 3.2 Canvas node kinds map to engine node types

```ts
// apps/web/src/features/canvas/mapping.ts  (new, task 6.1.1)
export type CanvasKind = "prompt" | "image" | "image-gen" | "video-gen" | "voice-gen" | "llm" | "text" | "sticky";

// engine type → canvas kind (for rendering)
export function kindOf(node: NodeInstance): CanvasKind
// canvas kind → engine type + default config (for the add-node popover)
export function blankNode(kind: CanvasKind, position): NodeInstance
```

- `prompt` ↔ `prompt`
- `image` ↔ `input.image` with `config.assetId`
- `image-gen` ↔ `ai.model` with a model whose `task` is `text-to-image` or
  `image-to-image` (pick by capabilities, not by id)
- `video-gen` ↔ `ai.model` with task `text-to-video` / `image-to-video`
- `voice-gen` ↔ `ai.speech`
- `llm` ↔ `ai.text`
- `text` and `sticky` ↔ `input.text` with `config.presentation: "text" | "sticky"`
  (no engine output is wired from a sticky; it is annotation)

### 3.3 Groups, sizes and editor-only data live in `meta`
`WorkflowDocument.meta` is a free object. Extend it (task 6.1.2) with:

```ts
meta.canvas = {
  groups: { id: string; label: string; x: number; y: number; w: number; h: number; dashed?: boolean }[];
  sizes: Record<nodeId, { w: number; h: number }>;   // only when a user resized
  viewport?: { x: number; y: number; zoom: number };  // last view, per document
}
```

`hashDocument()` in the worker must ignore `meta.canvas` the same way it
ignores positions, so moving a group or resizing never creates a version.

### 3.4 Ports
Port circles on the Canvas render the engine node's `inputs`/`outputs` from
the palette (`GET /nodes`) or, for `ai.model`, from the chosen model's task.
Wire validity while dragging is `isPortCompatible(fromType, toType)` from
`@raisai/shared`, and the server validates again on save.

### 3.5 Assets
- Upload node, drag-drop, paste and the assets picker all go through
  `POST /assets` (multipart) → asset id. The node stores `config.assetId`.
- Node artwork is `GET /assets/:id/thumbnail` (new, task 6.3.1) for the card
  and `GET /assets/:id/content` for the inspector and downloads.
- Generation outputs are already written to R2 by the engine and referenced
  from `node_runs.generation_id`; the Canvas shows them via the asset DTO
  returned in `RunSummary.nodes[].outputs`.

### 3.6 Running
- "Generate" on one node → `POST /workflows/:id/run { fromNodeIds: [id] }`.
- "Run all" → `POST /workflows/:id/run {}`.
- Then open `GET /workflow-runs/:id/events` (SSE) and map each
  `NodeRunState` onto the node card. Fall back to polling `GET /workflow-runs/:id`
  every 2 s if `EventSource` errors.
- Before running, call `POST /workflows/:id/preview` and show the estimate in
  ringgit. If `GET /balance` is below it, show the balance gate.

---

## 4. Tasks — Phase 6

Task ids are `6.<epic>.<n>`. `touch:` lists files to open first. `docs:` lists
what to read. `verify:` says how to prove it works. `[hard]` marks tasks that
may need Opus.

### E6.1 Document model, load, save, versions

- [ ] **6.1.1 Canvas ↔ document mapping module.**
  touch: `apps/web/src/features/canvas/types.ts`, new `apps/web/src/features/canvas/mapping.ts`, `apps/worker/src/engine/nodes/basic.ts`, `ai-presets.ts`.
  docs: WORKFLOW-ENGINE.md §"WorkflowDocument", this file §3.2.
  Steps: write `kindOf()`, `blankNode()`, `portsOf(node, palette, models)`. `blankNode("image-gen")` must choose the model by calling `GET /models?task=text-to-image` and taking the first `recommended` (fall back to first enabled); it must not contain a model id literal. Unit test the mapping with the ten node shapes in section 3.2 (vitest, `apps/web/src/features/canvas/mapping.test.ts`).
  verify: `bunx vitest run` green; a test asserts that `blankNode()` output passes the worker's `workflowDocumentSchema` (import the Zod schema via `@raisai/shared` if exported, else duplicate the check).

- [ ] **6.1.2 `meta.canvas` for groups, sizes and viewport.**
  touch: `apps/worker/src/engine/document.ts`, `apps/worker/src/engine/document.test.ts` (create if missing), `apps/web/src/features/canvas/types.ts`.
  Steps: add the optional `meta.canvas` Zod shape from §3.3 with `.passthrough()` so older docs still parse; make `hashDocument()` strip `meta.canvas`. Test: two documents differing only in `meta.canvas` hash equal.
  verify: worker test passes (`cd apps/worker && bunx vitest run src/engine/document.test.ts`, needs local Postgres — if unavailable, run the pure hashing test with the `node` vitest pool, see TESTING.md).

- [ ] **6.1.3 Load a real document on `/canvas/:id`.**
  touch: `CanvasPage.tsx`, `App.tsx`, new `apps/web/src/features/canvas/useCanvasDocument.ts`.
  Steps: a hook that fetches `GET /workflows/:id`, exposes `{ doc, setDoc, status: "loading"|"ready"|"error", error }`. `CanvasPage` renders from `doc` (nodes from `doc.nodes`, groups from `doc.meta.canvas.groups`, wires from `doc.edges`). Positions: `node.position`; sizes: `meta.canvas.sizes[id]` or the default for its kind. Remove all reads of `NODES/GROUPS/EDGES` from `CanvasPage`. Loading state: the board with a centred spinner pill. Error state: a centred card "This canvas could not be opened" with a Back link. Signed-out users hitting `/canvas/:id` get the login page with `?next=`.
  verify: Playwright: create a workflow through the API, open `/canvas/:id`, assert the node count equals `doc.nodes.length` and the wire `<path>` count equals `doc.edges.length`.

- [ ] **6.1.4 `/canvas` creates a new canvas.**
  touch: `CanvasPage.tsx`, `App.tsx`.
  Steps: visiting `/canvas` (no id) calls `POST /workflows { name: "Untitled", projectId }` using the default project (`GET /projects`, or the same `getOrCreateDefault` path the assets route uses — add `GET /projects/default` if none exists) and `navigate(`/canvas/${id}`, { replace: true })`. Signed-out visitors instead see the static example scene (task 6.9.6) with a "Sign in to save" pill; nothing is created.
  verify: Playwright signed in: `/canvas` ends on `/canvas/<id>` and `GET /workflows` lists it.

- [ ] **6.1.5 Autosave draft.**
  touch: `useCanvasDocument.ts`, `CanvasPage.tsx`, `canvas.css`.
  Steps: debounce document changes 800 ms, then `PATCH /workflows/:id { document }`. Skip the save while a pointer drag is in progress and save once on pointer-up. Show state in the title pill area: `Saved` / `Saving…` / `Unsaved changes` / `Couldn't save · Retry`. Retry with backoff (1 s, 3 s, 9 s) on network errors; on `409` or `invalid_input` show the message from `AppError`. Warn on `beforeunload` when unsaved.
  verify: Playwright: drag a node, wait 1.2 s, reload, node is at the new position (measure `getBoundingClientRect`).

- [ ] **6.1.6 Title menu is real: rename, duplicate, delete.**
  touch: `CanvasPage.tsx` (`TitleMenu`).
  Steps: Rename → inline editable title (not `window.prompt`), Enter saves via `PATCH { name }`, Escape cancels. Duplicate → `POST /workflows/:id/duplicate` then navigate to the copy. Delete → confirm dialog, `DELETE /workflows/:id`, navigate to `/projects`. Document title `<title>` follows the name.
  verify: Playwright covers all three.

- [ ] **6.1.7 Version history.**
  touch: new routes in `apps/worker/src/routes/workflows.ts`: `GET /workflows/:id/versions` → `{ items: [{ id, version, createdAt, createdBy, note }] }` and `POST /workflows/:id/versions/:version/restore` (copies that version's document into `workflow_drafts`, returns the document). `WorkflowService` gets `listVersions()` and `restoreVersion()`. Frontend: the Version history submenu lists real rows ("Current canvas · Live", then versions newest first, "Auto-saved" note; a version created by a run says "Run"). Clicking a version shows a read-only preview banner "Viewing version N · Restore · Back to live"; Restore calls the route and reloads the doc.
  docs: DATA-MODEL.md (versions are immutable, never UPDATE), API-MCP-SDK.md table.
  verify: worker test for both routes; Playwright: run once (task 6.4.4) so a version exists, open history, restore, assert doc equals that version.

- [ ] **6.1.8 Canvas list in Projects and the Projects rail.**
  touch: `apps/web/src/features/projects/ProjectsPage.tsx`.
  Steps: the "Canvases" list already calls `GET /workflows?projectId=`; add a "New canvas" button that does 6.1.4's create and a thumbnail (first image asset in the doc via the thumbnail route, else the dot-grid placeholder). Filter out rows where `is_system = 1` (Quick Create wrappers) — add `isSystem` to the list DTO if absent.
  verify: Playwright: a project with two canvases shows two cards.

### E6.2 Editing interactions

- [ ] **6.2.1 Add nodes from the popover for real.**
  touch: `CanvasPage.tsx` (`AddNodePopover`), `mapping.ts`.
  Steps: each item calls `blankNode(kind, position)` where position is the centre of the current viewport (convert with the existing `sceneScale()` and `pan`), appends to `doc.nodes`, selects it, and closes the popover. Upload → opens the file picker (6.3.2). Assets → opens the assets picker (6.3.4). Search filters items. Keyboard: arrow keys move the highlight, Enter adds, Escape closes. The popover anchors next to the `+` that opened it (toolbar `+` or a port's `+`), not centred.
  verify: Playwright: click `+`, choose "Image Generator", assert `doc.nodes.length` increased by one (expose `window.__canvasDoc` only when `import.meta.env.DEV`).

- [ ] **6.2.2 Delete, duplicate, undo, redo.**
  touch: `CanvasPage.tsx`, new `apps/web/src/features/canvas/history.ts`.
  Steps: `Delete`/`Backspace` removes selected nodes and their edges (not while focus is in an input/textarea). `Cmd/Ctrl+D` duplicates with a 24 px offset. `Cmd/Ctrl+Z` / `Shift+Cmd/Ctrl+Z` undo/redo over a 100-entry stack of documents; drags push one entry on pointer-up, not per move. The floating selection pill's trash button uses the same delete path.
  verify: vitest for `history.ts` (push, undo, redo, cap); Playwright for the keys.

- [ ] **6.2.3 Multi-select and marquee.**
  touch: `CanvasPage.tsx`, `canvas.css`.
  Steps: `Shift+click` toggles a node in the selection; dragging on empty board with the select tool draws a dashed marquee (`.cv-marquee`) and selects every node whose box intersects it; dragging any selected node moves the whole selection; the selection pill and handles appear on the bounding box of the selection when more than one node is selected; Inspector shows "N nodes selected" with only Delete and Group.
  verify: Playwright: marquee over two nodes → both `data-selected`; drag one → both moved by the same delta.

- [ ] **6.2.4 [hard] Wire by dragging from a port.**
  touch: `CanvasPage.tsx` (`Port`, `Wires`), `canvas.css`, `packages/shared/src/ports.ts`.
  Steps: pointerdown on an **output** port starts a wire; a live `<path>` follows the pointer; input ports that accept the type (`isPortCompatible`) get `data-accepts`, incompatible ones `data-rejects` (red outline); releasing over an accepting port appends an `Edge` with a `crypto.randomUUID()` id; releasing elsewhere cancels. Dragging from an **input** that already has a wire picks that wire up so it can be moved or dropped to disconnect. An input with `multiple: false` that already has a wire replaces it. Clicking a wire selects it (thicker, blue); Delete removes it. Server validation errors after save (`invalid_connection`, `duplicate_connection`) are shown on the node as a red badge with the message.
  docs: WORKFLOW-ENGINE.md §"Type compatibility".
  verify: Playwright: drag from the Prompt's `prompt` port to a generator's `prompt` port → `doc.edges.length + 1`; drag to an `image` port → no edge and the port showed `data-rejects` during the drag.

- [ ] **6.2.5 Groups: create, label, resize, ungroup.**
  touch: `CanvasPage.tsx`, `canvas.css`, `mapping.ts`.
  Steps: with ≥2 nodes selected, `Cmd/Ctrl+G` or the Inspector's "Group" wraps their bounding box (+24 px padding) in a new `meta.canvas.groups` entry; the frame tool in the toolbar draws a group by marquee. Double-click the blue "Group" tag to rename inline. Groups get corner handles when selected; dragging a handle resizes the frame (nodes do not scale). Ungroup removes the frame only. Dragging a node out of a frame keeps it out; dragging one in makes it a member (membership is geometric, as today).
  verify: Playwright: select two nodes, press Cmd+G, one group exists whose box contains both.

- [ ] **6.2.6 Resize nodes with the corner handles.**
  touch: `CanvasPage.tsx`, `canvas.css`.
  Steps: dragging a selected node's `.cv-handle[data-corner]` changes `meta.canvas.sizes[id]` with a 96×96 minimum, keeping the aspect ratio when `Shift` is held; ports re-lay along the new edge; wires follow. Image nodes keep `object-fit: cover`.
  verify: Playwright: drag the `br` handle by (+60,+40) → node box grew by the same scene delta.

- [ ] **6.2.7 Zoom to cursor, fit to content, real minimap.**
  touch: `CanvasPage.tsx`, `canvas.css`.
  Steps: `ctrl/cmd+wheel` zooms around the pointer (adjust `pan` so the scene point under the cursor stays put); `Fit` computes the bounding box of all nodes and sets zoom/pan to fit with 10% padding; `Shift+1` = fit, `Shift+0` = 100%. The minimap draws every node from `doc` and the **actual** viewport rectangle (derive from pan/zoom and board size); dragging the viewport rectangle pans. Persist `meta.canvas.viewport` on save and restore it on load.
  verify: Playwright: zoom at (300,300) → the node under (300,300) is still under (300,300) within 2 px.

- [ ] **6.2.8 Text and sticky tools; pen/shape/react/comment placeholders.**
  touch: `CanvasPage.tsx`, `canvas.css`, `mapping.ts`.
  Steps: `T` tool click on the board adds an `input.text` node with `config.presentation: "text"` and inline-editable content (contentEditable, saved on blur); the sticky tool adds `presentation: "sticky"` with the yellow paper look and colour swatch in the selection pill. Pen, shapes, react (heart) and comment tools show a small toast "Coming soon" and switch back to select — do not leave dead buttons.
  verify: Playwright adds a text node and types into it; reload shows the text.

- [ ] **6.2.9 Snapping, guides and alignment.**
  touch: `CanvasPage.tsx`, `canvas.css`.
  Steps: while dragging, snap node edges/centres to other nodes' edges/centres within 6 scene px and draw a 1 px blue guide line; hold `Alt` to disable. Inspector for multi-select gets Align left/centre/right/top/middle/bottom and Distribute horizontally/vertically.
  verify: Playwright: drag a node to within 4 px of another's left edge → both `x` equal.

### E6.3 Assets, uploads and R2

- [ ] **6.3.1 Thumbnail route.**
  touch: `apps/worker/src/routes/assets.ts`, `services/asset-service.ts`, `services/thumbnail-service.ts`.
  Steps: `GET /assets/:id/thumbnail` streams `asset_versions.thumbnail_key` from R2 with the same immutable cache header; if the key is null, generate it now through `ThumbnailService` (512 px wide JPEG), store the key, then stream; if the `IMAGES` binding refuses (SVG, video), redirect (302) to `/content`. Add `thumbnailUrl` to the asset DTO. Videos: store a poster frame later (6.3.6); until then `thumbnailUrl` is null for video.
  docs: API-MCP-SDK.md table.
  verify: worker test: upload a PNG, GET thumbnail → 200 `image/jpeg`, second call does not call IMAGES again (spy).

- [ ] **6.3.2 Upload from the Canvas: picker, drag-drop, paste.**
  touch: `CanvasPage.tsx`, new `apps/web/src/features/canvas/upload.ts`, `canvas.css`.
  Steps: `upload.ts` exposes `uploadFiles(files, projectId, onProgress)` using `XMLHttpRequest` (for progress) to `POST /assets` with `FormData`, one request per file, max 3 in flight. Accept `image/png, image/jpeg, image/webp, image/gif, video/mp4, video/webm, video/quicktime, audio/mpeg, audio/wav, audio/mp4`; reject others with a toast naming the type. Size limit 100 MB per file client-side (server enforces its own; if it returns `invalid_input`, show that message). Each file becomes an `input.image` node placed at the drop point or viewport centre, first showing a card with a progress ring, then the thumbnail. **The engine has no video or audio input node today** (verified 2026-09-09: only `input.image`, `input.text`, `input.variable` exist in `basic.ts`). Add `input.video` and `input.audio` to `apps/worker/src/engine/nodes/basic.ts` first, mirroring `input.image` exactly (`configSchema { assetId?, mime, variable? }`, one output port `video:video` / `audio:audio`, resolve the asset handle the same way), register them in `registerBuiltinNodes()`, add them to `mapping.ts`, and give each a worker test beside the existing `input.image` test. Board accepts `dragover`/`drop` of files and `paste` of image data. Highlight the board (`data-dropping`) during a file drag.
  verify: Playwright `setInputFiles` on the hidden input → `POST /assets` fired once per file, node count increased, node `<img>` `src` ends in `/thumbnail`.

- [ ] **6.3.3 Large video uploads go direct to R2 (multipart).**
  touch: new `apps/worker/src/routes/assets-uploads.ts`, `asset-service.ts`, `upload.ts`.
  Steps: `POST /assets/uploads { name, mime, sizeBytes, projectId }` → creates the asset row in state `uploading` and an R2 multipart upload (`env.ASSETS.createMultipartUpload(key)`), returns `{ assetId, uploadId, partSizeBytes: 10 MiB, parts: n }`. `PUT /assets/uploads/:assetId/parts/:n` streams the body into `uploadPart` and returns `{ etag }`. `POST /assets/uploads/:assetId/complete { parts: [{ partNumber, etag }] }` completes and marks the version ready. `DELETE …/uploads/:assetId` aborts. Client uses this path when a file is over 20 MB, three parts in flight, resumable within the session. Migration `0015_asset_upload_state.sql` adds `assets.upload_state TEXT NOT NULL DEFAULT 'ready'`; listing excludes `uploading` rows older than 24 h (a cron sweeper aborts them — add to the existing scheduled handler).
  docs: API-MCP-SDK.md (replace the "presigned" row), DATA-MODEL.md.
  verify: worker test with a 25 MB `Uint8Array`: three parts, complete, `GET /content` returns identical bytes.

- [ ] **6.3.4 Assets picker backed by the API.**
  touch: `CanvasPage.tsx` (`AssetsPicker`), `apps/worker/src/routes/assets.ts`.
  Steps: tabs — Uploads = `GET /assets?source=upload`, Generations = `GET /assets?source=generation`, Liked = `GET /assets?tag=liked` (add `source` and `tag` query filters to the list route and `AssetService.list` if missing; `source` already exists on the row). Filters Recent/All/Images/Videos map to `kind` and sort. Infinite scroll with `nextCursor`. `PUT /assets/:id/like` toggles the `liked` tag. Picking an asset either fills the node that opened the picker (`config.assetId`) or adds a new reference node when opened from the toolbar. Hover shows a heart to like and a trash to soft-delete (confirm). Empty states per tab ("Upload your first file", "Generate something and it lands here", "Tap the heart on any result").
  verify: Playwright: upload two files, open picker → two tiles; like one → Liked tab shows one.

- [ ] **6.3.5 Download and open-in-inspector.**
  touch: `CanvasPage.tsx` (`SelectionToolbar`, `Inspector`).
  Steps: the download button fetches `GET /assets/:id/content` as a blob and saves it with the asset name (for a generator node, the latest output asset). The Image inspector shows the full asset, dimensions, size, created date, Replace (opens picker) and Download. Video assets render a `<video controls>` in the inspector and a muted looping poster in the node.
  verify: Playwright intercepts the content request and asserts the `download` attribute filename.

- [ ] **6.3.6 Video poster frames.**
  touch: `thumbnail-service.ts`, engine output path in `services/generation-service.ts`.
  Steps: when a video asset version is created (upload complete or generation output), enqueue a job on the `EVENTS` queue that extracts a poster: if Cloudflare Media transformations are enabled for the zone use `/cdn-cgi/media/…time=1s` server-side to fetch a JPEG and store it as `thumbnail_key`; otherwise the client sends a poster captured from the `<video>` element via `PUT /assets/:id/poster` (multipart image, max 2 MB). Implement the client path first; it always works.
  verify: Playwright: upload an mp4, wait, node shows an `<img>` poster.

### E6.4 Generation nodes, inspector and running

- [ ] **6.4.1 Capability-driven inspector.**
  touch: `CanvasPage.tsx` (`Inspector`), **reuse** `apps/web/src/features/models/ParameterControls.tsx` (the capability-driven renderer Quick Create already uses; it takes `ParameterDef[]` from `apps/web/src/lib/types.ts`). Do not write a second renderer; if the Canvas needs a different visual density, add a `variant="canvas"` prop and the `.cv-*` styles.
  Steps: for an `ai.model` node load `GET /models/:id`; render one control per `parameters[]` entry by its `type` (`enum` → segmented chips or select, `number` with `min/max/step` → slider with value, `boolean` → toggle, `string` → input). Order and group as the reference does (Model row, then sliders, then a two-column grid for enum pairs like Resolution/Aspect ratio, then toggles). Show a control **only** if the parameter exists on the model. Batch size is the `count`/`n` parameter when declared. Values write to `config.parameters` immediately (autosave handles persistence).
  docs: MODEL-REGISTRY.md, UX.md §"Workflow editor".
  verify: vitest renders `ParameterControls` with a fake model having `duration` and asserts a slider exists; with a model lacking it, none.

- [ ] **6.4.2 Model picker from the registry.**
  touch: `CanvasPage.tsx` (`ModelPicker`), `mapping.ts`.
  Steps: `GET /models/compatible?task=<task>&capabilities=<what the wired inputs need>` (exists in `routes/models.ts`, backed by `ModelService.findCompatible`; e.g. a wired `image` input adds `image-input`) so the list only offers models that can take what is connected; group as "Recommended" (models tagged recommended) then the rest; each row shows display name, capability chips (resolution/duration ranges come from `parameters[].max`), and the typical estimate in ringgit; the `TOP` badge is the recommended tag; search filters. Choosing a model sets `config.modelId`, drops parameters the new model does not declare, and re-derives the node's ports (image-to-video gains an `image` input, text-to-video loses it). Changing model that makes an existing wire invalid removes the wire and shows a toast.
  verify: Playwright: open picker on the Video node, choose a different model, `config.modelId` changed and no model id string appears in `apps/web/src` (grep in CI, task 6.9.2).

- [ ] **6.4.3 Per-node estimate in ringgit.**
  touch: `CanvasPage.tsx`, `canvas.css`, `apps/worker/src/routes/workflows.ts`.
  Steps: add `POST /workflows/:id/estimate-node { nodeId }` → prices that node with its current config and upstream wiring (reuse the preview path filtered to one node; if too costly, call `POST /models/:id/estimate` from the client with the node's parameters). Show `Estimated RM 0.38` in the node footer and on the Generate button, replacing `✦ 68`. Recompute 400 ms after any config change. `approximate: true` renders `≈ RM 0.38` with a tooltip "Estimated from current provider pricing".
  verify: Playwright: change Duration → the footer amount changes; vitest for `formatMYR`.

- [ ] **6.4.4 [hard] Generate: run one node, run all, stream status.**
  touch: `CanvasPage.tsx`, new `apps/web/src/features/canvas/useRun.ts`, `canvas.css`.
  Steps: Generate on a node → `POST /workflows/:id/preview` first; if `valid` is false show the errors on the offending nodes and stop. Else if the estimate exceeds `GET /balance` show the balance gate (estimate, balance, "Add balance" → `/balance`). Else `POST /workflows/:id/run { fromNodeIds: [nodeId] }` and open the SSE stream. Map `NodeRunState` to the card: `pending` grey dot, `running` animated ring with elapsed seconds, `completed` shows the output asset (image → thumbnail, video → poster + play, audio → waveform bar + play, text → first lines), `failed` red badge with `error.message` and a Retry (re-run that node) / Edit (open inspector) / Skip pair, `cached` shows a "cached" chip. A top-right run pill shows "Running 2 of 6 · RM 1.20 reserved", Stop (`POST /workflow-runs/:id/cancel`), and on completion "Charged RM 1.12". "Run all" lives in the title menu and toolbar (`Cmd/Ctrl+Enter`). Reconnect the stream on error, then fall back to polling. Reload mid-run: on load, if `GET /workflow-runs?workflowId=&status=running` (add this list route) returns a run, resume streaming it.
  docs: WORKFLOW-ENGINE.md §"Execution", §"Status streaming"; BILLING.md.
  verify: worker integration test with `FakeAIProvider`; Playwright against the dev worker: click Generate, node reaches `data-status="completed"` and shows an `<img>` whose `src` contains `/assets/`.

- [ ] **6.4.5 Results become assets and versions.**
  touch: `CanvasPage.tsx`, `apps/worker/src/services/workflow-execution-service.ts`.
  Steps: each completed generator keeps a per-node result list (`node_runs` joined to generation outputs → assets). The node shows the latest; a "1/4" pager in the card walks previous results; "Use as reference" adds an `input.image` node wired from this result; "Save to Liked" tags it. `GET /workflows/:id/results?nodeId=` returns the history (new route, paginated).
  verify: run twice, pager shows 2, previous result still opens.

- [ ] **6.4.6 Prices everywhere in ringgit; remove every `✦ N`.**
  touch: `CanvasPage.tsx`, `canvasData.ts`, `canvas.css`.
  Steps: grep for `cost` and the spark icon in the canvas code; every price renders `formatMYR(sen)`. The example scene's costs become sen integers.
  verify: `grep -n "✦\|cv-node-cost\b" apps/web/src/features/pages/CanvasPage.tsx` shows only the formatted usage; leakage test passes.

- [ ] **6.4.7 Prompt node editing and references.**
  touch: `CanvasPage.tsx`, `canvas.css`.
  Steps: the Prompt node body is an auto-growing textarea editing `config.text` inline (no inspector needed), with a character count and a "Enhance with AI" action that calls the `ai.text` node path through a one-off run and offers Replace/Insert. Its `images` port accepts many wires (`image[]`); the card shows stacked reference thumbnails. The `+` below the prompt opens the assets picker and wires the chosen asset in.
  verify: Playwright types into the prompt, reloads, text persists.

- [ ] **6.4.8 Failure panel and partial re-run.**
  touch: `CanvasPage.tsx`.
  Steps: clicking a failed node's badge opens the inspector's "Run" tab: Reason, Action (from `AppError.action`), request id, Retry, Retry from here (`fromNodeIds` = this node and downstream), Skip (marks `retry.count: 0` and continues), and Debug (input/output JSON, duration, model, cost) when the user has Advanced mode on.
  verify: FakeAIProvider failure injection → badge, Retry succeeds on the second attempt.

### E6.5 Agent panel

- [ ] **6.5.1 [hard] Agent endpoint that returns document patches.**
  touch: new `apps/worker/src/routes/canvas-agent.ts`, `apps/worker/src/services/canvas-agent-service.ts`, `app.ts` route registration.
  Steps: `POST /workflows/:id/agent { message, selection?: string[] }`. The service loads the document, the palette and the enabled models, builds a system prompt describing the JSON patch grammar (`{ add: NodeInstance[], connect: Edge[], remove?: string[], set?: { nodeId, config }[], say: string }`), runs an `ai.text`-capable model through the **same** `GenerationService` path so it is priced, reserved and charged like any generation, validates the returned patch against `workflowDocumentSchema` after applying it to a copy, and returns `{ patch, say, chargedSen, generationId }`. Reject patches that exceed `DEFAULT_LIMITS`. Never execute the patch server-side; the client applies it.
  docs: WORKFLOW-ENGINE.md, BILLING.md, MODEL-REGISTRY.md (`ai.text`).
  verify: worker test with a fake model returning a fixed patch: response validates, balance decreased by the charge.

- [ ] **6.5.2 Agent panel UI applies patches.**
  touch: `CanvasPage.tsx` (`AgentPanel`), `canvas.css`.
  Steps: messages list (user / agent), the three suggestion chips seed the input, send shows a typing state, the reply's `say` renders as text, and the `patch` is applied to `doc` with new nodes placed to the right of the current content, selected, and pulsed once (`.cv-node[data-fresh]`). Show "Charged RM 0.04" under the reply. Undo removes the whole patch as one step. Errors show inline with Retry. Keep chat history in `meta.canvas.agentThread` (last 50 turns).
  verify: Playwright with the fake model: send "add an image generator" → node count +1 and the reply text is visible.

### E6.6 Sharing, templates, presets

- [ ] **6.6.1 Share link and read-only view.**
  touch: `apps/worker/src/routes/workflows.ts`, `public.ts`, `CanvasPage.tsx`.
  Steps: Share button opens a popover: visibility `private / unlisted / public` (`PATCH /workflows/:id { visibility }` — add to the schema and service), copy link. `GET /public/canvas/:id` returns the current version's document for `unlisted`/`public` workflows with asset URLs signed for 24 h (`GET /public/assets/:id/content?sig=` — HMAC of id+expiry with a server secret). `/canvas/:id` for a non-owner renders read-only: no drag, no inspector edits, a "Duplicate to my workspace" pill (`POST /workflows/:id/duplicate` across orgs is allowed only for unlisted/public).
  docs: API-MCP-SDK.md, DATA-MODEL.md (visibility already on `workflows`).
  verify: worker test: private → 404 publicly; unlisted → 200; Playwright as a second user sees read-only.

- [ ] **6.6.2 Save as template from the title menu.**
  touch: `CanvasPage.tsx`, `apps/web/src/features/templates/TemplatesPage.tsx`.
  Steps: "Save as template" opens a dialog: name, description, which Prompt/Image nodes become typed inputs (`variables`), preview asset (choose a result). Calls `POST /templates` with the frozen version. Templates page "Use" → `POST /templates/:id/execute` already exists; add "Open as canvas" → `POST /workflows { document: template.document }` then navigate.
  verify: Playwright round-trips a template into a new canvas with the same node count.

- [ ] **6.6.3 Chat button and comments — placeholder to real.**
  touch: `CanvasPage.tsx`.
  Steps: Chat opens the Agent panel's thread (same component) until team chat exists; document this in the button's tooltip. Comment tool stays "Coming soon" (6.2.8). Do not build team chat in this phase.
  verify: clicking Chat opens the panel.

### E6.7 Mobile and accessibility

- [ ] **6.7.1 Mobile is view-and-run only (§95).**
  touch: `canvas.css`, `CanvasPage.tsx`.
  Steps: under 900 px: pinch zoom and one-finger pan, tap a node to open a bottom-sheet inspector (read-only parameters, Generate button), no dragging of nodes, toolbar reduced to select/hand/search/+. Test on 390×844.
  verify: Playwright mobile emulation: tap node → sheet visible; drag attempt does not move the node.

- [ ] **6.7.2 Keyboard and screen reader pass.**
  touch: `CanvasPage.tsx`, `canvas.css`.
  Steps: every node body is a focusable `role="button"` with an `aria-label` "Image Generation, GPT Image 2, completed"; arrow keys move focus between nodes by geometry; `Enter` opens the inspector; `Shift+arrows` nudge the selected node by 8 px; visible focus ring `.cv-node:focus-visible`; toolbar is a `role="toolbar"` with roving tabindex; live region announces run status changes.
  verify: Playwright keyboard-only: Tab to a node, Shift+ArrowRight → x + 8.

### E6.8 Performance and resilience

- [ ] **6.8.1 Render budget for 50 nodes / 200 edges.**
  touch: `CanvasPage.tsx`, `Wires`.
  Steps: memoise `NodeView` (React.memo keyed on the node object and selection flag); during a drag, update only the dragged nodes' `style` through a ref and recompute wires for touched nodes only; throttle pointermove to animation frames. Measure with Playwright: drag for 1 s over a 50-node doc and read `performance.now()` deltas per frame; target p95 < 16 ms.
  verify: the measurement script is committed under `e2e/perf/canvas-drag.spec.ts` and asserts p95 < 16 ms.

- [ ] **6.8.2 Conflict-safe autosave.**
  touch: `apps/worker/src/routes/workflows.ts`, `services/workflow-service.ts`, `useCanvasDocument.ts`.
  Steps: `GET /workflows/:id` returns `draftUpdatedAt`; `PATCH` accepts `If-Unmodified-Since`-style `baseUpdatedAt` and returns `409 conflict` with the server draft when it differs. Client on 409 shows "Changed elsewhere · Reload / Keep mine" (Keep mine re-PATCHes with the new base).
  verify: worker test: two saves with the same base → second gets 409.

- [ ] **6.8.3 Offline and slow network states.**
  touch: `useCanvasDocument.ts`, `useRun.ts`, `CanvasPage.tsx`.
  Steps: `navigator.onLine === false` → banner "You're offline. Changes will save when you're back" and autosave pauses; SSE drop → "Reconnecting…" pill, exponential retry, then polling. Uploads resume per part (6.3.3).
  verify: Playwright `context.setOffline(true)` → banner; back online → save fires.

### E6.9 Hardening, cleanup, docs

- [ ] **6.9.1 e2e specs for the Canvas.**
  touch: new `e2e/canvas.spec.ts`.
  Steps: one spec per epic's happy path: create, add nodes, wire, upload, generate (FakeAIProvider in the e2e worker), version restore, share read-only. Update `e2e/library.spec.ts` "Open in Canvas" to assert the imported nodes rendered.
  verify: `bunx playwright test e2e/canvas.spec.ts` green.

- [ ] **6.9.2 CI guard: no model ids in the web app.**
  touch: `.github/workflows/*.yml`, `package.json` scripts.
  Steps: add `bun run lint:no-model-ids` that greps `apps/web/src` for the enabled model ids exported from `packages/seed-models` and fails on any hit outside test fixtures.
  verify: CI job passes; a deliberate hit fails locally.

- [ ] **6.9.3 Telemetry for the editor.**
  touch: `apps/web/src/lib/analytics.ts` (create if missing), `CanvasPage.tsx`.
  Steps: emit `canvas.node_added {kind}`, `canvas.wire_created`, `canvas.run_started {nodes, estimatedSen}`, `canvas.run_finished {status, chargedSen, ms}`, `canvas.upload {mime, sizeBytes, ms}`, `canvas.agent_used`. Send to the existing events queue via `POST /events` if the app has one; otherwise `console.debug` behind a flag and leave a TODO with the route name.
  verify: vitest asserts the emitter is called on node add.

- [ ] **6.9.4 Empty, loading and error states audit.**
  touch: `CanvasPage.tsx`, `canvas.css`.
  Steps: brand-new canvas shows a centred hint "Press + to add your first node, or drop an image here" that disappears after the first node; every panel (assets tabs, versions, results pager, agent) has an empty state; every fetch has a skeleton; every failure has a message and a retry.
  verify: Playwright screenshots of each state exist in `e2e/__screenshots__` and are reviewed once by a human.

- [ ] **6.9.5 i18n strings.**
  touch: wherever the app keeps its catalog (check `apps/web/src/i18n` or the `__I18N__` pattern). If the app has no i18n layer, skip and note it here.

- [ ] **6.9.6 Turn the demo scene into an "Example canvas".**
  touch: `canvasData.ts`, `CanvasPage.tsx`, seed script in `apps/worker`.
  Steps: convert `NODES/GROUPS/EDGES` into a real `WorkflowDocument` (`example-canvas.json` under `packages/seed-models` or a new `packages/seed-canvas`), seeded once per new user as "Example: product ad variations" with the placeholder images uploaded as assets on first open. Signed-out `/canvas` renders this document read-only. Delete the static `NODES/GROUPS/EDGES` exports afterwards.
  verify: new user's Projects shows the example canvas; it opens and runs with the fake provider.

- [ ] **6.9.7 Docs.**
  touch: `docs/architecture/UX.md` §"Workflow editor" → rename to "Canvas" and describe §3 of this file; `docs/architecture/API-MCP-SDK.md` route table (every new route above); `docs/planning/TASKS.md` Phase 6 pointer; `docs/decisions/ADR-007-canvas-editor.md` (exists; update status when done).

---

## 5. Order of work and dependencies

Do the epics in order. Inside an epic, top to bottom. The critical path to
"someone can build a product-ad canvas and get real results" is:

`6.1.1 → 6.1.2 → 6.1.3 → 6.1.4 → 6.1.5 → 6.2.1 → 6.2.4 → 6.3.1 → 6.3.2 → 6.3.4 → 6.4.1 → 6.4.2 → 6.4.3 → 6.4.4 → 6.4.6`

Ship that path first, then the rest.

## 6. Verification toolkit

`raisdownloadscreenshotautomate/node_modules/playwright` is available for ad
hoc scripts, but committed checks belong in `e2e/` and run with the repo's
Playwright. Patterns that have caught real bugs on this page:

- Measure `getBoundingClientRect()` before and after a gesture; never judge a
  drag from a screenshot.
- `document.elementFromPoint(x, y)` to find what is really covering a spot.
- `getComputedStyle(grid).gridTemplateRows` when rows look wrong.
- Intercept network with `page.waitForRequest` to prove a save or upload fired.

## 7. Known traps in this codebase

- All `public/*.css` files load globally. Bare short class names collide
  (`.tl` from the tool studios once styled the canvas selection handle). Use
  `.cv-*` names or data attributes.
- A `.cv button { padding: 0 }` reset outranks `.cv-share { padding }`. Write
  resets as `.cv :where(button)`.
- A grid that is its own scroll container squeezes `auto` rows; put
  `overflow: auto` on a wrapper.
- `<button>` does not grow to fit a ratio child; tiles are `<div>` + an
  absolutely positioned hit `<button>`.
- The repo auto-commits every ~2 min (`com.gitsyncdaemon.agent`). Keep the
  tree buildable at all times; there is no "before I commit" moment.
- Worker tests need a local Postgres for Hyperdrive; without it every worker
  test file fails at import. Pure-function tests can use the node pool.
