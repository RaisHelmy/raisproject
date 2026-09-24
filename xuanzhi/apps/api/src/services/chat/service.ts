/**
 * Chat orchestration: entitlements → persist user turn → retrieval (RAG) → prompt → streamed generation with fallback →
 * citations, usage, follow-ups. Emits ChatStreamEvent objects; the route serialises them as SSE.
 */
import type { ChatStreamEvent, SourceDTO } from "@xuanzhi/shared-types";
import type { AppContext, AuthUser } from "../context";
import { entitlements } from "../entitlements";
import { Errors } from "../../lib/errors";
import { estimateTokens, titleFromMessage } from "../../lib/text";
import { retrieve, type RetrievedSource } from "../knowledge/retrieval";
import { buildMessages, FOLLOWUP_MARKER, splitFollowups } from "./prompt-builder";
import { runChatWithFallback } from "../ai/registry";
import { toMessageDTO } from "../mappers";
import type { ModelRow } from "../../repositories/types";

export interface ChatInput { conversation_id?: string | null; content: string; model_id?: string | null; mode_id?: string | null; use_knowledge?: boolean; upload_ids?: string[]; regenerate_message_id?: string | null; edit_message_id?: string | null; signal?: AbortSignal }

export function estimateCost(model: ModelRow, input: number, output: number): number {
  return (input / 1e6) * Number(model.input_cost_per_million) + (output / 1e6) * Number(model.output_cost_per_million);
}

async function pickModel(ctx: AppContext, user: AuthUser, requested: string | null | undefined, conversationModelId: string | null, userDefault: string | null): Promise<ModelRow> {
  const ent = entitlements(ctx);
  const candidates = [requested, conversationModelId, userDefault].filter((x): x is string => !!x);
  for (const id of candidates) {
    const m = await ctx.repos.models.findById(id);
    if (!m) continue;
    const r = await ent.canUseModel(user, m);
    if (r.allowed) return m;
    if (id === requested) throw Errors.upgradeRequired(`${m.name} is not included in your plan.`, r.required_plan, "model");
  }
  const all = await ctx.repos.models.listActive();
  const def = all.find((m) => m.is_default) ?? all[0];
  if (!def) throw Errors.notConfigured("No AI model is configured. Ask an administrator to enable one.");
  const r = await ent.canUseModel(user, def);
  if (r.allowed) return def;
  for (const m of all) if ((await ent.canUseModel(user, m)).allowed) return m;
  throw Errors.notConfigured("No AI model is available for your plan.");
}

export async function streamChat(ctx: AppContext, user: AuthUser, input: ChatInput, emit: (e: ChatStreamEvent) => Promise<void>): Promise<void> {
  const repos = ctx.repos; const ent = entitlements(ctx);
  const userRow = (await repos.users.findById(user.id))!;
  const content = input.content.trim();
  if (!content) throw Errors.validation("Message is empty.");
  if (content.length > 12_000) throw Errors.validation("Message is too long (max 12,000 characters).");
  await ent.assertMessageQuota(user);

  // Conversation
  let conversation = input.conversation_id ? await repos.conversations.findById(input.conversation_id, user.id) : null;
  if (input.conversation_id && !conversation) throw Errors.notFound("Conversation");
  const model = await pickModel(ctx, user, input.model_id, conversation?.model_id ?? null, userRow.default_model_id);
  let mode = null as Awaited<ReturnType<typeof repos.modes.findById>>;
  const modeId = input.mode_id === undefined ? conversation?.mode_id ?? userRow.default_mode_id : input.mode_id;
  if (modeId) {
    mode = await repos.modes.findById(modeId);
    if (mode && !mode.is_active) mode = null;
    if (mode) { const r = await ent.canUseAdvancedMode(user, mode); if (!r.allowed) throw Errors.upgradeRequired(`${mode.name} mode is available on higher plans.`, r.required_plan, "mode"); }
  }
  const useKnowledge = input.use_knowledge ?? conversation?.use_knowledge ?? true;
  let created = false;
  if (!conversation) {
    await ent.assertConversationQuota(user);
    conversation = (await repos.conversations.create({ user_id: user.id, organization_id: user.org_ids[0] ?? null, title: titleFromMessage(content), model_id: model.id, mode_id: mode?.id ?? null, use_knowledge: useKnowledge }))!;
    created = true;
  } else if (conversation.model_id !== model.id || conversation.mode_id !== (mode?.id ?? null) || conversation.use_knowledge !== useKnowledge) {
    conversation = (await repos.conversations.update(conversation.id, { model_id: model.id, mode_id: mode?.id ?? null, use_knowledge: useKnowledge }))!;
  }

  // Attachments (chat uploads owned by the user)
  const uploads = input.upload_ids?.length ? await repos.uploads.findMany(input.upload_ids, user.id) : [];
  const readyUploads = uploads.filter((u) => u.status === "ready");
  for (const u of uploads) if (!u.conversation_id) await repos.uploads.update(u.id, { conversation_id: conversation.id });

  // Persist the user turn (edit = truncate from the edited message; regenerate = drop the previous assistant answer)
  let sequence: number; let userMessage;
  if (input.regenerate_message_id) {
    const prev = await repos.messages.findById(input.regenerate_message_id);
    if (!prev || prev.conversation_id !== conversation.id || prev.role !== "assistant") throw Errors.notFound("Message");
    const parentUser = prev.parent_message_id ? await repos.messages.findById(prev.parent_message_id) : null;
    await repos.messages.deleteFrom(conversation.id, prev.sequence);
    if (!parentUser) throw Errors.notFound("Message");
    userMessage = parentUser; sequence = prev.sequence;
  } else if (input.edit_message_id) {
    const prev = await repos.messages.findById(input.edit_message_id);
    if (!prev || prev.conversation_id !== conversation.id || prev.role !== "user") throw Errors.notFound("Message");
    await repos.messages.deleteAfter(conversation.id, prev.sequence);
    userMessage = (await repos.messages.update(prev.id, { content, request_tokens: estimateTokens(content) }))!;
    sequence = prev.sequence + 1;
  } else {
    sequence = await repos.messages.nextSequence(conversation.id);
    userMessage = (await repos.messages.create({ conversation_id: conversation.id, role: "user", content, status: "complete", model_id: model.id, mode_id: mode?.id ?? null, parent_message_id: null, sequence, attachments: uploads.map((u) => ({ id: u.id, filename: u.filename })), request_tokens: estimateTokens(content) }))!;
    sequence += 1;
  }
  const assistant = (await repos.messages.create({ conversation_id: conversation.id, role: "assistant", content: "", status: "streaming", model_id: model.id, mode_id: mode?.id ?? null, parent_message_id: userMessage.id, sequence }))!;
  await emit({ type: "meta", conversation_id: conversation.id, user_message_id: userMessage.id, assistant_message_id: assistant.id, model_id: model.id, ...(created ? { title: conversation.title } : {}) });
  await emit({ type: "status", status: "thinking" });

  // Retrieval
  let sources: RetrievedSource[] = [];
  const attachmentIds = readyUploads.map((u) => u.id);
  if ((useKnowledge && (await ent.knowledgeSearchAllowed(user))) || attachmentIds.length) {
    await emit({ type: "status", status: "searching" });
    try {
      const queryText = userMessage.content;
      sources = await retrieve(ctx, user, queryText, { categoryCodes: useKnowledge ? mode?.knowledge_filter ?? [] : [], uploadIds: attachmentIds, limit: 6, ...(useKnowledge ? {} : { documentIds: ["00000000-0000-0000-0000-000000000000"] }) });
      if (useKnowledge) {
        const kbIds = [...new Set(sources.map((s) => s.knowledge_base_id).filter((x): x is string => !!x))];
        ctx.waitUntil(repos.usage.record({ user_id: user.id, organization_id: user.org_ids[0] ?? null, model_id: null, conversation_id: conversation.id, message_id: assistant.id, kind: "knowledge_search", request_tokens: estimateTokens(queryText), response_tokens: 0, estimated_cost: 0, knowledge_base_ids: kbIds }));
      }
    } catch (e) { ctx.log.warn("retrieval_failed", { error: e as Error }); }
    if (sources.length) await emit({ type: "sources", sources: sources.map(({ content: _c, knowledge_base_id: _k, ...s }) => s as SourceDTO) });
  }
  ctx.waitUntil(repos.analytics.topicEvent(user.id, sources[0]?.category ?? mode?.knowledge_filter?.[0] ?? null, mode?.code ?? null));

  // Prompt + generation
  const history = (await repos.messages.listForConversation(conversation.id)).filter((m) => m.id !== assistant.id);
  const { messages, promptTokens } = await buildMessages(ctx, { user: userRow, model, mode, conversation, history: history.filter((m) => m.id !== userMessage.id), userMessage: userMessage.content, sources, attachmentsNote: readyUploads.length ? `# Attached files\nThe user attached: ${readyUploads.map((u) => u.filename).join(", ")}. Passages from them appear above labelled "(user upload)".` : undefined });
  messages.push({ role: "user", content: userMessage.content });
  await emit({ type: "status", status: "generating" });

  const all = await repos.models.listActive();
  const fallback = all.find((m) => m.is_default && m.id !== model.id) ?? null;
  let full = ""; let visibleSent = 0; let usage = { input: promptTokens + estimateTokens(userMessage.content), output: 0 }; let usageFromProvider = false;
  const flushVisible = async (final = false) => {
    const idx = full.indexOf(FOLLOWUP_MARKER);
    // Hold back the last few characters unless final, so a partially streamed marker is never shown.
    const limit = idx >= 0 ? idx : final ? full.length : Math.max(0, full.length - FOLLOWUP_MARKER.length);
    if (limit > visibleSent) { await emit({ type: "token", text: full.slice(visibleSent, limit) }); visibleSent = limit; }
  };
  let stopped = false;
  try {
    const r = await runChatWithFallback(ctx, model, { messages, maxTokens: model.max_output_tokens, signal: input.signal }, async (chunk) => {
      if (chunk.type === "text") { full += chunk.text; await flushVisible(); }
      else if (chunk.type === "usage" && (chunk.input || chunk.output)) { usage = { input: chunk.input || usage.input, output: chunk.output }; usageFromProvider = true; }
    }, fallback);
    if (r.fellBack) ctx.log.info("ai_fell_back", { from: model.id, to: r.modelUsed.id });
    await finish(r.modelUsed);
  } catch (e) {
    if ((e as Error).name === "AbortError" || input.signal?.aborted) { stopped = true; await finish(model); return; }
    const msg = (e as Error).message || "Generation failed";
    await repos.messages.update(assistant.id, { status: "error", error: msg, content: full });
    ctx.log.error("chat_failed", { error: e as Error });
    await emit({ type: "error", code: (e as { code?: string }).code ?? "AI_PROVIDER_ERROR", message: msg });
  }

  async function finish(modelUsed: ModelRow) {
    await flushVisible(true);
    const { answer, suggestions } = splitFollowups(full);
    if (!usageFromProvider) usage.output = estimateTokens(full);
    const saved = (await repos.messages.update(assistant.id, { content: answer, status: stopped ? "stopped" : "complete", suggestions, request_tokens: usage.input, response_tokens: usage.output, model_id: modelUsed.id, error: null }))!;
    // Only keep sources that the answer actually cited (plus the top one if nothing was cited but sources existed, so the user can still see what was consulted).
    const cited = sources.filter((s) => answer.includes(s.label) || answer.includes(`[${s.rank}]`));
    const keep = cited.length ? cited : sources.slice(0, 3);
    if (keep.length) await repos.messageSources.insertMany(keep.map((s, i) => ({ message_id: assistant.id, rank: i + 1, label: s.label, document_id: s.is_upload ? null : s.document_id, chunk_id: s.is_upload ? null : s.chunk_id, upload_id: s.is_upload ? s.document_id : null, document_title: s.document_title, section: s.section, page_number: s.page_number, excerpt: s.excerpt, score: s.score, source_type: s.source_type })));
    await repos.usage.record({ user_id: user.id, organization_id: user.org_ids[0] ?? null, model_id: modelUsed.id, conversation_id: conversation!.id, message_id: assistant.id, kind: "chat", request_tokens: usage.input, response_tokens: usage.output, estimated_cost: estimateCost(modelUsed, usage.input, usage.output) });
    await repos.conversations.bump(conversation!.id);
    const rows = await repos.messageSources.listForMessages([assistant.id]);
    await emit({ type: "done", message: toMessageDTO(saved, rows), usage: { request_tokens: usage.input, response_tokens: usage.output } });
    const count = (await repos.conversations.findById(conversation!.id))?.message_count ?? 0;
    if (count >= 12 && count - (conversation!.summary_until_sequence ?? 0) >= 8) await ctx.enqueue({ type: "SUMMARIZE_CONVERSATION", conversation_id: conversation!.id, correlation_id: ctx.correlationId });
  }
}

/** Rolling summary of older turns so long conversations keep context within the model window (memory / context management). */
export async function summarizeConversation(ctx: AppContext, conversationId: string): Promise<void> {
  const repos = ctx.repos;
  const conv = await repos.conversations.findById(conversationId);
  if (!conv) return;
  const msgs = (await repos.messages.listForConversation(conversationId)).filter((m) => m.status === "complete");
  const cutoff = Math.max(0, msgs.length - 6);
  const older = msgs.slice(0, cutoff);
  if (older.length < 6) return;
  const all = await repos.models.listActive();
  const model = all.find((m) => m.is_default) ?? all[0];
  if (!model) return;
  let text = "";
  try {
    await runChatWithFallback(ctx, model, {
      maxTokens: 400,
      messages: [
        { role: "system", content: "Summarise the conversation so far in at most 180 words, in the language of the conversation. Keep the user's goals, key facts they shared, and conclusions reached. Plain prose, no preamble." },
        ...(conv.summary ? [{ role: "system" as const, content: `Previous summary:\n${conv.summary}` }] : []),
        { role: "user", content: older.map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content.slice(0, 1200)}`).join("\n\n") },
      ],
    }, (c) => { if (c.type === "text") text += c.text; });
  } catch (e) { ctx.log.warn("summary_failed", { error: e as Error }); return; }
  if (text.trim()) {
    await repos.conversations.update(conversationId, { summary: text.trim().slice(0, 2000), summary_until_sequence: older[older.length - 1]!.sequence });
    await repos.usage.record({ user_id: conv.user_id, organization_id: null, model_id: model.id, conversation_id: conversationId, message_id: null, kind: "summary", request_tokens: estimateTokens(older.map((m) => m.content).join(" ")), response_tokens: estimateTokens(text), estimated_cost: 0 });
  }
}
