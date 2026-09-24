/**
 * WhatsApp export parser.
 * Handles Android/iOS text exports, several date formats, multiline messages,
 * system messages, attachments and deleted messages. Output is normalised.
 */

export interface ParsedMessage {
  seq: number;
  timestamp: string; // ISO 8601 with offset
  sender: string;
  message: string;
  is_system: boolean;
  is_attachment: boolean;
  is_deleted: boolean;
}

export interface ParseOptions {
  /** IANA timezone used to build ISO timestamps (WhatsApp exports have no offset). */
  timezone?: string;
  /** "DMY" (Malaysia, most of the world) or "MDY" (US). "auto" detects from data. */
  dateOrder?: "DMY" | "MDY" | "auto";
}

export interface ParseResult {
  messages: ParsedMessage[];
  participants: string[];
  date_order: "DMY" | "MDY";
  skipped_lines: number;
  warnings: string[];
}

// 04/09/2026, 09:15 - Rais: text
// [04/09/2026, 09:15:22] Rais: text
// 4/9/26, 9:15 AM - Rais: text
// 04.09.2026, 09:15 - Rais: text
// 2026-09-04 09:15 - Rais: text
const LINE_RE =
  /^‎?\[?(\d{1,4})[\/.\-](\d{1,2})[\/.\-](\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([APap]\.?[Mm]\.?)?\]?\s*(?:-\s*)?(.*)$/;

const SYSTEM_PATTERNS = [
  /messages and calls are end-to-end encrypted/i,
  /created group/i,
  /added you/i,
  /\badded\b.*\bto the group/i,
  /\bleft$/i,
  /changed the subject/i,
  /changed this group's icon/i,
  /changed the group description/i,
  /joined using this group's invite link/i,
  /security code changed/i,
  /you're now an admin/i,
  /removed\s/i,
  /pinned a message/i,
  /missed voice call/i,
  /missed video call/i,
];

const ATTACHMENT_PATTERNS = [/<media omitted>/i, /\(file attached\)/i, /<attached:.*>/i, /image omitted/i, /video omitted/i, /audio omitted/i, /document omitted/i, /sticker omitted/i, /gif omitted/i, /\.(jpg|jpeg|png|pdf|docx|xlsx|mp4|opus|vcf)\s*\(file attached\)/i];
const DELETED_PATTERNS = [/this message was deleted/i, /you deleted this message/i, /message deleted/i];

interface RawLine { d1: number; d2: number; year: number; h: number; m: number; s: number; ampm?: string; rest: string }

export function parseWhatsApp(text: string, opts: ParseOptions = {}): ParseResult {
  const tz = opts.timezone ?? "Asia/Kuala_Lumpur";
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const raw: { line: RawLine; extra: string[] }[] = [];
  let skipped = 0;
  const warnings: string[] = [];

  for (const line of lines) {
    const m = LINE_RE.exec(line.replace(/^﻿/, ""));
    if (m) {
      const a = Number(m[1]);
      const b = Number(m[2]);
      let year = Number(m[3]);
      if (year < 100) year += 2000;
      // ISO order: 2026-09-04
      const iso = a > 31;
      raw.push({ line: { d1: iso ? b : a, d2: iso ? Number(m[3]) : b, year: iso ? a : year, h: Number(m[4]), m: Number(m[5]), s: Number(m[6] ?? 0), ampm: m[7], rest: m[8] ?? "" }, extra: [] });
      if (iso) raw[raw.length - 1]!.line.d2 = b, raw[raw.length - 1]!.line.d1 = Number(m[3]);
    } else if (raw.length) {
      raw[raw.length - 1]!.extra.push(line);
    } else if (line.trim()) {
      skipped++;
    }
  }

  // Detect date order. If any first component > 12, it's DMY; if any second > 12, MDY.
  let order: "DMY" | "MDY" = opts.dateOrder && opts.dateOrder !== "auto" ? opts.dateOrder : "DMY";
  if (!opts.dateOrder || opts.dateOrder === "auto") {
    const firstOver = raw.some((r) => r.line.d1 > 12);
    const secondOver = raw.some((r) => r.line.d2 > 12);
    if (secondOver && !firstOver) order = "MDY";
    else if (firstOver) order = "DMY";
    else {
      // ambiguous — check monotonic ordering under each interpretation
      order = monotonicScore(raw.map((r) => r.line), "DMY") >= monotonicScore(raw.map((r) => r.line), "MDY") ? "DMY" : "MDY";
      if (raw.length) warnings.push("Date order was ambiguous; interpreted as day/month/year.");
    }
  }

  const messages: ParsedMessage[] = [];
  const participants = new Set<string>();
  let seq = 0;
  for (const r of raw) {
    const { d1, d2, year } = r.line;
    const day = order === "DMY" ? d1 : d2;
    const month = order === "DMY" ? d2 : d1;
    let hour = r.line.h;
    if (r.line.ampm) {
      const pm = /p/i.test(r.line.ampm);
      if (pm && hour < 12) hour += 12;
      if (!pm && hour === 12) hour = 0;
    }
    const timestamp = toIso(year, month, day, hour, r.line.m, r.line.s, tz);
    const body = [r.line.rest, ...r.extra].join("\n").replace(/‎/g, "").trimEnd();

    // "Sender: message" — sender may not contain ':' before the first colon-space.
    const idx = body.indexOf(": ");
    let sender = "";
    let message = body;
    if (idx > 0 && idx < 80 && !/^https?:/i.test(body)) {
      sender = body.slice(0, idx).trim();
      message = body.slice(idx + 2);
    }
    const isSystem = sender === "" || SYSTEM_PATTERNS.some((p) => p.test(message)) || (sender !== "" && SYSTEM_PATTERNS.some((p) => p.test(body)) && message.length < 120 && /group|added|left|removed|changed/i.test(message));
    const isAttachment = ATTACHMENT_PATTERNS.some((p) => p.test(message));
    const isDeleted = DELETED_PATTERNS.some((p) => p.test(message));
    if (!isSystem && sender) participants.add(sender);
    messages.push({ seq: seq++, timestamp, sender: isSystem && !sender ? "System" : sender, message: message.trim(), is_system: isSystem, is_attachment: isAttachment, is_deleted: isDeleted });
  }

  return { messages, participants: [...participants], date_order: order, skipped_lines: skipped, warnings };
}

function monotonicScore(lines: RawLine[], order: "DMY" | "MDY"): number {
  let score = 0;
  let prev = 0;
  for (const l of lines) {
    const day = order === "DMY" ? l.d1 : l.d2;
    const month = order === "DMY" ? l.d2 : l.d1;
    if (month > 12 || day > 31) return -1;
    const v = Date.UTC(l.year, month - 1, day, l.h, l.m);
    if (v >= prev) score++;
    prev = v;
  }
  return score;
}

/** Build an ISO timestamp for wall-clock time in `tz`. */
export function toIso(y: number, mo: number, d: number, h: number, mi: number, s: number, tz: string): string {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  const offsetMin = tzOffsetMinutes(new Date(guess), tz);
  const utc = guess - offsetMin * 60000;
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  const oh = String(Math.floor(abs / 60)).padStart(2, "0");
  const om = String(abs % 60).padStart(2, "0");
  const local = new Date(utc + offsetMin * 60000);
  return `${local.getUTCFullYear()}-${p(local.getUTCMonth() + 1)}-${p(local.getUTCDate())}T${p(local.getUTCHours())}:${p(local.getUTCMinutes())}:${p(local.getUTCSeconds())}${sign}${oh}:${om}`;
}

function p(n: number) { return String(n).padStart(2, "0"); }

function tzOffsetMinutes(date: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const parts = dtf.formatToParts(date);
  const get = (t: string) => Number(parts.find((x) => x.type === t)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") === 24 ? 0 : get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - date.getTime()) / 60000);
}
