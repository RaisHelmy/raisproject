# Database

PostgreSQL (shared instance `raishelmy`, schema **`xuanzhi`**), reached from the Worker through Hyperdrive (`HYPERDRIVE` binding, config `7a7777560d434c2b91ff37c52ab1b2c9`). Extensions `vector` (pgvector 0.8) and `pg_trgm` live in `public`.

## Hyperdrive caveats (baked into `src/db/client.ts`)
- Hyperdrive pools per transaction and drops session state, so every query runs inside `BEGIN; SET LOCAL search_path TO xuanzhi, public; …; COMMIT`.
- A fresh postgres.js client per request (Workers forbid cross-request socket reuse); `ssl: false` (Hyperdrive terminates TLS).
- `int8`/`numeric` are parsed to JS numbers.

## Tables
| Group | Tables |
|---|---|
| Identity | `users`, `sessions`, `oauth_accounts`, `oauth_states`, `email_tokens`, `api_keys`, `rate_limits` |
| Plans & orgs | `plans`, `organizations`, `organization_members`, `subscriptions` |
| AI config | `ai_providers` (encrypted keys), `models`, `plan_models`, `prompts`, `prompt_versions`, `ai_modes` |
| Knowledge | `knowledge_categories`, `knowledge_bases`, `documents`, `document_chunks`, `document_embeddings` (`vector(1024)`, HNSW cosine), `document_permissions`, `file_uploads`, `file_upload_chunks` |
| Chat | `conversations` (summary, share_token, soft delete), `messages` (sequence, feedback, bookmark, suggestions), `message_sources` |
| Platform | `usage_records`, `system_settings`, `audit_logs`, `topic_events`, `schema_migrations` |

All ids are `uuid`, timestamps `timestamptz`, JSON as `jsonb`; soft deletion via `deleted_at` on users, organizations, knowledge bases, documents, conversations.

## Migrations
Hand-written SQL in `apps/api/migrations/` (`0001_init.sql`, `0002_seed.sql`), applied with `bun run db:migrate` (records versions in `xuanzhi.schema_migrations`) or directly with `psql`.

```bash
# tunnel (keep open)
sshpass -p '…' ssh -L 15432:localhost:5432 helix@sshraisubuntu.raishelmy.uk
cd apps/api && DATABASE_URL="postgresql://postgres:postgres@localhost:15432/raishelmy" bun run db:migrate
# or on the VM
docker exec -i postgres psql -U postgres -d raishelmy -v ON_ERROR_STOP=1 < migrations/0003_x.sql
```

pgvector was installed into the `postgres` container with `apt-get install postgresql-18-pgvector` (2026-09-06). If the container is recreated from the plain `postgres:latest` image the package must be reinstalled (or switch the image to `pgvector/pgvector:pg18`).

## Seed data
`0002_seed.sql` (idempotent): 4 plans, 5 providers, 11 models (Workers AI open models + placeholder OpenAI/Anthropic/Google ids), plan↔model map, 16 categories, default knowledge base, 10 versioned prompts, 7 AI modes, settings. Demo documents are bundled in the Worker and loaded from Admin → Knowledge → **Load demo content** (or `POST /api/admin/knowledge/demo`).
