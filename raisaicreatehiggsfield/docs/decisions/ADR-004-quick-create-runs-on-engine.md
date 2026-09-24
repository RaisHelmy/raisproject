# ADR-004: Quick Create executes through the workflow engine

**Status**: accepted (2026-09-05)

`GenerationService.create()` wraps the request in a hidden single-node workflow
version and runs it via `WorkflowExecutionService`. One execution path means
estimation, reservation, retries, caching, history and observability behave the
same for beginners and power users, and "Open in Workflow" is free.

Cost: one extra `workflow_runs` row per quick generation. Acceptable.
