# Architecture

## Principles
- **Ask a question.** Everything else (models, modes, library, sources, plans) appears progressively.
- **Database-driven configuration.** Models, plans, plan↔model availability, providers, prompts, modes and categories are rows, not code. The frontend never hard-codes availability.
- **Centralised entitlements.** `services/entitlements.ts` (`IEntitlementService`) is the only place that reads plans: `canUseModel`, `canUseKnowledge`, `canUploadFile`, `canUseAdvancedMode`, `assertMessageQuota`, `knowledgeSearchAllowed`, `assertConversationQuota`. Effective plan = user subscription → best organization plan → Free. Cached 60 s in KV, invalidated on change.
- **Provider abstraction.** `services/ai/types.ts` `IAIProvider { chatStream, embed? }` with `OpenAIProvider` (also OpenAI-compatible servers), `AnthropicProvider`, `GoogleProvider`, `WorkersAIProvider`. `registry.ts` resolves the provider for a model (admin-stored AES-GCM-encrypted key → env secret) and `runChatWithFallback` retries once on the default model when the primary fails before producing text.
- **Intellectual honesty.** The versioned `safety` prompt forbids supernatural certainty and requires separating classical teaching / traditional belief / modern interpretation / evidence.

## Request flow (chat)
```
POST /api/chat/stream (SSE)
  → middleware: appContext (fresh postgres.js client per request) → authenticate (cookie or xz_ API key) → csrf → rateLimit
  → services/chat/service.streamChat
      1. entitlements: message quota, model (or fallback to default), mode (advanced gate), conversation quota
      2. persist user turn (new / edit truncates / regenerate drops previous answer)
      3. emit meta → status:thinking
      4. retrieval (services/knowledge/retrieval.ts): embed query (bge-m3) → pgvector cosine top-24 (permission-filtered SQL) + pg_trgm lexical → rerank = similarity·(0.55+0.45·source_weight) + 0.12·keyword overlap → ≤3 chunks/document → top-6 labelled ①…
      5. prompt (services/chat/prompt-builder.ts): general + mode + safety + language/style + library passages (RAG prompt) + follow-up instruction; history trimmed to model context budget; rolling summary for long chats
      6. runChatWithFallback → token events (follow-up block held back and parsed at the end)
      7. done: save message, cited sources (message_sources), usage_records (tokens, estimated cost), bump conversation, enqueue SUMMARIZE_CONVERSATION when long
```

## Knowledge pipeline (background)
`Upload → Extract (unpdf / DOCX XML / HTML / CSV / JSON / MD / TXT) → Clean → Chunk (paragraph-aware, ~900 chars, overlap, section + page tracking) → Embed (Workers AI bge-m3, batches of 20) → Store vectors (pgvector, HNSW) → Ready`, run by the queue consumer (`jobs/index.ts`); `JOB_MODE=inline` runs it in `waitUntil` for local dev. Progress and a step log are written to the document row; the admin UI polls.

## Knowledge permissions
`documents.visibility`: `public` (all), `premium` (plans with `allow_premium_knowledge`), `private` (members of the knowledge base's organization), `admin`. The retrieval SQL applies the filter, so nothing leaks through search or citations. Source quality: `source_type → source_weight` (primary classical 1.0 · scholarly 0.9 · historical 0.8 · modern commentary 0.7 · community 0.5).

## Modules
```
apps/api/src
  index.ts            Hono app, CORS, routes, cron endpoint, queue export
  middleware/         context, auth, CSRF, rate limit, admin guards, error handler
  db/client.ts        Hyperdrive-safe Db (SET LOCAL search_path per transaction)
  repositories/       identity, catalog, chat, knowledge, platform (plain SQL, typed rows)
  services/           auth, oauth, billing (Stripe), entitlements, email, search, audit, mappers
  services/ai         IAIProvider + providers + registry/fallback
  services/chat       prompt builder, streaming orchestration, summaries
  services/knowledge  extract, chunk, embed, retrieval, processing
  routes/             auth, catalog, conversations, chat, knowledge, files, account, billing, share, admin/*
  jobs/               queue consumer, housekeeping
  demo/               bundled demonstration documents
apps/web/src
  services/           api, sse, auth, prefs (theme/locale), toast, appdata (catalog + conversations)
  i18n/               en, zh-CN, zh-TW dictionaries (complete UI localisation)
  components/         Composer, MessageItem, Markdown (clickable citations), SourceDrawer/Viewer, CommandPalette (⌘K), Pickers, UpgradeDialog, Charts (Highcharts), ui
  layouts/            Marketing, App (sidebar + mobile bottom nav), Admin
  pages/              marketing, auth, app, admin
```
