# ADR-007: Canvas replaces the React Flow workflow editor

**Status**: accepted (2026-09-09), supersedes ADR-005

## Decision

The node editor is the Canvas at `/canvas` and `/canvas/:id`, implemented as a
plain-DOM React renderer in `apps/web/src/features/pages/CanvasPage.tsx` with
`apps/web/public/canvas.css`. The React Flow editor (`features/workflows/*`,
`@xyflow/react`) was removed. There is no `/workflows` route; every former link
points at `/canvas`.

The persisted format is unchanged: the Canvas edits the backend-owned
`WorkflowDocument` (§129–131). Editor-only state (groups, resized node sizes,
last viewport) lives under `meta.canvas` and is excluded from `hashDocument()`
so it never creates a version.

## Why

- The product direction is a single creative surface that matches the
  reference editor's interaction model: floating pills, grouped nodes with icon
  ports, inline results, an inspector on the right, an agent that edits the
  graph. React Flow's node/handle abstractions fought that look at every step.
- The renderer needs are small and well understood: absolute-positioned nodes
  in a scaled scene, SVG bezier wires computed from port positions, pointer
  capture on the board for drag/pan. Owning them is cheaper than styling
  around a library.
- Removing the second editor removed a second vocabulary ("workflow") from the
  product surface. Backend names (`/workflows`, `workflow_runs`, the engine)
  are unchanged: the engine is the heart of the platform (§165) and is not
  affected by which editor draws it.

## Consequences

- `docs/planning/CANVAS-PRODUCTION.md` is the work plan to take the Canvas from
  replica to production; UX.md's editor section must be rewritten to describe
  it (task 6.9.7).
- Schedules and incoming webhook triggers lost their only UI with the old
  editor's automation panel. They return inside the Canvas inspector when the
  engine work in Phase 6 lands; until then the backend features exist without
  a front end.
- Canvas code must stay free of model ids and provider names (§155); the CI
  guard in task 6.9.2 enforces it.
