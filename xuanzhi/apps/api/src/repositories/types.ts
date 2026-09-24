/** Row shapes as returned by postgres.js (timestamptz → Date, jsonb → parsed, numeric/int8 → number). */
import type { Locale, ModelTier, PlanCode, ProviderCode, SourceType, Theme, UserRole, Visibility, DocumentStatus, MessageRole, MessageStatus, SubscriptionStatus, ResponseStyle } from "@xuanzhi/shared-types";

export interface UserRow {
  id: string; email: string; name: string; password_hash: string | null; avatar_url: string | null; role: UserRole; locale: Locale; theme: Theme;
  email_verified_at: Date | null; onboarding_completed: boolean; interests: string[]; default_model_id: string | null; default_mode_id: string | null;
  response_style: ResponseStyle; memory_enabled: boolean; history_enabled: boolean; is_active: boolean; last_login_at: Date | null; created_at: Date; updated_at: Date; deleted_at: Date | null;
}
export interface SessionRow { id: string; user_id: string; token_hash: string; expires_at: Date; user_agent: string | null; ip: string | null; created_at: Date; last_seen_at: Date }
export interface OAuthAccountRow { id: string; user_id: string; provider: string; provider_account_id: string; email: string | null; created_at: Date }
export interface EmailTokenRow { id: string; user_id: string; purpose: "verify" | "reset"; token_hash: string; expires_at: Date; used_at: Date | null; created_at: Date }
export interface ApiKeyRow { id: string; user_id: string; organization_id: string | null; name: string; key_prefix: string; key_hash: string; last_used_at: Date | null; created_at: Date; revoked_at: Date | null }

export interface PlanRow {
  id: string; code: PlanCode; name: string; description: string | null; price_monthly: number; currency: string; message_limit_daily: number | null; knowledge_search_limit_daily: number | null;
  context_window_tokens: number; max_upload_files_per_day: number; max_conversations: number | null; allow_file_upload: boolean; allow_advanced_modes: boolean; allow_premium_knowledge: boolean;
  allow_api_access: boolean; priority: number; features: string[]; stripe_price_id: string | null; is_active: boolean; sort_order: number; created_at: Date; updated_at: Date;
}
export interface OrganizationRow { id: string; name: string; slug: string; owner_user_id: string; plan_id: string | null; created_at: Date; updated_at: Date; deleted_at: Date | null }
export interface SubscriptionRow {
  id: string; user_id: string | null; organization_id: string | null; plan_id: string; status: SubscriptionStatus; managed_by: "stripe" | "admin"; stripe_customer_id: string | null; stripe_subscription_id: string | null;
  current_period_start: Date | null; current_period_end: Date | null; cancel_at_period_end: boolean; created_at: Date; updated_at: Date;
}
export interface ProviderRow { id: string; code: ProviderCode; name: string; base_url: string | null; api_key_encrypted: string | null; is_active: boolean; priority: number; created_at: Date; updated_at: Date }
export interface ModelRow {
  id: string; provider_id: string; name: string; model_identifier: string; description: string | null; context_window: number; max_output_tokens: number; input_cost_per_million: number; output_cost_per_million: number;
  tier: ModelTier; supports_streaming: boolean; is_active: boolean; is_default: boolean; priority: number; created_at: Date; updated_at: Date;
  provider_code: ProviderCode; provider_name: string; provider_active: boolean;
}
export interface PlanModelRow { plan_id: string; model_id: string; enabled: boolean; priority: number }
export interface PromptRow { id: string; code: string; name: string; description: string | null; active_version_id: string | null; created_at: Date; updated_at: Date }
export interface PromptVersionRow { id: string; prompt_id: string; version: number; content: string; notes: string | null; created_by: string | null; created_at: Date }
export interface ModeRow {
  id: string; code: string; name: string; name_zh: string; name_zh_tw: string; description: string; description_zh: string; description_zh_tw: string; icon: string; prompt_id: string | null;
  knowledge_filter: string[]; is_advanced: boolean; is_active: boolean; sort_order: number; created_at: Date; updated_at: Date;
}

export interface CategoryRow { id: string; code: string; name: string; name_zh: string; name_zh_tw: string; description: string | null; icon: string; sort_order: number; is_system: boolean; created_at: Date; document_count?: number }
export interface KnowledgeBaseRow { id: string; name: string; description: string | null; organization_id: string | null; visibility: Visibility; is_default: boolean; created_at: Date; updated_at: Date; deleted_at: Date | null; document_count?: number }
export interface DocumentRow {
  id: string; knowledge_base_id: string; category_id: string | null; title: string; filename: string; mime_type: string; file_key: string | null; file_size: number; language: string; author: string | null; source: string | null;
  publication_date: string | null; tags: string[]; source_type: SourceType; source_weight: number; status: DocumentStatus; progress: number; chunk_count: number; embedded_count: number; error: string | null;
  visibility: Visibility; is_demo: boolean; processing_log: { at: string; step: string; message: string }[]; extracted_text: string | null; uploaded_by: string | null; created_at: Date; updated_at: Date; deleted_at: Date | null;
  category_code?: string | null; category_name?: string | null;
}
export interface ChunkRow { id: string; document_id: string; chunk_index: number; content: string; token_count: number; page_number: number | null; section: string | null; content_hash: string; created_at: Date }
export interface RetrievedChunkRow extends ChunkRow { score: number; document_title: string; source_type: SourceType; source_weight: number; author: string | null; category_code: string | null; knowledge_base_id: string; visibility: Visibility }
export interface FileUploadRow { id: string; user_id: string; conversation_id: string | null; filename: string; mime_type: string; size: number; file_key: string; status: DocumentStatus; chunk_count: number; error: string | null; expires_at: Date; created_at: Date }
export interface UploadChunkRow { id: string; upload_id: string; chunk_index: number; content: string; page_number: number | null; section: string | null; score?: number; filename?: string }

export interface ConversationRow {
  id: string; user_id: string; organization_id: string | null; title: string; model_id: string | null; mode_id: string | null; use_knowledge: boolean; summary: string | null; summary_until_sequence: number;
  message_count: number; last_message_at: Date | null; is_archived: boolean; is_pinned: boolean; share_token: string | null; shared_at: Date | null; created_at: Date; updated_at: Date; deleted_at: Date | null;
}
export interface MessageRow {
  id: string; conversation_id: string; role: MessageRole; content: string; status: MessageStatus; model_id: string | null; mode_id: string | null; request_tokens: number; response_tokens: number;
  feedback: -1 | 0 | 1; is_bookmarked: boolean; parent_message_id: string | null; sequence: number; suggestions: string[]; attachments: { id: string; filename: string }[]; error: string | null; created_at: Date; updated_at: Date;
}
export interface MessageSourceRow {
  id: string; message_id: string; rank: number; label: string; document_id: string | null; chunk_id: string | null; upload_id: string | null; document_title: string; section: string | null; page_number: number | null;
  excerpt: string; score: number; source_type: SourceType; created_at: Date;
}
export interface UsageRow { id: string; user_id: string | null; organization_id: string | null; model_id: string | null; kind: string; request_tokens: number; response_tokens: number; total_tokens: number; estimated_cost: number; created_at: Date }
export interface AuditRow { id: string; actor_id: string | null; actor_email?: string | null; action: string; resource_type: string; resource_id: string | null; ip: string | null; result: "ok" | "error"; details: unknown; created_at: Date }
