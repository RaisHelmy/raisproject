# REST API

Base path `/api`. JSON in/out. All responses use one envelope:

```json
{ "success": true, "data": { ... }, "warnings": ["..."] }
{ "success": false, "error": { "code": "JIRA_SYNC_FAILED", "message": "Unable to synchronise with Jira.", "reference": "SYNC-20260904-00182" } }
```

Error codes: `UNAUTHORIZED` 401, `FORBIDDEN` 403, `NOT_FOUND` 404 (also used instead of 403 for records the caller may not know exist), `VALIDATION_ERROR` 400, `INVALID_STATE` 409, `CONFLICT` 409, `FILE_TOO_LARGE` 413, `UNSUPPORTED` 415, `RATE_LIMITED` 429, `CSRF_REJECTED` 403, `JIRA_*` 502, `INTERNAL_ERROR` 500 (with a reference; no stack traces).

## Authentication

* Browser: `POST /auth/login` sets an HttpOnly, SameSite=Lax session cookie. Mutating requests must send `X-Requested-With: RaisTimesheet` (CSRF).
* Integrations/MCP: `Authorization: Bearer rts_…` personal API token (create under Profile, or `POST /auth/mcp/bootstrap`).

## Endpoints

### Auth & profile
| Method | Path | Notes |
|---|---|---|
| POST | /auth/login · /auth/logout | rate limited |
| GET | /auth/me | user, roles, demo flags |
| PATCH | /auth/profile | name, timezone, WhatsApp aliases, Jira account id, onboarding |
| POST | /auth/change-password | |
| GET/POST/DELETE | /auth/api-tokens[/:id] | token shown once |
| POST | /auth/mcp/bootstrap | server-to-server, needs `MCP_BOOTSTRAP_TOKEN` |

### Organisation
| GET | /projects (`?all=1` for approvers) · /clients |
| GET/POST/PATCH | /admin/users[/:id] · /admin/clients[/:id] · /admin/projects[/:id] · /admin/projects/:id/members |
| GET | /admin/audit (`entity_type, actor_id, action, from, to, page`) · /admin/settings · /admin/health |
| PUT | /admin/settings/:key (`retention`, `demo.jira_failure_mode`) |

### Imports & AI review
| POST | /imports (multipart `file`, `project_id`) → 201, queued |
| GET | /imports · /imports/:id · /imports/:id/messages · /imports/:id/tasks |
| POST | /imports/:id/analyse (re-run) · /imports/:id/accept-all |
| POST | /imports/work-items/:id/accept (optional overrides) · /ignore · /restore · /split (`parts[]`) · /imports/work-items/merge (`ids[]`) |

### Timesheets & approvals
| GET | /timesheets (`scope=mine|all, status, jira_sync_status, project_id, client_id, work_status, date_from, date_to, q, sort, dir, page, page_size`) — returns `items, total, summary` |
| POST | /timesheets · /timesheets/bulk (`action: submit|approve|reject, ids[], reason`) |
| GET/PATCH/DELETE | /timesheets/:id (detail includes approvals, audit, Jira link/candidates/errors, source messages) |
| POST | /timesheets/:id/submit · /reopen · /approve · /reject (`reason`) |

### Jira
| GET | /jira/connection · /jira/summary · /jira/issues (`filter=all|mine|open|completed|delayed|due_soon|missing_timesheet, q, project_key`) · /jira/issues/:key (`?refresh=1`) · /jira/reconciliation (`view=needs_action|suggested|ready_to_create|ready_to_sync|synced|errors|all`) · /jira/errors · /jira/users (`q`) |
| POST | /jira/sync (refresh cache + reconcile) · /jira/connection/test · /jira/connection/api-token · /jira/connection/disconnect · /jira/create (bulk) |
| GET | /jira/oauth/start → `{url}` · /jira/oauth/callback (redirect) |
| POST | /jira/timesheets/:id/reconcile · /link (`issue_key, match_type`) · /ignore · /create (`summary, description, issue_type, assignee_account_id, force`) · /retry |
| GET | /jira/timesheets/:id/create-preview (defaults, duplicates, issue types) |

`POST /jira/timesheets/:id/create` returns `{status: QUEUED|ALREADY_LINKED|POTENTIAL_DUPLICATE, job_id?, issue_key?, duplicates?}` and is idempotent.

### Dashboard, notifications, search, reports, health
| GET | /dashboard · /notifications (`unread=1`) · /search?q= · /health · /ready |
| POST | /notifications/read (`ids[] | "all"`) |
| GET | /reports/preview · /reports/data (JSON for print view) · /reports · /reports/:id · /reports/:id/download |
| POST | /reports (`type, format: XLSX|PDF, date_from, date_to, project_id, client_id, user_id, status, jira_sync_status`) → generated synchronously, stored in R2 |

## Pagination & performance

Lists are paginated server-side (`page`, `page_size` ≤ 200) with server-side filtering and sorting. Search is debounced client-side and rate limited server-side. Large operations (analysis, Jira writes) are queued.
