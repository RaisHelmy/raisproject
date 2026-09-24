/**
 * Claude-backed work extraction provider (real AI integration).
 *
 * Staged pipeline — never one giant prompt:
 *   Stage A  participants + work-message classification (chunked)
 *   Stage B  grouping + task extraction with provenance (chunked by day windows)
 * Every extracted field carries value/source/confidence/reason and message-level evidence.
 * Structured outputs (`output_config.format`) constrain the response to our JSON schema.
 */
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { AIAssumption, ParticipantSummary, WorkStatus } from "@rais/shared-types";
import type { AIContext, AIMessage, AIProvider, AnalysisResult, ExtractedWorkItem, ProgressFn } from "./types";
import { JIRA_KEY_RE, clamp01, isAlias } from "./types";
import { dateInTz } from "../../lib/time";
import type { Logger } from "../../lib/logger";

const ParticipantsOut = z.object({
  participants: z.array(z.object({ name: z.string(), role: z.enum(["requester", "executor", "observer", "commenter", "other"]), is_owner: z.boolean() })),
  work_message_ids: z.array(z.string()),
});

const FieldStr = z.object({ value: z.string(), source: z.enum(["explicit", "inferred", "assumed", "unknown"]), confidence: z.number(), reason: z.string() });
const FieldNum = z.object({ value: z.number(), source: z.enum(["explicit", "inferred", "assumed", "unknown"]), confidence: z.number(), reason: z.string() });
const FieldNullableStr = z.object({ value: z.string().nullable(), source: z.enum(["explicit", "inferred", "assumed", "unknown"]), confidence: z.number(), reason: z.string() });

const ItemsOut = z.object({
  items: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      executor: z.string(),
      is_owner_work: z.boolean(),
      work_date: FieldStr,
      duration_minutes: FieldNum,
      start_time: FieldNullableStr,
      end_time: FieldNullableStr,
      work_status: z.object({ value: z.enum(["COMPLETED", "IN_PROGRESS", "BLOCKED", "UNKNOWN"]), source: z.enum(["explicit", "inferred", "assumed", "unknown"]), confidence: z.number(), reason: z.string() }),
      explicit_jira_key: z.string().nullable(),
      evidence: z.array(z.object({ message_id: z.string(), reason: z.string() })),
    }),
  ),
  warnings: z.array(z.string()),
});

const PARTICIPANTS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["participants", "work_message_ids"],
  properties: {
    participants: { type: "array", items: { type: "object", additionalProperties: false, required: ["name", "role", "is_owner"], properties: { name: { type: "string" }, role: { type: "string", enum: ["requester", "executor", "observer", "commenter", "other"] }, is_owner: { type: "boolean" } } } },
    work_message_ids: { type: "array", items: { type: "string" } },
  },
};

const FIELD = (valueType: object) => ({
  type: "object", additionalProperties: false, required: ["value", "source", "confidence", "reason"],
  properties: { value: valueType, source: { type: "string", enum: ["explicit", "inferred", "assumed", "unknown"] }, confidence: { type: "number" }, reason: { type: "string" } },
});

const ITEMS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items", "warnings"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "description", "executor", "is_owner_work", "work_date", "duration_minutes", "start_time", "end_time", "work_status", "explicit_jira_key", "evidence"],
        properties: {
          title: { type: "string" }, description: { type: "string" }, executor: { type: "string" }, is_owner_work: { type: "boolean" },
          work_date: FIELD({ type: "string" }), duration_minutes: FIELD({ type: "number" }),
          start_time: FIELD({ type: ["string", "null"] }), end_time: FIELD({ type: ["string", "null"] }),
          work_status: FIELD({ type: "string", enum: ["COMPLETED", "IN_PROGRESS", "BLOCKED", "UNKNOWN"] }),
          explicit_jira_key: { type: ["string", "null"] },
          evidence: { type: "array", items: { type: "object", additionalProperties: false, required: ["message_id", "reason"], properties: { message_id: { type: "string" }, reason: { type: "string" } } } },
        },
      },
    },
    warnings: { type: "array", items: { type: "string" } },
  },
};

const SYSTEM_BASE = `You are the work-extraction engine of "Rais Timesheet", an application that converts WhatsApp work conversations into auditable timesheet entries for software delivery projects (bank/enterprise clients). Conversations mix English and Malay.

Ground rules:
- Distinguish FACT from INFERENCE. Every field you output carries a source: "explicit" (stated in a message), "inferred" (derived from timestamps/context), "assumed" (a default because nothing supports it), or "unknown".
- Never fabricate. If effort is not stated, infer conservatively from message timestamps and say so in "reason". Do NOT assume the person worked continuously between messages; long idle gaps are not work.
- Only the timesheet owner's own work counts as owner work. Work performed by other participants must be marked is_owner_work=false.
- Group messages that belong to one logical task (e.g. "API down → checking logs → found DB timeout → fixed") into ONE item. Different tasks (fix API, prepare deployment, create user account) are SEPARATE items.
- Titles are short imperative summaries (e.g. "Investigate and resolve API database timeout"). Descriptions summarise what was done, in plain language.
- Dates are YYYY-MM-DD in the project timezone. Times are HH:MM (24h) or null.
- Reference message ids exactly as given in square brackets; they are the audit evidence.
- Respond only with JSON matching the schema.`;

export class AnthropicAIProvider implements AIProvider {
  readonly name = "anthropic";
  readonly is_demo = false;
  private readonly client: Anthropic;

  constructor(apiKey: string, readonly model: string, private readonly log: Logger) {
    this.client = new Anthropic({ apiKey, maxRetries: 2, timeout: 120_000 });
  }

  async analyse(messages: AIMessage[], ctx: AIContext, onProgress?: ProgressFn): Promise<AnalysisResult> {
    const warnings: string[] = [];
    const tz = ctx.project.timezone || "Asia/Kuala_Lumpur";
    const usable = messages.filter((m) => !m.is_system && !m.is_deleted && m.message.trim().length > 0);
    const header = `Timesheet owner: ${ctx.me_name} (WhatsApp names: ${[ctx.me_name, ...ctx.me_aliases].join(", ")}). Project: ${ctx.project.name} (${ctx.project.code})${ctx.project.jira_project_key ? `, Jira project ${ctx.project.jira_project_key}` : ""}. Timezone: ${tz}. Working hours ${ctx.project.working_hours_start}–${ctx.project.working_hours_end}. Today: ${ctx.today}.`;

    // ---- Stage A: participants + work messages (chunks of ~200) ----
    const roleVotes = new Map<string, Map<string, number>>();
    const workIds = new Set<string>();
    const CHUNK = 200;
    for (let i = 0; i < usable.length; i += CHUNK) {
      const chunk = usable.slice(i, i + CHUNK);
      const out = await this.structured(
        `${SYSTEM_BASE}\n\nTask for this call: classify participants and identify work-related messages. A work-related message describes, requests, progresses or confirms project work (investigation, fixes, deployments, testing, documentation, access requests, meetings about deliverables). Greetings, thanks, acknowledgements, jokes and social chatter are NOT work-related.`,
        `${header}\n\nMessages:\n${render(chunk, tz)}`,
        PARTICIPANTS_SCHEMA,
        ParticipantsOut,
      );
      if (!out) { warnings.push("Participant classification returned no result for one segment."); continue; }
      for (const p of out.participants) {
        const votes = roleVotes.get(p.name) ?? new Map<string, number>();
        votes.set(p.role, (votes.get(p.role) ?? 0) + 1);
        roleVotes.set(p.name, votes);
      }
      for (const id of out.work_message_ids) workIds.add(id);
      if (onProgress) await onProgress(Math.min(usable.length, i + CHUNK), 0);
    }

    const counts = new Map<string, number>();
    for (const m of usable) counts.set(m.sender, (counts.get(m.sender) ?? 0) + 1);
    const participants: ParticipantSummary[] = [...counts.entries()].map(([name, n]) => {
      const votes = roleVotes.get(name);
      const role = votes ? [...votes.entries()].sort((a, b) => b[1] - a[1])[0]![0] : "other";
      const mine = isAlias(name, ctx);
      return { name, message_count: n, role: (mine ? "executor" : role) as ParticipantSummary["role"], is_me: mine };
    });
    if (!participants.some((p) => p.is_me)) warnings.push(`None of the participants matched your WhatsApp name (${[ctx.me_name, ...ctx.me_aliases].join(", ")}). Update your aliases in Profile settings.`);

    const work = usable.filter((m) => workIds.has(m.id));
    const noise = usable.length - work.length;

    // ---- Stage B: group + extract, windowed by day (each window ≤ ~150 msgs, carry 10 msgs of context) ----
    const windows = windowByDay(work, tz, 150);
    const items: ExtractedWorkItem[] = [];
    let idx = 0;
    for (const w of windows) {
      idx++;
      const out = await this.structured(
        `${SYSTEM_BASE}\n\nTask for this call: group the work-related messages into logical tasks and extract one item per task with provenance. Duration guidance: if effort is stated ("took 2 hours", "1 jam"), use it as explicit. Otherwise infer from the owner's message timestamps: credit at most 30 minutes between consecutive owner messages, mark source "inferred", and explain the activity window in "reason". A single owner message with no other signal is "assumed" 30 minutes with low confidence. Completion is "explicit" only when stated ("done", "fixed", "deployed", "siap").`,
        `${header}\n\nMessages (window ${idx} of ${windows.length}):\n${render(w, tz)}`,
        ITEMS_SCHEMA,
        ItemsOut,
      );
      if (!out) { warnings.push(`Task extraction returned no result for window ${idx}.`); continue; }
      warnings.push(...out.warnings.map((x) => x.trim()).filter(Boolean));
      const byId = new Map(w.map((m) => [m.id, m] as const));
      for (const it of out.items) {
        const evidence = it.evidence.filter((e) => byId.has(e.message_id));
        const mine = it.is_owner_work || isAlias(it.executor, ctx);
        const keys = [...`${it.title} ${it.description}`.matchAll(JIRA_KEY_RE)].map((m) => m[1]!);
        const explicitKey = it.explicit_jira_key && /^[A-Z][A-Z0-9]{1,9}-\d{1,6}$/.test(it.explicit_jira_key) ? it.explicit_jira_key : keys[0] ?? null;
        const dur = { ...it.duration_minutes, value: Math.max(0, Math.round(it.duration_minutes.value)), confidence: clamp01(it.duration_minutes.confidence) };
        const wd = { ...it.work_date, confidence: clamp01(it.work_date.confidence) };
        if (!/^\d{4}-\d{2}-\d{2}$/.test(wd.value)) {
          const first = evidence.map((e) => byId.get(e.message_id)!).sort((a, b) => a.seq - b.seq)[0];
          wd.value = first ? dateInTz(new Date(first.timestamp), tz) : ctx.today;
          wd.source = "inferred"; wd.confidence = 0.5; wd.reason = `${wd.reason} (date normalised from evidence timestamps)`.trim();
        }
        const st = { ...it.work_status, value: it.work_status.value as WorkStatus, confidence: clamp01(it.work_status.confidence) };
        const confidence = clamp01(0.25 * wd.confidence + 0.35 * dur.confidence + 0.2 * st.confidence + 0.2 * (evidence.length >= 2 ? 0.9 : 0.5));
        const assumptions: AIAssumption[] = [
          { key: "work_date", label: "Work date", state: stateOf(wd.source), summary: wd.value, reasoning: wd.reason },
          { key: "duration", label: "Duration", state: stateOf(dur.source), summary: `${dur.value} min`, reasoning: dur.reason },
          { key: "completion", label: "Completion", state: stateOf(st.source), summary: st.value, reasoning: st.reason },
          { key: "executor", label: "Performed by", state: mine ? "confirmed" : "inferred", summary: it.executor, reasoning: mine ? "The work statements were sent by you." : `The work statements were sent by ${it.executor}; excluded from your timesheet unless you claim it.` },
          { key: "jira_issue", label: "Jira issue", state: explicitKey ? "confirmed" : "unknown", summary: explicitKey ?? "Not mentioned", reasoning: explicitKey ? `The issue key ${explicitKey} was mentioned in the conversation.` : "No Jira key mentioned; a match will be suggested after approval." },
        ];
        items.push({
          title: it.title.slice(0, 140), description: it.description, executor: it.executor, is_mine: mine,
          work_date: wd, duration_minutes: dur, start_time: { ...it.start_time, confidence: clamp01(it.start_time.confidence) }, end_time: { ...it.end_time, confidence: clamp01(it.end_time.confidence) },
          work_status: st, explicit_jira_key: explicitKey, confidence, evidence, assumptions,
        });
      }
      if (onProgress) await onProgress(usable.length, items.filter((i) => i.is_mine).length);
    }

    return { provider: this.name, model: this.model, is_demo: false, participants, work_message_ids: [...workIds], noise_count: noise, items, warnings: dedupe(warnings) };
  }

  /** One structured-output call. Returns null on refusal or unparsable output (caller records a warning). */
  private async structured<T>(system: string, user: string, schema: object, parser: z.ZodType<T>): Promise<T | null> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 16000,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: user }],
      output_config: { format: { type: "json_schema", schema } },
    } as Anthropic.MessageCreateParamsNonStreaming);
    if (response.stop_reason === "refusal") {
      this.log.warn("ai_refusal", { model: this.model });
      return null;
    }
    const text = response.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
    try {
      const parsed = parser.safeParse(JSON.parse(text));
      if (!parsed.success) { this.log.warn("ai_schema_mismatch", { issues: parsed.error.issues.length }); return null; }
      return parsed.data;
    } catch (e) {
      this.log.warn("ai_json_parse_failed", { error: e });
      return null;
    }
  }
}

function render(msgs: AIMessage[], tz: string): string {
  return msgs.map((m) => `[${m.id}] ${dateInTz(new Date(m.timestamp), tz)} ${new Date(m.timestamp).toLocaleTimeString("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" })} ${m.sender}: ${m.message.replace(/\s+/g, " ").slice(0, 600)}${m.is_attachment ? " <attachment>" : ""}`).join("\n");
}

function windowByDay(msgs: AIMessage[], tz: string, max: number): AIMessage[][] {
  const out: AIMessage[][] = [];
  let cur: AIMessage[] = [];
  let curDay = "";
  for (const m of msgs) {
    const d = dateInTz(new Date(m.timestamp), tz);
    if (cur.length && (cur.length >= max || (d !== curDay && cur.length >= max / 2))) { out.push(cur); cur = []; }
    cur.push(m);
    curDay = d;
  }
  if (cur.length) out.push(cur);
  return out;
}

function stateOf(source: string): AIAssumption["state"] {
  return source === "explicit" ? "confirmed" : source === "inferred" ? "inferred" : source === "assumed" ? "assumed" : "unknown";
}

function dedupe(xs: string[]): string[] { return [...new Set(xs)]; }
