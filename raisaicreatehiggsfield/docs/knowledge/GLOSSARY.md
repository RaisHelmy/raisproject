# Glossary

- **Model** — a data record describing an AI model: capabilities, schemas, pricing, limits, status. Never a class.
- **Capability** — a string flag such as `text-to-image`, `image-input`, `multiple-images`, `negative-prompt`, `seed`, `aspect-ratio`, `duration`, `resolution`, `tool-calling`, `json-mode`, `vision`. UI and validation key off these.
- **Generation** — one provider execution (one model call) with inputs, outputs, cost, provider request id. Created by Quick Create or by an AI node inside a workflow run.
- **Workflow** — a definition: JSON of nodes, edges, variables. Versioned (`workflow_versions`).
- **Workflow Run** — an execution of a specific workflow version. Has status, cost totals, outputs.
- **Node Run** — execution record of one node inside a run.
- **Template** — a published, versioned workflow with declared variables and metadata. Executing a template creates a workflow run bound to the template version.
- **Variable** — typed workflow input (`{{name}}`), declared with type, required, default.
- **Port** — a typed input (○) or output (●) on a node.
- **Asset** — a stored result or upload: R2 object + D1 metadata, versioned.
- **Project** — the container for everything a user makes. Every entity has `project_id`.
- **Organization** — billing/ownership boundary. Personal accounts are single-member orgs.
- **Estimated cost** — customer-facing MYR figure computed before execution.
- **Charged amount / actual cost** — customer-facing MYR figure after execution.
- **Provider cost / markup / margin** — admin-only accounting fields. Never serialized to customer APIs.
- **Reservation** — ledger hold on balance for the estimated cost, settled to a charge + refund.
- **Movie** — a project-level production entity with story, characters, locations, scenes, shots, timeline.
- **Shot** — smallest generation unit in Movie mode; maps to a generation (image) and optionally another (video).
