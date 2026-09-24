/** Domain types shared by the API (Cloudflare Worker) and the web app. Storage-neutral. */

export type Locale = "en" | "zh-CN" | "zh-TW";
export type Theme = "system" | "light" | "dark";
export type UserRole = "user" | "admin" | "super_admin";
export type PlanCode = "free" | "plus" | "pro" | "enterprise";
export type ModelTier = "basic" | "advanced" | "premium";
export type ProviderCode = "openai" | "anthropic" | "google" | "workers_ai" | "openai_compatible";
export type Visibility = "public" | "premium" | "private" | "admin";
export type SourceType = "primary_classical" | "scholarly" | "historical" | "modern_commentary" | "community";
export type DocumentStatus = "uploaded" | "extracting" | "cleaning" | "chunking" | "embedding" | "indexing" | "ready" | "failed" | "disabled";
export type MessageRole = "user" | "assistant" | "system";
export type MessageStatus = "complete" | "streaming" | "error" | "stopped";
export type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled" | "incomplete";
export type ResponseStyle = "balanced" | "concise" | "detailed" | "scholarly";

export interface ApiSuccess<T> { success: true; data: T; warnings?: string[] }
export interface ApiFailure { success: false; error: { code: string; message: string; reference?: string; details?: unknown } }
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
export interface Page<T> { items: T[]; total: number; page: number; page_size: number }

export interface UserDTO {
  id: string; email: string; name: string; avatar_url: string | null; role: UserRole; locale: Locale; theme: Theme;
  email_verified: boolean; onboarding_completed: boolean; interests: string[];
  default_model_id: string | null; default_mode_id: string | null; response_style: ResponseStyle;
  memory_enabled: boolean; history_enabled: boolean; created_at: string;
}

export interface PlanDTO {
  id: string; code: PlanCode; name: string; description: string | null; price_monthly: number; currency: string;
  message_limit_daily: number | null; knowledge_search_limit_daily: number | null; context_window_tokens: number;
  max_upload_files_per_day: number; max_conversations: number | null; allow_file_upload: boolean; allow_advanced_modes: boolean;
  allow_premium_knowledge: boolean; allow_api_access: boolean; priority: number; features: string[]; is_active: boolean; sort_order: number;
  stripe_price_id: string | null;
}

export interface ModelDTO {
  id: string; name: string; description: string | null; provider_code: ProviderCode; provider_name: string; model_identifier: string;
  context_window: number; max_output_tokens: number; tier: ModelTier; is_active: boolean; priority: number; is_default: boolean;
  input_cost_per_million: number; output_cost_per_million: number;
  /** Populated for the current user: whether their plan can use this model, and which plan unlocks it. */
  available?: boolean; required_plan?: PlanCode | null;
}

export interface ModeDTO {
  id: string; code: string; name: string; name_zh: string; name_zh_tw: string; description: string; description_zh: string; description_zh_tw: string;
  icon: string; knowledge_filter: string[]; is_advanced: boolean; is_active: boolean; sort_order: number; available?: boolean;
}

export interface EntitlementsDTO {
  plan: PlanDTO; source: "user" | "organization" | "default";
  messages_used_today: number; messages_remaining_today: number | null;
  knowledge_searches_used_today: number; knowledge_searches_remaining_today: number | null;
  can_upload_files: boolean; can_use_advanced_modes: boolean; can_use_premium_knowledge: boolean; can_use_api: boolean;
  context_window_tokens: number;
}

export interface ConversationDTO {
  id: string; title: string; model_id: string | null; mode_id: string | null; use_knowledge: boolean; message_count: number;
  last_message_at: string | null; is_archived: boolean; is_pinned: boolean; share_token: string | null; created_at: string; updated_at: string;
}

export interface SourceDTO {
  id: string; rank: number; label: string; document_id: string; document_title: string; chunk_id: string;
  section: string | null; page_number: number | null; excerpt: string; score: number; source_type: SourceType;
  author: string | null; category: string | null; is_upload?: boolean;
}

export interface MessageDTO {
  id: string; conversation_id: string; role: MessageRole; content: string; status: MessageStatus; model_id: string | null; mode_id: string | null;
  request_tokens: number; response_tokens: number; feedback: -1 | 0 | 1; is_bookmarked: boolean; parent_message_id: string | null;
  sequence: number; suggestions: string[]; sources: SourceDTO[]; attachments: { id: string; filename: string }[]; error: string | null; created_at: string;
}

export interface CategoryDTO { id: string; code: string; name: string; name_zh: string; name_zh_tw: string; description: string | null; icon: string; sort_order: number; is_system: boolean; document_count?: number }

export interface KnowledgeBaseDTO { id: string; name: string; description: string | null; organization_id: string | null; visibility: Visibility; is_default: boolean; document_count?: number; created_at: string }

export interface DocumentDTO {
  id: string; knowledge_base_id: string; category_id: string | null; category_code: string | null; category_name: string | null; title: string; filename: string; mime_type: string; file_size: number;
  language: string; author: string | null; source: string | null; publication_date: string | null; tags: string[]; source_type: SourceType; source_weight: number;
  status: DocumentStatus; progress: number; chunk_count: number; embedded_count: number; error: string | null; visibility: Visibility; is_demo: boolean;
  processing_log: { at: string; step: string; message: string }[]; uploaded_by: string | null; created_at: string; updated_at: string;
}

export interface ChunkDTO { id: string; document_id: string; chunk_index: number; content: string; token_count: number; page_number: number | null; section: string | null }

export interface FileUploadDTO { id: string; filename: string; mime_type: string; size: number; status: DocumentStatus; chunk_count: number; error: string | null; created_at: string }

export interface OrganizationDTO { id: string; name: string; slug: string; plan_code: PlanCode | null; member_count?: number; role?: "owner" | "admin" | "member"; created_at: string }

export interface SubscriptionDTO { id: string; plan: PlanDTO; status: SubscriptionStatus; current_period_end: string | null; cancel_at_period_end: boolean; stripe_configured: boolean; managed_by: "stripe" | "admin" | "none" }

export interface PromptDTO { id: string; code: string; name: string; description: string | null; active_version: number | null; version_count: number; updated_at: string }
export interface PromptVersionDTO { id: string; prompt_id: string; version: number; content: string; notes: string | null; created_by: string | null; created_at: string; is_active: boolean }

export interface UsageSummaryDTO { requests: number; tokens: number; request_tokens: number; response_tokens: number; estimated_cost: number }

export interface AuditLogDTO { id: string; actor_id: string | null; actor_email: string | null; action: string; resource_type: string; resource_id: string | null; ip: string | null; result: "ok" | "error"; details: unknown; created_at: string }

/** Server-sent events emitted by POST /api/chat/stream */
export type ChatStreamEvent =
  | { type: "meta"; conversation_id: string; user_message_id: string; assistant_message_id: string; model_id: string; title?: string }
  | { type: "status"; status: "thinking" | "searching" | "generating" }
  | { type: "sources"; sources: SourceDTO[] }
  | { type: "token"; text: string }
  | { type: "done"; message: MessageDTO; usage: { request_tokens: number; response_tokens: number } }
  | { type: "error"; code: string; message: string };

export const LOCALES: Locale[] = ["en", "zh-CN", "zh-TW"];
export const SOURCE_TYPE_WEIGHTS: Record<SourceType, number> = { primary_classical: 1.0, scholarly: 0.9, historical: 0.8, modern_commentary: 0.7, community: 0.5 };
export const SUPPORTED_UPLOAD_TYPES: Record<string, string> = {
  "application/pdf": "pdf", "text/plain": "txt", "text/markdown": "md", "text/html": "html", "text/csv": "csv", "application/json": "json",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};
