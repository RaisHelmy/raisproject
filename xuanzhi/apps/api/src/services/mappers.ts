import type { ConversationDTO, DocumentDTO, MessageDTO, ModeDTO, ModelDTO, PlanDTO, SourceDTO, UserDTO, CategoryDTO, KnowledgeBaseDTO, FileUploadDTO, AuditLogDTO, OrganizationDTO, PlanCode } from "@xuanzhi/shared-types";
import type { AuditRow, CategoryRow, ConversationRow, DocumentRow, FileUploadRow, KnowledgeBaseRow, MessageRow, MessageSourceRow, ModeRow, ModelRow, OrganizationRow, PlanRow, UserRow } from "../repositories/types";
import { iso } from "../lib/time";

export const toUserDTO = (u: UserRow): UserDTO => ({
  id: u.id, email: u.email, name: u.name, avatar_url: u.avatar_url, role: u.role, locale: u.locale, theme: u.theme, email_verified: !!u.email_verified_at, onboarding_completed: u.onboarding_completed,
  interests: u.interests ?? [], default_model_id: u.default_model_id, default_mode_id: u.default_mode_id, response_style: u.response_style, memory_enabled: u.memory_enabled, history_enabled: u.history_enabled, created_at: iso(u.created_at)!,
});
export const toPlanDTO = (p: PlanRow): PlanDTO => ({
  id: p.id, code: p.code, name: p.name, description: p.description, price_monthly: Number(p.price_monthly), currency: p.currency, message_limit_daily: p.message_limit_daily, knowledge_search_limit_daily: p.knowledge_search_limit_daily,
  context_window_tokens: p.context_window_tokens, max_upload_files_per_day: p.max_upload_files_per_day, max_conversations: p.max_conversations, allow_file_upload: p.allow_file_upload, allow_advanced_modes: p.allow_advanced_modes,
  allow_premium_knowledge: p.allow_premium_knowledge, allow_api_access: p.allow_api_access, priority: p.priority, features: p.features ?? [], is_active: p.is_active, sort_order: p.sort_order, stripe_price_id: p.stripe_price_id,
});
export const toModelDTO = (m: ModelRow, ent?: { available: boolean; required_plan: PlanCode | null }): ModelDTO => ({
  id: m.id, name: m.name, description: m.description, provider_code: m.provider_code, provider_name: m.provider_name, model_identifier: m.model_identifier, context_window: m.context_window, max_output_tokens: m.max_output_tokens,
  tier: m.tier, is_active: m.is_active && m.provider_active, priority: m.priority, is_default: m.is_default, input_cost_per_million: Number(m.input_cost_per_million), output_cost_per_million: Number(m.output_cost_per_million),
  ...(ent ? { available: ent.available, required_plan: ent.required_plan } : {}),
});
export const toModeDTO = (m: ModeRow, available?: boolean): ModeDTO => ({
  id: m.id, code: m.code, name: m.name, name_zh: m.name_zh, name_zh_tw: m.name_zh_tw, description: m.description, description_zh: m.description_zh, description_zh_tw: m.description_zh_tw, icon: m.icon,
  knowledge_filter: m.knowledge_filter ?? [], is_advanced: m.is_advanced, is_active: m.is_active, sort_order: m.sort_order, ...(available === undefined ? {} : { available }),
});
export const toConversationDTO = (c: ConversationRow): ConversationDTO => ({
  id: c.id, title: c.title, model_id: c.model_id, mode_id: c.mode_id, use_knowledge: c.use_knowledge, message_count: c.message_count, last_message_at: iso(c.last_message_at), is_archived: c.is_archived, is_pinned: c.is_pinned,
  share_token: c.share_token, created_at: iso(c.created_at)!, updated_at: iso(c.updated_at)!,
});
export const toSourceDTO = (s: MessageSourceRow): SourceDTO => ({
  id: s.id, rank: s.rank, label: s.label, document_id: s.document_id ?? s.upload_id ?? "", document_title: s.document_title, chunk_id: s.chunk_id ?? "", section: s.section, page_number: s.page_number, excerpt: s.excerpt, score: Number(s.score),
  source_type: s.source_type, author: null, category: null, is_upload: !!s.upload_id,
});
export const toMessageDTO = (m: MessageRow, sources: MessageSourceRow[] = []): MessageDTO => ({
  id: m.id, conversation_id: m.conversation_id, role: m.role, content: m.content, status: m.status, model_id: m.model_id, mode_id: m.mode_id, request_tokens: m.request_tokens, response_tokens: m.response_tokens,
  feedback: m.feedback, is_bookmarked: m.is_bookmarked, parent_message_id: m.parent_message_id, sequence: m.sequence, suggestions: m.suggestions ?? [], sources: sources.map(toSourceDTO), attachments: m.attachments ?? [], error: m.error, created_at: iso(m.created_at)!,
});
export const toCategoryDTO = (c: CategoryRow): CategoryDTO => ({ id: c.id, code: c.code, name: c.name, name_zh: c.name_zh, name_zh_tw: c.name_zh_tw, description: c.description, icon: c.icon, sort_order: c.sort_order, is_system: c.is_system, document_count: c.document_count });
export const toKnowledgeBaseDTO = (k: KnowledgeBaseRow): KnowledgeBaseDTO => ({ id: k.id, name: k.name, description: k.description, organization_id: k.organization_id, visibility: k.visibility, is_default: k.is_default, document_count: k.document_count, created_at: iso(k.created_at)! });
export const toDocumentDTO = (d: DocumentRow): DocumentDTO => ({
  id: d.id, knowledge_base_id: d.knowledge_base_id, category_id: d.category_id, category_code: d.category_code ?? null, category_name: d.category_name ?? null, title: d.title, filename: d.filename, mime_type: d.mime_type, file_size: Number(d.file_size),
  language: d.language, author: d.author, source: d.source, publication_date: d.publication_date, tags: d.tags ?? [], source_type: d.source_type, source_weight: Number(d.source_weight), status: d.status, progress: d.progress, chunk_count: d.chunk_count,
  embedded_count: d.embedded_count, error: d.error, visibility: d.visibility, is_demo: d.is_demo, processing_log: d.processing_log ?? [], uploaded_by: d.uploaded_by, created_at: iso(d.created_at)!, updated_at: iso(d.updated_at)!,
});
export const toFileUploadDTO = (u: FileUploadRow): FileUploadDTO => ({ id: u.id, filename: u.filename, mime_type: u.mime_type, size: Number(u.size), status: u.status, chunk_count: u.chunk_count, error: u.error, created_at: iso(u.created_at)! });
export const toAuditDTO = (a: AuditRow): AuditLogDTO => ({ id: a.id, actor_id: a.actor_id, actor_email: a.actor_email ?? null, action: a.action, resource_type: a.resource_type, resource_id: a.resource_id, ip: a.ip, result: a.result, details: a.details, created_at: iso(a.created_at)! });
export const toOrganizationDTO = (o: OrganizationRow & { plan_code?: string | null; member_count?: number; role?: string }): OrganizationDTO => ({ id: o.id, name: o.name, slug: o.slug, plan_code: (o.plan_code as PlanCode | null) ?? null, member_count: o.member_count, role: o.role as OrganizationDTO["role"], created_at: iso(o.created_at)! });
