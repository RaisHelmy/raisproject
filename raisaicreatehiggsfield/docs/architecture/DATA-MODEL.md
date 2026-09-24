# Data Model (Postgres via Cloudflare Hyperdrive)

Conventions: `id TEXT PRIMARY KEY` (ULID), `created_at`/`updated_at` ISO strings,
money stored as integer **sen** (MYR × 100) in customer tables, provider cost as
integer micro-USD in admin tables. JSON columns hold serialized documents that
are validated by shared Zod schemas. Every content row has `org_id` and
(where applicable) `project_id`. Soft delete via `deleted_at` on assets,
projects, workflows, templates.

## Identity & tenancy
- `users` — id, email (unique), password_hash, name, role (`user`|`admin`), settings_json (advanced_mode, low_balance_threshold_sen), created_at
- `organizations` — id, name, kind (`personal`|`team`), owner_user_id, currency (`MYR`)
- `organization_members` — org_id, user_id, role (`owner`|`admin`|`member`), PK(org_id,user_id)
- `sessions` — id, user_id, expires_at, ip, ua
- `api_keys` — id, org_id, user_id, name, key_hash, prefix, scopes_json, expires_at, last_used_at, revoked_at
- `mcp_tokens` — same shape as api_keys
- `audit_log` — id, org_id, actor_user_id, actor_type, event, target_type, target_id, meta_json, request_id, created_at

## Projects
- `projects` — id, org_id, name, description, kind (`general`|`movie`), cover_asset_id, created_by, deleted_at
- `project_members` — project_id, user_id, role (future; personal orgs skip it)

## Models (registry)
- `models` — id (`@cf/...` or `author/model`), provider (`cloudflare`), hosting (`workers-ai`|`third-party`), display_name, description, category (`image`|`video`|`audio`|`text`|`vision`|`embedding`|`utility`), task (`text-to-image`|`image-to-video`|...), capabilities_json (string[]), input_schema_json, output_schema_json, parameter_schema_json (UI-oriented), limits_json, version, status (`discovered`|`configured`|`enabled`|`deprecated`), tags_json (`recommended`,`fast`,`quality`,`cheap`,`cinematic`,`experimental`), doc_url, sort_order, discovered_at, updated_at
- `model_pricing` — id, model_id, effective_from, unit (`tile_step`|`megapixel_tiered`|`tokens`|`audio_minute`|`characters`|`video_seconds`|`flat`), provider_price_json (admin), markup_percent, minimum_charge_sen, rounding_sen, customer_price_json (derived, used for estimates), currency, fx_rate_usd_myr
- `model_favorites` — user_id, model_id
- `model_usage_stats` — model_id, org_id, day, count, spent_sen (for "recently used")

## Assets
- `assets` — id, org_id, project_id, kind (`image`|`video`|`audio`|`document`|`reference`), name, mime, size_bytes, width, height, duration_ms, current_version, source (`upload`|`generation`), generation_id, thumbnail_key, tags_json, deleted_at
- `asset_versions` — id, asset_id, version, r2_key, mime, size_bytes, width, height, duration_ms, generation_id, created_at

## Generations
- `generations` — id, org_id, project_id, user_id, model_id, task, status (`queued`|`running`|`completed`|`failed`|`cancelled`), input_json (sanitized), parameters_json, idempotency_key (unique per org), estimated_cost_sen, actual_cost_sen, provider_cost_micro_usd (admin), provider_request_id (admin), error_code, error_message, workflow_run_id, node_run_id, started_at, completed_at, duration_ms, request_id
- `generation_inputs` — generation_id, port, asset_id | value_json
- `generation_outputs` — generation_id, port, asset_id | value_json

## Workflows
- `workflows` — id, org_id, project_id, name, description, current_version, visibility (`private`|`unlisted`|`public`), forked_from_workflow_id, deleted_at
- `workflow_versions` — id, workflow_id, version, document_json (WorkflowDocument), document_hash, created_by, created_at. **Immutable.**
- `workflow_drafts` — workflow_id, document_json, updated_at (autosave target; promoted to a version on run/publish)
- Derived, optional for querying: `workflow_nodes`, `workflow_edges`, `workflow_variables` keyed by workflow_version_id. Only populated by a projection from `document_json`; never edited directly.
- `workflow_runs` — id, org_id, project_id, user_id, workflow_id, workflow_version_id, template_version_id?, trigger (`ui`|`api`|`mcp`|`webhook`|`template`), status (`draft`|`queued`|`running`|`paused`|`completed`|`failed`|`cancelled`), variables_json, outputs_json, estimated_cost_sen, actual_cost_sen, max_cost_sen?, reservation_txn_id, cf_workflow_instance_id, partial_from_node_ids_json?, error_json, request_id, started_at, completed_at
- `node_runs` — id, workflow_run_id, node_id, node_type, model_id?, status (`pending`|`running`|`completed`|`failed`|`skipped`|`cached`), attempt, input_json, output_json, cache_key, estimated_cost_sen, actual_cost_sen, provider_request_id (admin), generation_id?, error_json, started_at, completed_at, duration_ms
- `node_cache` — org_id, cache_key, output_json, created_at, expires_at

## Templates
- `templates` — id, org_id, author_user_id, workflow_id, name, slug, description, category, tags_json, preview_asset_id, visibility, current_version, usage_count, estimated_cost_sen (from last publish), deleted_at
- `template_versions` — id, template_id, version, workflow_version_id, variables_json (declared inputs with type/required/default/label), model_preferences_json, changelog, published_at. **Immutable.**
- `template_variables` — projection of variables_json for search (optional)

## Billing (ledger)
- `balance_transactions` — id, org_id, type (`deposit`|`reservation`|`charge`|`refund`|`adjustment`), amount_sen (signed, customer-facing magnitude), **available_delta_sen**, **reserved_delta_sen**, balance_after_sen (available after), reference_type (`generation`|`workflow_run`|`payment`|`admin`), reference_id, reservation_id?, note, created_by, created_at, request_id
- `balances` — org_id PK, available_sen, reserved_sen, updated_at (materialized; every write happens in the same DB batch as the ledger insert)
- `payments` — id, org_id, provider (`stripe`|`toyyibpay`|`manual`), provider_txn_id, amount_sen, status, receipt_url, created_at
- `usage_records` — id, org_id, project_id, user_id, day, category, model_id, count, customer_spent_sen, provider_cost_micro_usd (admin)

## Webhooks & connectors
- `webhooks` — id, org_id, url, secret_hash, events_json, active
- `webhook_deliveries` — id, webhook_id, event, payload_json, status, attempts, last_error, next_retry_at
- `connectors` — id, org_id, type (`http_auth`|`mcp_server`), name, config_json (secrets encrypted), created_at

## Movies (phase 3, tables designed now so migrations stay clean)
- `movies` — id, project_id, title, logline, synopsis, style_json, status
- `characters` — id, project_id, name, age, description, appearance, personality, voice_json, reference_asset_ids_json
- `locations` — id, project_id, name, description, style, lighting, reference_asset_ids_json
- `scenes` — id, movie_id, number, title, location_id, time_of_day, characters_json, action, dialogue_json, visual_style, camera, lighting, duration_s
- `shots` — id, scene_id, number, type, camera_movement, description, duration_s, cinematic_json, image_asset_id, video_asset_id, selected_image_version, selected_video_version, status, cost_sen
- `timeline_tracks` — id, movie_id, kind (`video`|`voice`|`dialogue`|`music`|`sfx`|`subtitles`), order
- `timeline_items` — id, track_id, asset_id, start_ms, duration_ms, trim_in_ms, trim_out_ms, volume, fade_in_ms, fade_out_ms, muted

## Invariants
1. No balance mutation without a `balance_transactions` row in the same batch.
1a. `balances` is a cache, never the source of truth: for every org,
   `available_sen = SUM(available_delta_sen)` and `reserved_sen = SUM(reserved_delta_sen)`
   over its ledger. The per-bucket deltas exist because `type` alone is ambiguous —
   a charge settled against a reservation moves `reserved`, while an overage charge
   moves `available`. Enforced by a replay test in `apps/worker/test/ledger.test.ts`.
2. `workflow_versions` and `template_versions` rows are never updated.
3. `workflow_runs.workflow_version_id` is required; runs reference versions, never drafts.
4. Binary content never enters Postgres.
5. Customer serializers never include `*_micro_usd`, `markup_percent`, `provider_request_id`.
