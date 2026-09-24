/**
 * Assembles the system prompt (general + mode + safety + RAG + language/style) and trims the conversation to the model's
 * context budget. Prompts are loaded from the versioned `prompts` table, so admins can edit and roll back without a deploy.
 */
import type { AppContext } from "../context";
import type { ChatMessage } from "../ai/types";
import type { ConversationRow, MessageRow, ModeRow, ModelRow, UserRow } from "../../repositories/types";
import type { RetrievedSource } from "../knowledge/retrieval";
import { detectLanguage, estimateTokens } from "../../lib/text";

export const FOLLOWUP_MARKER = "---FOLLOWUPS---";

const LANGUAGE_NAMES: Record<string, string> = { en: "English", "zh-CN": "Simplified Chinese (简体中文)", "zh-TW": "Traditional Chinese (繁體中文)" };
const STYLE: Record<string, string> = {
  balanced: "Answer with balanced depth: clear structure, a few short paragraphs, headings when helpful.",
  concise: "Be concise. Prefer short paragraphs and bullet points; avoid repetition.",
  detailed: "Be thorough and well structured: use headings, explain background, give examples and nuance.",
  scholarly: "Write as a careful scholar: quote the classical text where relevant (with the original Chinese and a translation), name the school/period, and note competing interpretations.",
};

export const DEFAULT_GENERAL_PROMPT = `You are 玄知 (XuanZhi), a knowledgeable and calm guide to Chinese traditional wisdom: the I Ching, Taoism, Buddhism, Confucianism, Feng Shui, Ba Zi, Zi Wei Dou Shu, the traditional calendar, classical literature, history, philosophy of Chinese medicine, proverbs, family ethics and everyday life wisdom.

Always distinguish clearly between: (1) historical/classical teachings, (2) traditional beliefs and practice, (3) modern interpretations, (4) evidence-based information, and (5) your own interpretation. Use short labelled sections such as "Classical teaching", "Traditional interpretation", "Modern perspective" when the question touches belief systems.

Use Markdown: headings (###), bullet lists, tables for comparisons, and \`code\` style only for hexagram notation, stems/branches or calendar data. Where relevant include the original Chinese term with pinyin and an English gloss, e.g. 中庸 (zhōngyōng, "the doctrine of the mean").`;

export const DEFAULT_SAFETY_PROMPT = `Intellectual honesty rules:
- Never claim certainty about supernatural outcomes, luck, or destiny. Say "in traditional practice this is interpreted as…", never "this will happen".
- Divination, Feng Shui and destiny systems are presented as traditional frameworks for reflection, not as proven prediction.
- For health questions: explain how Chinese medicine historically interprets the matter, then clearly separate that from modern medical evidence and advise consulting a qualified clinician.
- For financial, legal or medical decisions: state that traditional interpretation should complement, never replace, qualified professional advice.
- Do not fabricate quotations or chapter numbers. If you are unsure of a source, say so.
- Be respectful of all traditions and avoid promoting superstition, gambling or fear.`;

export const DEFAULT_RAG_PROMPT = `You have been given passages from a curated library of authoritative sources. Ground your answer in these passages first, and prefer them over general knowledge whenever they are relevant. Cite a passage inline right after the sentence it supports using its label, e.g. "…understanding change and timing ①". Only cite labels that were provided. If the passages do not cover the question, say what the library does not contain and answer from general knowledge, clearly marked as such. Never invent page numbers.`;

export interface PromptInputs { user: UserRow; model: ModelRow; mode: ModeRow | null; conversation: ConversationRow; history: MessageRow[]; userMessage: string; sources: RetrievedSource[]; attachmentsNote?: string }

export async function buildMessages(ctx: AppContext, inp: PromptInputs): Promise<{ messages: ChatMessage[]; promptTokens: number }> {
  const prompts = ctx.repos.prompts;
  const general = (await prompts.activeContent("general")) || DEFAULT_GENERAL_PROMPT;
  const safety = (await prompts.activeContent("safety")) || DEFAULT_SAFETY_PROMPT;
  const rag = (await prompts.activeContent("rag_system")) || DEFAULT_RAG_PROMPT;
  const modePrompt = inp.mode?.prompt_id ? await prompts.activeContentById(inp.mode.prompt_id) : "";

  const lang = detectLanguage(inp.userMessage);
  const parts: string[] = [general];
  if (modePrompt) parts.push(`# Expert mode: ${inp.mode!.name}\n${modePrompt}`);
  parts.push(`# Safety\n${safety}`);
  parts.push(`# Language and style\nRespond in ${LANGUAGE_NAMES[lang] ?? "English"} because that is the language the user wrote in (the user's interface language is ${LANGUAGE_NAMES[inp.user.locale] ?? "English"}). Do not mix languages except for quoting original Chinese terms. ${STYLE[inp.user.response_style] ?? STYLE.balanced}`);
  if (inp.sources.length) {
    const ctxText = inp.sources.map((s) => `${s.label} 《${s.document_title}》${s.section ? ` · ${s.section}` : ""}${s.page_number ? ` · p.${s.page_number}` : ""}${s.is_upload ? " (user upload)" : ` (${s.source_type.replace("_", " ")})`}\n${s.content}`).join("\n\n");
    parts.push(`# Library passages\n${rag}\n\n${ctxText}`);
  } else if (inp.conversation.use_knowledge) {
    parts.push(`# Library\nNo relevant passages were found in the curated library for this question. Answer from general knowledge and say so briefly when it matters.`);
  }
  if (inp.attachmentsNote) parts.push(inp.attachmentsNote);
  parts.push(`# Follow-up suggestions\nAfter your full answer, output a line containing exactly ${FOLLOWUP_MARKER} and then three short follow-up questions the user might ask next, one per line, in the same language as your answer. Nothing after them.`);
  const system = parts.join("\n\n");

  // Context budget: plan/model window minus system prompt and reserved output.
  const budget = Math.max(2000, Math.min(inp.model.context_window, inp.conversation.summary ? inp.model.context_window : inp.model.context_window) - estimateTokens(system) - inp.model.max_output_tokens - 200);
  const msgs: ChatMessage[] = [];
  let used = 0;
  const recent = inp.history.filter((m) => (m.role === "user" || m.role === "assistant") && m.status !== "error" && m.content.trim()).slice(-40);
  for (let i = recent.length - 1; i >= 0; i--) {
    const m = recent[i]!; const t = estimateTokens(m.content);
    if (used + t > budget) break;
    msgs.unshift({ role: m.role as "user" | "assistant", content: m.content }); used += t;
  }
  if (inp.conversation.summary && (msgs.length < recent.length || inp.conversation.summary_until_sequence > 0)) {
    msgs.unshift({ role: "system", content: `Summary of the earlier part of this conversation:\n${inp.conversation.summary}` });
  }
  return { messages: [{ role: "system", content: system }, ...msgs], promptTokens: estimateTokens(system) + used };
}

/** Split the model output into the visible answer and the follow-up questions after the marker. */
export function splitFollowups(full: string): { answer: string; suggestions: string[] } {
  const idx = full.indexOf(FOLLOWUP_MARKER);
  if (idx < 0) return { answer: full.trim(), suggestions: [] };
  const suggestions = full.slice(idx + FOLLOWUP_MARKER.length).split("\n").map((s) => s.replace(/^[\s\-*\d.)、①②③]+/, "").trim()).filter((s) => s.length > 3 && s.length < 200).slice(0, 3);
  return { answer: full.slice(0, idx).trim(), suggestions };
}
