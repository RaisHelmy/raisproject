/**
 * Heuristic (rule-based) work extraction provider.
 *
 * This is the DEMO / offline provider. It is deterministic, calls no external API and is
 * always labelled "Heuristic (demo)" in the UI. It implements the same staged pipeline as the
 * Claude provider (participants → work messages → grouping → extraction) using lexicons,
 * time gaps and simple statistics, so the application is fully usable without an API key.
 */
import type { AIAssumption, Evidence, ParticipantRole, ParticipantSummary, WorkStatus } from "@rais/shared-types";
import type { AIContext, AIMessage, AIProvider, AnalysisResult, ExtractedWorkItem, ProgressFn } from "./types";
import { JIRA_KEY_RE, clamp01, isAlias } from "./types";
import { dateInTz, timeInTz } from "../../lib/time";

const WORK_WORDS = [
  // English
  "check", "checking", "fix", "fixed", "fixing", "deploy", "deployed", "deployment", "investigate", "investigating", "issue", "error", "bug", "api",
  "database", "db", "server", "timeout", "log", "logs", "patch", "release", "sit", "uat", "prod", "production", "staging", "test", "testing", "tested",
  "script", "query", "sql", "report", "config", "configure", "update", "updated", "upgrade", "restart", "restarted", "migrate", "migration", "build",
  "pipeline", "merge", "pull request", "pr", "review", "document", "documentation", "user account", "access", "permission", "create", "created", "setup",
  "set up", "install", "installed", "endpoint", "integration", "certificate", "ssl", "backup", "restore", "monitor", "alert", "incident", "root cause",
  "rca", "analysis", "prepare", "prepared", "ticket", "jira", "done", "completed", "resolved", "working on", "in progress", "blocked", "waiting",
  "index", "indexes", "queries", "join", "scan", "rewrite", "rewriting", "found", "pool", "connection", "restart", "cert", "package", "checklist", "job", "batch", "settlement", "null", "exception", "re-ran", "reran", "ran fine", "no errors",
  // Malay
  "semak", "menyemak", "betulkan", "dibetulkan", "baiki", "dibaiki", "buat", "membuat", "siap", "selesai", "masalah", "ralat", "pelayan", "pangkalan data",
  "kemaskini", "kemas kini", "naik taraf", "pasang", "dipasang", "uji", "menguji", "laporan", "tetapan", "akaun", "akses", "kebenaran", "sedang", "tengah",
  "dah siap", "sudah siap", "on going", "ongoing", "tunggu", "menunggu", "tersekat",
];
const REQUEST_WORDS = ["please", "can you", "could you", "pls", "plz", "kindly", "tolong", "boleh", "mohon", "sila", "need you to", "help", "bantu", "minta", "urgent", "asap", "?"];
const DONE_WORDS = ["done", "fixed", "deployed", "completed", "resolved", "solved", "settled", "closed", "siap", "selesai", "dah siap", "sudah siap", "dah deploy", "dah fix", "sorted", "released", "live now", "is up", "back to normal", "working now", "ok now"];
const PROGRESS_WORDS = ["checking", "investigating", "working on", "in progress", "looking into", "on it", "will check", "sedang", "tengah", "on going", "ongoing", "will do", "noted, will"];
const BLOCKED_WORDS = ["blocked", "waiting for", "pending approval", "cannot proceed", "tunggu", "menunggu", "tersekat", "need access", "no access"];
const NOISE = ["ok", "okay", "okey", "oke", "noted", "thanks", "thank you", "tq", "tqvm", "ty", "welcome", "good morning", "good afternoon", "good evening", "morning", "gm", "hi", "hello", "hai", "assalamualaikum", "waalaikumsalam", "salam", "bye", "👍", "👌", "🙏", "haha", "lol", "yes", "no", "ya", "yup", "nope", "sure", "alright", "roger", "cool", "great", "nice", "baik", "sip", "terima kasih", "sama-sama"];
const YESTERDAY = ["yesterday", "semalam", "last night", "malam tadi"];
const DURATION_RE = /(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours|jam)\b|(\d+)\s*(m|min|mins|minute|minutes|minit)\b/gi;
const TIME_RANGE_RE = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|–|to|hingga|sampai)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i;

const GAP_NEW_TASK_MIN = 150; // gap between my messages that starts a new task
const MAX_ACTIVE_GAP_MIN = 30; // cap of active time credited between consecutive messages
const ACK_RE = /^(ok|okay|oke|noted|sure|boleh|baik|on it|will do|will check|checking|looking into it|noted[, ]*will .*|yes[, ]*.*|ya[, ]*.*|copy|roger|ok noted.*|will do[, ]*.*|this is [A-Z]+-\d+.*|yes[, ]*[A-Z]+-\d+.*)[.!]*$/i;

/** After a request/context message from someone else, do I reply with real work (not just an acknowledgement) before the next request? */
function leadsToWork(work: AIMessage[], idx: number, isAck: (m: AIMessage) => boolean, ctx: AIContext): boolean {
  const origin = work[idx]!;
  for (const x of work.slice(idx + 1)) {
    if (minutesDiff(origin.timestamp, x.timestamp) > 120) return false; // a reply hours later is a different task
    if (isAlias(x.sender, ctx)) { if (!isAck(x)) return true; continue; }
    if (includesAny(x.message, REQUEST_WORDS)) return false;
  }
  return false;
}
const requestLeadsToWorkFrom = leadsToWork;

function norm(s: string): string { return s.toLowerCase().replace(/\s+/g, " ").trim(); }
function includesAny(text: string, words: string[]): boolean { const t = norm(text); return words.some((w) => t.includes(w)); }
function isNoise(m: AIMessage): boolean {
  if (m.is_system || m.is_deleted) return true;
  const t = norm(m.message).replace(/[.!,]/g, "");
  if (!t) return true;
  if (m.is_attachment && t.length < 40) return true;
  if (NOISE.includes(t)) return true;
  if (t.length <= 3) return true;
  if (/^[\p{Emoji}\s]+$/u.test(m.message)) return true;
  return false;
}
function isWorkish(m: AIMessage, ctx?: AIContext): boolean {
  if (isNoise(m)) return false;
  const t = norm(m.message);
  // The timesheet owner's substantive messages in a work chat are work even without a keyword hit.
  if (ctx && isAlias(m.sender, ctx) && t.length >= 30 && !ACK_RE.test(t)) return true;
  if (JIRA_KEY_RE.test(m.message)) { JIRA_KEY_RE.lastIndex = 0; return true; }
  JIRA_KEY_RE.lastIndex = 0;
  return WORK_WORDS.some((w) => t.includes(w));
}
function minutesDiff(a: string, b: string): number { return (Date.parse(b) - Date.parse(a)) / 60000; }

function tokens(s: string): Set<string> {
  return new Set(norm(s).replace(/[^\p{L}\p{N}\s-]/gu, " ").split(/\s+/).filter((w) => w.length > 2 && !NOISE.includes(w)));
}
function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

function cleanTitle(s: string, ctx?: AIContext): string {
  let t = s.replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim();
  const names = [...(ctx ? [ctx.me_name, ...ctx.me_aliases] : []), "bro", "boss", "sir", "pak", "encik", "cik", "puan", "tuan", "team", "all", "guys"].filter(Boolean).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  for (let i = 0; i < 3; i++) {
    t = t.replace(/^(hi|hello|hai|salam|assalamualaikum|good (morning|afternoon|evening)|morning|afternoon|evening|reminder|fyi|urgent)( all| team| guys| everyone)?[,!.: ]*/i, "");
    if (names.length) t = t.replace(new RegExp(`^(${names.join("|")})[,!.: ]+`, "i"), "");
    t = t.replace(/^(please|pls|plz|kindly|tolong|boleh|mohon|sila|can you|could you|can u|could u|help( me)?( to)?|bantu|need you to|i need you to)\s+/i, "");
  }
  // First sentence; append the second if the first is very short.
  const sentences = t.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);
  t = sentences[0] ?? t;
  if (t.length < 18 && sentences[1]) t = `${t} ${sentences[1]}`;
  t = t.replace(/\b(also|again|today|now|please)\b[.,]?\s*$/i, "").replace(/[?!.,;:]+$/g, "").trim();
  if (t.length > 90) t = t.slice(0, 87).replace(/\s+\S*$/, "") + "…";
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "Work item";
}

function statusFrom(mine: AIMessage[]): { value: WorkStatus; source: "explicit" | "inferred"; confidence: number; reason: string } {
  const last = mine[mine.length - 1]?.message ?? "";
  const all = mine.map((m) => m.message).join(" \n ");
  if (includesAny(last, DONE_WORDS)) return { value: "COMPLETED", source: "explicit", confidence: 0.92, reason: `Completion stated in the final message: "${trunc(last)}"` };
  if (includesAny(all, DONE_WORDS)) return { value: "COMPLETED", source: "inferred", confidence: 0.75, reason: "A completion phrase appears in the conversation, but not in the final message." };
  if (includesAny(all, BLOCKED_WORDS)) return { value: "BLOCKED", source: "inferred", confidence: 0.7, reason: "The conversation mentions waiting or being blocked." };
  if (includesAny(all, PROGRESS_WORDS)) return { value: "IN_PROGRESS", source: "inferred", confidence: 0.65, reason: "Only progress phrases were found; no completion was stated." };
  return { value: "IN_PROGRESS", source: "inferred", confidence: 0.45, reason: "No completion or blocking statement found; assumed still in progress." };
}

function trunc(s: string, n = 80): string { return s.length > n ? s.slice(0, n - 1) + "…" : s; }

export class HeuristicAIProvider implements AIProvider {
  readonly name = "heuristic";
  readonly model = null;
  readonly is_demo = true;

  async analyse(messages: AIMessage[], ctx: AIContext, onProgress?: ProgressFn): Promise<AnalysisResult> {
    const warnings: string[] = ["Heuristic (demo) provider: rule-based extraction without an LLM. Review all inferred values."];
    const tz = ctx.project.timezone || "Asia/Kuala_Lumpur";

    // Stage 3 — participants
    const counts = new Map<string, { total: number; requests: number; done: number }>();
    for (const m of messages) {
      if (m.is_system) continue;
      const c = counts.get(m.sender) ?? { total: 0, requests: 0, done: 0 };
      c.total++;
      if (includesAny(m.message, REQUEST_WORDS)) c.requests++;
      if (includesAny(m.message, DONE_WORDS) || includesAny(m.message, PROGRESS_WORDS)) c.done++;
      counts.set(m.sender, c);
    }
    const participants: ParticipantSummary[] = [...counts.entries()].map(([name, c]) => {
      const mine = isAlias(name, ctx);
      let role: ParticipantRole = "other";
      if (mine) role = "executor";
      else if (c.requests / Math.max(1, c.total) > 0.3) role = "requester";
      else if (c.done / Math.max(1, c.total) > 0.3) role = "executor";
      else if (c.total <= 2) role = "observer";
      else role = "commenter";
      return { name, message_count: c.total, role, is_me: mine };
    });
    const meFound = participants.some((p) => p.is_me);
    if (!meFound) warnings.push(`None of the participants matched your WhatsApp name (${[ctx.me_name, ...ctx.me_aliases].join(", ")}). Update your aliases in Profile settings.`);

    // Stage 4/5 — work messages vs noise
    const work = messages.filter((m) => isWorkish(m, ctx));
    const noise = messages.length - work.length;
    const workIds = work.map((m) => m.id);

    // Stage 6 — group into tasks. Anchor on my messages; attach preceding requester context.
    const groups: AIMessage[][] = [];
    let current: AIMessage[] = [];
    let lastMine: AIMessage | null = null;
    let processed = 0;
    const isAck = (m: AIMessage) => isAlias(m.sender, ctx) && m.message.trim().length <= 60 && ACK_RE.test(norm(m.message));
    for (let idx = 0; idx < work.length; idx++) {
      const m = work[idx]!;
      processed++;
      const isMe = isAlias(m.sender, ctx);
      const dayOf = dateInTz(new Date(m.timestamp), tz);
      const curHasMine = current.some((x) => isAlias(x.sender, ctx));
      const lastInCur = current[current.length - 1];
      const gapFromCur = lastInCur ? minutesDiff(lastInCur.timestamp, m.timestamp) : 0;
      const isRequest = !isMe && includesAny(m.message, REQUEST_WORDS);
      // A request only opens a new task if my next reply is real work (not just "ok / will do").
      const requestLeadsToWork = isRequest && leadsToWork(work, idx, isAck, ctx);
      let startNew = false;
      if (current.length) {
        if (isMe && curHasMine && lastMine && minutesDiff(lastMine.timestamp, m.timestamp) > GAP_NEW_TASK_MIN && !isAck(m)) startNew = true;
        else if (isMe && !curHasMine && gapFromCur > 90) startNew = true;
        else if (curHasMine && lastMine && dayOf !== dateInTz(new Date(lastMine.timestamp), tz) && !(isMe && isAck(m))) startNew = true;
        else if (!curHasMine && lastInCur && dayOf !== dateInTz(new Date(lastInCur.timestamp), tz)) startNew = true;
        else if (isRequest && curHasMine && requestLeadsToWork && lastMine && (includesAny(lastMine.message, DONE_WORDS) || jaccard(tokens(m.message), tokens(current.map((x) => x.message).join(" "))) < 0.08)) startNew = true;
        else if (!isMe && !isRequest && curHasMine && lastMine && includesAny(lastMine.message, DONE_WORDS) && gapFromCur > 45 && requestLeadsToWorkFrom(work, idx, isAck, ctx)) startNew = true;
      }
      if (startNew) { groups.push(current); current = []; }
      current.push(m);
      if (isMe) lastMine = m;
      if (onProgress && processed % 50 === 0) await onProgress(processed, groups.length);
    }
    if (current.length) groups.push(current);

    // Stage 7–11 — extract per group
    const items: ExtractedWorkItem[] = [];
    for (const g of groups) {
      const mineIn = g.filter((m) => isAlias(m.sender, ctx));
      const othersIn = g.filter((m) => !isAlias(m.sender, ctx));
      if (!mineIn.length) {
        // Work done by someone else — record as not mine so the reviewer can see it was excluded.
        const exec = othersIn[0]?.sender ?? "Unknown";
        const first = othersIn[0]!;
        items.push(buildOtherItem(g, exec, first, tz));
        continue;
      }
      const request = othersIn.find((m) => Date.parse(m.timestamp) <= Date.parse(mineIn[0]!.timestamp) && m.message.replace(/[^\p{L}]/gu, "").length > 12);
      const mineWork = mineIn.filter((m) => !(m.message.trim().length <= 60 && ACK_RE.test(norm(m.message))));
      const titleSource = request ?? mineWork.find((m) => !includesAny(m.message, DONE_WORDS) && m.message.length > 12) ?? mineWork[0] ?? mineIn[0]!;
      const title = cleanTitle(titleSource.message.split("\n")[0]!, ctx);

      const first = mineIn[0]!;
      const last = mineIn[mineIn.length - 1]!;
      const evidence: Evidence[] = g.map((m) => ({ message_id: m.id, reason: isAlias(m.sender, ctx) ? (includesAny(m.message, DONE_WORDS) ? "Completion statement" : "Work activity by you") : includesAny(m.message, REQUEST_WORDS) ? "Request from participant" : "Context from participant" }));

      // Date
      const allText = g.map((m) => m.message).join(" ");
      let workDate = { value: dateInTz(new Date(first.timestamp), tz), source: "explicit" as const, confidence: 0.95, reason: `Taken from the timestamp of your first message (${timeInTz(new Date(first.timestamp), tz)}).` };
      const mineText = mineIn.map((m) => norm(m.message)).join(" ");
      if (mineIn.length <= 2 && YESTERDAY.some((y) => new RegExp(`\\b${y}\\b`).test(mineText)) && !/since (yesterday|semalam)|after yesterday|yesterday's/.test(mineText)) {
        const d = new Date(first.timestamp); d.setUTCDate(d.getUTCDate() - 1);
        workDate = { value: dateInTz(d, tz), source: "inferred" as unknown as "explicit", confidence: 0.6, reason: "The conversation refers to work done \"yesterday\"; date moved back one day." };
      }

      // Duration
      let duration: ExtractedWorkItem["duration_minutes"];
      const explicit = findExplicitDuration(mineIn.map((m) => m.message).join(" "));
      const range = TIME_RANGE_RE.exec(mineIn.map((m) => m.message).join(" "));
      const windowMin = Math.max(0, minutesDiff(first.timestamp, last.timestamp));
      if (explicit) {
        duration = { value: explicit.minutes, source: "explicit", confidence: 0.95, reason: `You stated the effort explicitly ("${explicit.text}").` };
      } else if (range && rangeMinutes(range) > 0) {
        duration = { value: rangeMinutes(range), source: "explicit", confidence: 0.85, reason: `A time range was mentioned ("${range[0]}").` };
      } else if (mineIn.length === 1) {
        duration = { value: 30, source: "assumed", confidence: 0.35, reason: "Only one message from you; assumed a 30-minute task. Please adjust." };
      } else {
        let active = 15;
        for (let i = 1; i < mineIn.length; i++) active += Math.min(MAX_ACTIVE_GAP_MIN, Math.max(5, minutesDiff(mineIn[i - 1]!.timestamp, mineIn[i]!.timestamp)));
        active = Math.round(active / 15) * 15;
        const conf = clamp01(0.5 + Math.min(0.3, mineIn.length * 0.05) - (windowMin > 240 ? 0.15 : 0));
        duration = { value: Math.max(15, active), source: "inferred", confidence: conf, reason: `Conversation activity ${timeInTz(new Date(first.timestamp), tz)}–${timeInTz(new Date(last.timestamp), tz)} (${Math.round(windowMin)} min window). Active work estimated from ${mineIn.length} messages, capping idle gaps at ${MAX_ACTIVE_GAP_MIN} min; not assumed continuous.` };
      }
      const startTime = { value: timeInTz(new Date(first.timestamp), tz), source: "inferred" as const, confidence: 0.6, reason: "First message from you in this task." };
      const endTime = { value: timeInTz(new Date(last.timestamp), tz), source: "inferred" as const, confidence: 0.6, reason: "Last message from you in this task." };
      const st = statusFrom(mineIn);
      const keys = [...allText.matchAll(JIRA_KEY_RE)].map((m) => m[1]!);
      const explicitKey = keys.length ? keys[0]! : null;

      const confidence = clamp01(0.25 * workDate.confidence + 0.35 * duration.confidence + 0.2 * st.confidence + 0.2 * (mineIn.length >= 2 ? 0.9 : 0.5));
      const assumptions: AIAssumption[] = [
        { key: "work_date", label: "Work date", state: workDate.source === "explicit" ? "confirmed" : "inferred", summary: workDate.value, reasoning: workDate.reason },
        { key: "duration", label: "Duration", state: duration.source === "explicit" ? "confirmed" : duration.source === "assumed" ? "assumed" : "inferred", summary: `${duration.value} min`, reasoning: duration.reason },
        { key: "completion", label: "Completion", state: st.source === "explicit" ? "confirmed" : "inferred", summary: st.value, reasoning: st.reason },
        { key: "executor", label: "Performed by", state: "confirmed", summary: first.sender, reasoning: `Messages describing the work were sent by ${first.sender}, which matches your WhatsApp name.` },
        { key: "jira_issue", label: "Jira issue", state: explicitKey ? "confirmed" : "unknown", summary: explicitKey ?? "Not mentioned", reasoning: explicitKey ? `The issue key ${explicitKey} was mentioned in the conversation.` : "No Jira key was mentioned; a match will be suggested after approval." },
      ];
      const description = buildDescription(g, ctx, tz);
      items.push({
        title, description, executor: first.sender, is_mine: true,
        work_date: workDate as ExtractedWorkItem["work_date"], duration_minutes: duration, start_time: startTime, end_time: endTime,
        work_status: { value: st.value, source: st.source, confidence: st.confidence, reason: st.reason },
        explicit_jira_key: explicitKey, confidence, evidence, assumptions,
      });
    }

    if (onProgress) await onProgress(messages.length, items.filter((i) => i.is_mine).length);
    if (!items.length) warnings.push("No work-related messages were detected in this conversation.");
    return { provider: this.name, model: null, is_demo: true, participants, work_message_ids: workIds, noise_count: noise, items, warnings };
  }
}

function buildOtherItem(g: AIMessage[], exec: string, first: AIMessage, tz: string): ExtractedWorkItem {
  const title = cleanTitle(first.message.split("\n")[0]!);
  return {
    title, description: `Work discussed by ${exec}; not attributed to you.`, executor: exec, is_mine: false,
    work_date: { value: dateInTz(new Date(first.timestamp), tz), source: "explicit", confidence: 0.9, reason: "Timestamp of first message." },
    duration_minutes: { value: 0, source: "unknown", confidence: 0, reason: "Not your work; no duration estimated." },
    start_time: { value: null, source: "unknown", confidence: 0, reason: "" }, end_time: { value: null, source: "unknown", confidence: 0, reason: "" },
    work_status: { value: "UNKNOWN", source: "unknown", confidence: 0, reason: "Performed by another participant." },
    explicit_jira_key: null, confidence: 0.3,
    evidence: g.map((m) => ({ message_id: m.id, reason: `Message by ${m.sender}` })),
    assumptions: [{ key: "executor", label: "Performed by", state: "inferred", summary: exec, reasoning: `The work statements came from ${exec}, not from you. Excluded from your timesheet unless you claim it.` }],
  };
}

function buildDescription(g: AIMessage[], ctx: AIContext, tz: string): string {
  const lines = g.slice(0, 8).map((m) => `${timeInTz(new Date(m.timestamp), tz)} ${isAlias(m.sender, ctx) ? "You" : m.sender}: ${trunc(m.message.replace(/\n/g, " "), 120)}`);
  return `Summary of conversation:\n${lines.join("\n")}${g.length > 8 ? `\n… and ${g.length - 8} more messages` : ""}`;
}

function findExplicitDuration(text: string): { minutes: number; text: string } | null {
  // Prefer phrases like "took 2 hours", "spent 45 min", "2h", "1.5 jam"
  const re = new RegExp(DURATION_RE.source, "gi");
  let best: { minutes: number; text: string } | null = null;
  for (const m of text.matchAll(re)) {
    const before = text.slice(Math.max(0, (m.index ?? 0) - 25), m.index ?? 0).toLowerCase();
    const contextual = /(took|spent|spend|about|around|approx|roughly|lebih kurang|ambil|dalam|for|total|effort)\s*$/.test(before) || /^\s*(of work|effort|to fix|to complete)/.test(text.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 12).toLowerCase());
    if (!contextual) continue;
    const minutes = m[1] ? Math.round(parseFloat(m[1]) * 60) : m[3] ? parseInt(m[3], 10) : 0;
    if (minutes > 0 && minutes <= 16 * 60) best = { minutes, text: m[0] };
  }
  return best;
}

function rangeMinutes(m: RegExpExecArray): number {
  let h1 = parseInt(m[1]!, 10); const m1 = parseInt(m[2] ?? "0", 10);
  let h2 = parseInt(m[4]!, 10); const m2 = parseInt(m[5] ?? "0", 10);
  const ap1 = m[3]?.toLowerCase(); const ap2 = m[6]?.toLowerCase();
  if (ap1 === "pm" && h1 < 12) h1 += 12;
  if (ap2 === "pm" && h2 < 12) h2 += 12;
  if (!ap1 && ap2 === "pm" && h1 < h2 - 12) h1 += 12;
  const d = h2 * 60 + m2 - (h1 * 60 + m1);
  return d > 0 && d <= 16 * 60 ? d : 0;
}
