# Roadmap

| Phase | Scope (CLAUDE.md) | Exit criteria |
| --- | --- | --- |
| 0 Foundation | repo, worker, D1 migrations, auth, ledger, registry skeleton, fake provider, CI | `bun test` green; login works; balance can be deposited (manual admin) and read |
| 1 MVP vertical slice (§147–149) | Quick Create image + text (+ video if a third-party video model is enabled), R2 assets, history, cost estimate + final cost, basic workflow editor, 10 MVP nodes, execution on Workflows, template saving | Beginner creates an image in <30s with correct RM charge; `[Prompt]→[AI Image]→[AI Video]→[Output]` runs end to end; template saved and re-run |
| 2 Platform (§150) | TTS, STT, music, image editing, multi-image refs, model comparison, public templates, REST API + API keys, MCP server, webhooks basics, usage dashboard | Agent runs a template over MCP; developer runs a workflow via API key; public template URL works |
| 3 Movie (§151) | Movie project, story generation to structured data, characters, locations, scenes, storyboard, shots, versioning, audio, timeline, export | 10-scene movie produced without leaving the app |
| 4 Automation (§152) | Node SDK, webhooks complete, webhook/schedule nodes, MCP node, agent node with budget, marketplace, collaboration prep | SDK published; automation template runs from an external webhook |

Sequencing rule: every phase ends with the app runnable, migrations clean,
tests green, and the beginner path still simple.
