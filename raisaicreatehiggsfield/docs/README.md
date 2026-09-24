# RaisAI Create — Documentation Index

CLAUDE.md is the product specification (167 sections). These docs turn it into
knowledge and an executable plan. Read in this order when starting a task:

1. `docs/planning/ITERATION-GUIDE.md` — how to work on this repo (read first, every session)
2. `docs/planning/TASKS.md` — the backlog; pick the next unchecked task
3. `docs/architecture/*.md` — the design the tasks implement
4. `docs/knowledge/*.md` — external facts (Cloudflare, Higgsfield) we verified
5. `docs/decisions/*.md` — ADRs; do not re-litigate, add a new ADR to change

| Path | Purpose |
| --- | --- |
| planning/ITERATION-GUIDE.md | Session workflow, conventions, definition of done |
| planning/TASKS.md | Epics → tasks with checkboxes, ordered by phase |
| planning/ROADMAP.md | Phases 1–4 with exit criteria |
| architecture/SYSTEM.md | Layering, monorepo layout, runtime topology |
| architecture/DATA-MODEL.md | D1 schema (tables, key columns, invariants) |
| architecture/WORKFLOW-ENGINE.md | Workflow JSON, port types, validation, execution |
| architecture/MODEL-REGISTRY.md | Model-as-data, capabilities, sync lifecycle |
| architecture/BILLING.md | Ledger, reservation flow, cost estimation, MYR conversion |
| architecture/API-MCP-SDK.md | REST surface, MCP tools, SDK, scopes |
| architecture/UX.md | Progressive disclosure, screens, components |
| architecture/TESTING.md | What must be tested and how |
| knowledge/CLOUDFLARE-AI.md | Verified facts about Workers AI + AI Gateway catalog |
| knowledge/OPEN-HIGGSFIELD.md | What to borrow / not borrow from the reference repo |
| knowledge/GLOSSARY.md | Domain vocabulary used in code and UI |
| decisions/ADR-*.md | Architecture decision records |
