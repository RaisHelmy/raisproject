-- 玄知 AI (XuanZhi AI) — initial schema. PostgreSQL 16+ with pgvector.
--
-- All tables live in the `xuanzhi` schema inside the shared `raishelmy` database
-- (one Postgres instance, one schema per app — see IMPORTANT.md). The `vector`
-- extension lives in `public`; the API sets `search_path = xuanzhi, public` inside
-- every transaction (Hyperdrive does not preserve session state across statements).
--
-- Apply (over the SSH tunnel, see docs/database.md):
--   psql "$DATABASE_URL" -f migrations/0001_init.sql

CREATE EXTENSION IF NOT EXISTS vector SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA public;
CREATE SCHEMA IF NOT EXISTS xuanzhi;
SET search_path TO xuanzhi, public;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ───────────────────────── Identity ─────────────────────────

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT,                              -- NULL for OAuth-only accounts
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin','super_admin')),
  locale TEXT NOT NULL DEFAULT 'en' CHECK (locale IN ('en','zh-CN','zh-TW')),
  theme TEXT NOT NULL DEFAULT 'system' CHECK (theme IN ('system','light','dark')),
  email_verified_at TIMESTAMPTZ,
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  interests JSONB NOT NULL DEFAULT '[]'::jsonb,
  default_model_id UUID,
  default_mode_id UUID,
  response_style TEXT NOT NULL DEFAULT 'balanced' CHECK (response_style IN ('balanced','concise','detailed','scholarly')),
  memory_enabled BOOLEAN NOT NULL DEFAULT true,
  history_enabled BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX users_email_unique ON users (lower(email)) WHERE deleted_at IS NULL;
CREATE INDEX users_created_at_idx ON users (created_at);

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  user_agent TEXT,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx ON sessions (user_id);
CREATE INDEX sessions_expires_idx ON sessions (expires_at);

CREATE TABLE oauth_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google','apple','microsoft')),
  provider_account_id TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_account_id)
);
CREATE INDEX oauth_accounts_user_idx ON oauth_accounts (user_id);

CREATE TABLE oauth_states (
  state TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  code_verifier TEXT,
  redirect_to TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE email_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('verify','reset')),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX email_tokens_user_idx ON email_tokens (user_id, purpose);

CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  window_start TIMESTAMPTZ NOT NULL,
  count INTEGER NOT NULL DEFAULT 0
);

-- ───────────────────────── Organizations & plans ─────────────────────────

CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE CHECK (code IN ('free','plus','pro','enterprise')),
  name TEXT NOT NULL,
  description TEXT,
  price_monthly NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  message_limit_daily INTEGER,                     -- NULL = unlimited
  knowledge_search_limit_daily INTEGER,            -- NULL = unlimited
  context_window_tokens INTEGER NOT NULL DEFAULT 8000,
  max_upload_files_per_day INTEGER NOT NULL DEFAULT 0,
  max_conversations INTEGER,                       -- NULL = unlimited
  allow_file_upload BOOLEAN NOT NULL DEFAULT false,
  allow_advanced_modes BOOLEAN NOT NULL DEFAULT false,
  allow_premium_knowledge BOOLEAN NOT NULL DEFAULT false,
  allow_api_access BOOLEAN NOT NULL DEFAULT false,
  priority INTEGER NOT NULL DEFAULT 0,             -- processing priority (higher first)
  features JSONB NOT NULL DEFAULT '[]'::jsonb,     -- marketing bullet points
  stripe_price_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  owner_user_id UUID NOT NULL REFERENCES users(id),
  plan_id UUID REFERENCES plans(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE organization_members (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner','admin','member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);
CREATE INDEX organization_members_user_idx ON organization_members (user_id);

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES plans(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','trialing','past_due','canceled','incomplete')),
  managed_by TEXT NOT NULL DEFAULT 'admin' CHECK (managed_by IN ('stripe','admin')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (user_id IS NOT NULL OR organization_id IS NOT NULL)
);
CREATE INDEX subscriptions_user_idx ON subscriptions (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX subscriptions_org_idx ON subscriptions (organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX subscriptions_customer_idx ON subscriptions (stripe_customer_id);

-- ───────────────────────── AI providers, models, modes, prompts ─────────────────────────

CREATE TABLE ai_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE CHECK (code IN ('openai','anthropic','google','workers_ai','openai_compatible')),
  name TEXT NOT NULL,
  base_url TEXT,
  api_key_encrypted TEXT,                          -- AES-256-GCM with ENCRYPTION_KEY; never returned to clients
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES ai_providers(id),
  name TEXT NOT NULL,
  model_identifier TEXT NOT NULL,
  description TEXT,
  context_window INTEGER NOT NULL DEFAULT 32000,
  max_output_tokens INTEGER NOT NULL DEFAULT 2048,
  input_cost_per_million NUMERIC(10,4) NOT NULL DEFAULT 0,
  output_cost_per_million NUMERIC(10,4) NOT NULL DEFAULT 0,
  tier TEXT NOT NULL DEFAULT 'basic' CHECK (tier IN ('basic','advanced','premium')),
  supports_streaming BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider_id, model_identifier)
);

CREATE TABLE plan_models (
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (plan_id, model_id)
);

CREATE TABLE prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  active_version_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE prompt_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id UUID NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  content TEXT NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (prompt_id, version)
);
ALTER TABLE prompts ADD CONSTRAINT prompts_active_version_fk FOREIGN KEY (active_version_id) REFERENCES prompt_versions(id) DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE ai_modes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  name_zh TEXT NOT NULL,
  name_zh_tw TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  description_zh TEXT NOT NULL DEFAULT '',
  description_zh_tw TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT 'bi-stars',
  prompt_id UUID REFERENCES prompts(id),          -- system prompt (versioned) for this mode
  knowledge_filter JSONB NOT NULL DEFAULT '[]'::jsonb, -- category codes; [] = all
  is_advanced BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users ADD CONSTRAINT users_default_model_fk FOREIGN KEY (default_model_id) REFERENCES models(id) ON DELETE SET NULL;
ALTER TABLE users ADD CONSTRAINT users_default_mode_fk FOREIGN KEY (default_mode_id) REFERENCES ai_modes(id) ON DELETE SET NULL;

-- ───────────────────────── Knowledge base ─────────────────────────

CREATE TABLE knowledge_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  name_zh TEXT NOT NULL,
  name_zh_tw TEXT NOT NULL,
  description TEXT,
  icon TEXT NOT NULL DEFAULT 'bi-book',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE knowledge_bases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','premium','private','admin')),
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_base_id UUID NOT NULL REFERENCES knowledge_bases(id),
  category_id UUID REFERENCES knowledge_categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_key TEXT,                                   -- R2 object key (NULL for inline demo content)
  file_size BIGINT NOT NULL DEFAULT 0,
  language TEXT NOT NULL DEFAULT 'en',
  author TEXT,
  source TEXT,
  publication_date TEXT,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_type TEXT NOT NULL DEFAULT 'modern_commentary' CHECK (source_type IN ('primary_classical','scholarly','historical','modern_commentary','community')),
  source_weight REAL NOT NULL DEFAULT 0.7,
  status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded','extracting','cleaning','chunking','embedding','indexing','ready','failed','disabled')),
  progress INTEGER NOT NULL DEFAULT 0,
  chunk_count INTEGER NOT NULL DEFAULT 0,
  embedded_count INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','premium','private','admin')),
  is_demo BOOLEAN NOT NULL DEFAULT false,
  processing_log JSONB NOT NULL DEFAULT '[]'::jsonb,
  extracted_text TEXT,                             -- cleaned full text (for preview / reprocess without re-extracting)
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX documents_kb_idx ON documents (knowledge_base_id) WHERE deleted_at IS NULL;
CREATE INDEX documents_category_idx ON documents (category_id);
CREATE INDEX documents_status_idx ON documents (status);
CREATE INDEX documents_title_trgm_idx ON documents USING gin (title gin_trgm_ops);

CREATE TABLE document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  token_count INTEGER NOT NULL DEFAULT 0,
  page_number INTEGER,
  section TEXT,
  content_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, chunk_index)
);
CREATE INDEX document_chunks_content_trgm_idx ON document_chunks USING gin (content gin_trgm_ops);

CREATE TABLE document_embeddings (
  chunk_id UUID PRIMARY KEY REFERENCES document_chunks(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  embedding vector(1024) NOT NULL,
  model TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX document_embeddings_hnsw_idx ON document_embeddings USING hnsw (embedding vector_cosine_ops);
CREATE INDEX document_embeddings_document_idx ON document_embeddings (document_id);

CREATE TABLE document_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  principal_type TEXT NOT NULL CHECK (principal_type IN ('plan','organization','user')),
  principal_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, principal_type, principal_id)
);

-- ───────────────────────── Conversations ─────────────────────────

CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'New chat',
  model_id UUID REFERENCES models(id) ON DELETE SET NULL,
  mode_id UUID REFERENCES ai_modes(id) ON DELETE SET NULL,
  use_knowledge BOOLEAN NOT NULL DEFAULT true,
  summary TEXT,                                    -- rolling summary of older turns (context management)
  summary_until_sequence INTEGER NOT NULL DEFAULT 0,
  message_count INTEGER NOT NULL DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  share_token TEXT UNIQUE,
  shared_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX conversations_user_idx ON conversations (user_id, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX conversations_title_trgm_idx ON conversations USING gin (title gin_trgm_ops);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'complete' CHECK (status IN ('complete','streaming','error','stopped')),
  model_id UUID REFERENCES models(id) ON DELETE SET NULL,
  mode_id UUID REFERENCES ai_modes(id) ON DELETE SET NULL,
  request_tokens INTEGER NOT NULL DEFAULT 0,
  response_tokens INTEGER NOT NULL DEFAULT 0,
  feedback SMALLINT NOT NULL DEFAULT 0 CHECK (feedback IN (-1,0,1)),
  is_bookmarked BOOLEAN NOT NULL DEFAULT false,
  parent_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  sequence INTEGER NOT NULL,
  suggestions JSONB NOT NULL DEFAULT '[]'::jsonb,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{id, filename}] file_uploads referenced by a user message
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX messages_conversation_idx ON messages (conversation_id, sequence);
CREATE INDEX messages_bookmark_idx ON messages (conversation_id) WHERE is_bookmarked;
CREATE INDEX messages_content_trgm_idx ON messages USING gin (content gin_trgm_ops);

CREATE TABLE message_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL,
  label TEXT NOT NULL,
  document_id UUID,                                -- knowledge document (NULL for chat uploads)
  chunk_id UUID,
  upload_id UUID,                                  -- file_uploads.id when the source is a chat attachment
  document_title TEXT NOT NULL,
  section TEXT,
  page_number INTEGER,
  excerpt TEXT NOT NULL,
  score REAL NOT NULL DEFAULT 0,
  source_type TEXT NOT NULL DEFAULT 'modern_commentary',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX message_sources_message_idx ON message_sources (message_id, rank);

-- ───────────────────────── Chat file uploads (temporary RAG) ─────────────────────────

CREATE TABLE file_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size BIGINT NOT NULL DEFAULT 0,
  file_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded','extracting','cleaning','chunking','embedding','indexing','ready','failed','disabled')),
  chunk_count INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '30 days',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX file_uploads_user_idx ON file_uploads (user_id, created_at DESC);

CREATE TABLE file_upload_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id UUID NOT NULL REFERENCES file_uploads(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  page_number INTEGER,
  section TEXT,
  embedding vector(1024),
  UNIQUE (upload_id, chunk_index)
);
CREATE INDEX file_upload_chunks_upload_idx ON file_upload_chunks (upload_id);

-- ───────────────────────── Usage, settings, audit ─────────────────────────

CREATE TABLE usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  model_id UUID REFERENCES models(id) ON DELETE SET NULL,
  conversation_id UUID,
  message_id UUID,
  kind TEXT NOT NULL DEFAULT 'chat' CHECK (kind IN ('chat','embedding','knowledge_search','summary')),
  request_tokens INTEGER NOT NULL DEFAULT 0,
  response_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost NUMERIC(12,6) NOT NULL DEFAULT 0,
  knowledge_base_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX usage_records_user_day_idx ON usage_records (user_id, created_at DESC);
CREATE INDEX usage_records_created_idx ON usage_records (created_at DESC);
CREATE INDEX usage_records_model_idx ON usage_records (model_id, created_at DESC);

CREATE TABLE system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  ip TEXT,
  result TEXT NOT NULL DEFAULT 'ok' CHECK (result IN ('ok','error')),
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_created_idx ON audit_logs (created_at DESC);
CREATE INDEX audit_logs_actor_idx ON audit_logs (actor_id, created_at DESC);

CREATE TABLE topic_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  category_code TEXT,
  mode_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX topic_events_created_idx ON topic_events (created_at DESC);

INSERT INTO schema_migrations (version) VALUES ('0001_init');
