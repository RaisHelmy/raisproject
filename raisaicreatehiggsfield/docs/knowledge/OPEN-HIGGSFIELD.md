# Open-Higgsfield-AI — Reference Notes

Repo: https://github.com/Autom8AI/Open-Higgsfield-AI (Next.js 14, React 18,
Tailwind, Muapi.ai gateway, Electron wrapper, `packages/studio` component lib).

## Patterns worth adopting (re-implemented, not copied)

| Higgsfield pattern | RaisAI equivalent |
| --- | --- |
| `models.js` single source of truth per model: resolutions, aspect ratios, quality tiers, multi-ref support | D1 `models` table + `ModelDefinition` type; UI reads capabilities, never model ids |
| Auto-switch text-to-image ↔ image-to-image when a reference is added | Quick Create filters `ModelSelector` by required capability (`image-input`) when a reference is attached |
| Up to N reference images with order badges + "Use Selected" | `AssetPicker` multi-select honoring `limits.maxReferenceImages` from the model |
| Upload history picker (cached thumbnails, no re-upload) | Assets library (R2 + D1) surfaced inside every picker |
| Generation history with download | History page backed by `generations` + `assets` |
| Cinema Studio camera/lens/aperture → prompt modifiers | Cinematic controls in Movie mode, compiled by a `PromptBuilder` node; shown only when model supports free-text prompt |
| Dual-mode studios (text vs image driven) | One Create flow per media type with capability-driven controls |

## Deliberately different

- No Tailwind, no Next.js. Bun + React + Bootstrap on Cloudflare Workers.
- No browser-local persistence as the system of record. Everything is in D1/R2 under a project.
- No per-model UI branching. Capability flags only.
- Higgsfield is frontend-only; RaisAI has a workflow engine, ledger billing, API, MCP, SDK.
- Pricing shown in currency (MYR), never credits.
