# UX Architecture

Principle: progressive complexity (§163). Level 1 Create → 2 Advanced → 3 Workflow
→ 4 API/MCP → 5 Automation. Every screen answers: what can I do, what do I
need, how much will it cost, what is happening, what did I get, what next (§74).

## Navigation
- Beginner (default): Create, Projects, Templates, History, plus balance chip.
- Advanced toggle (Account → "Advanced mode"): adds Workflows, Assets, Usage,
  and a Developer group (API keys, MCP, Connectors, Webhooks). Admin appears for admins.
- Mobile: bottom nav with Create, History, Templates, Projects. Node editor is
  view/inspect/run only on mobile (§95).

## Create home (§11–13)
"What do you want to create?" cards: Image, Video, Audio, Text, Movie, Workflow.
Each opens Quick Create: Prompt → Reference (if any enabled model has
`image-input`) → Model (Recommended group, cost next to each) → few basic
controls → `<CostEstimate/>` → Generate. Basic/Advanced toggle reveals every
supported `parameters[]` with `advanced: true`. Controls render from the
selected model's capabilities and parameter schema; there is no per-model code.

Result view: preview, `<FinalCost/>` (Charged RMx.xx, Remaining RMy.yy),
actions Regenerate / Edit / Use as Input / Save as Template / Download / Open in Workflow.

## Workflow editor (§15–16, §78–84)
Canvas with pan/zoom/select/multi-select, typed handles (○ in, ● out), invalid
connections rejected with a tooltip, right-side config panel showing
capability-driven controls and `<CostEstimate/>` + Run Node, beginner palette
(Prompt, Image, Video, Text, AI, Output) with "More nodes" → searchable library
by category, output previews inside nodes, autosave with Saved/Saving/Unsaved,
Run/Stop, run-from-here, per-node status badges, failure panel with Reason /
Retry / Edit / Skip / Stop, debug drawer in advanced mode (input, output, time,
model, request id, cost, retries).

Library choice: React Flow (`@xyflow/react`) is the pragmatic pick for the canvas
(see ADR-005). Node bodies and panels are our Bootstrap components.

## Templates (§49–54)
Cards with preview, author, tags, usage count, estimated cost, supported models.
"Use Template" → typed variable form generated from `variables_json` → estimate → Run.
Public page `/templates/:id` with View / Preview / Use / Duplicate.

## History & Assets (§100–102)
Filter chips (All/Images/Videos/Audio/Text/Workflows/Movies), filters for project,
model, date, status, cost. `GenerationCard` and asset cards share action menus.

## Movie mode (§30–46, §86–87, phase 3)
Stepper: Story → Characters → Scenes → Storyboard → Shots → Audio → Timeline → Export.
Each step is a form/grid over movie entities; generation buttons execute system
workflows. "Open in Workflow" shows the underlying graph for a shot.

## Design system (§98–99)
Bootstrap 5 + Bootstrap Icons, CSS variables for theme, no Tailwind. Components:
Button, Modal, Drawer, Tabs, Card, Form, Select, FileUploader, ModelSelector,
CostEstimate, FinalCost, AssetPicker, NodeCard, NodeEditor, Timeline,
GenerationCard, TemplateCard, ProjectCard, StatusBadge, EmptyState.
Accessibility: semantic elements, labels, focus rings, keyboard shortcuts
documented, status conveyed with icon + text (never color alone).

## Empty states (§75)
Every list has a message + primary action. Never a blank panel.
