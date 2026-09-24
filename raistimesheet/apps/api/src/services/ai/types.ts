import type { AIAssumption, AIField, Evidence, ParticipantSummary, WorkStatus } from "@rais/shared-types";

/** Normalised message handed to the AI stages. */
export interface AIMessage {
  id: string;
  seq: number;
  timestamp: string;
  sender: string;
  message: string;
  is_system: boolean;
  is_attachment: boolean;
  is_deleted: boolean;
}

export interface AIContext {
  /** Display name of the timesheet owner (the person whose work we extract). */
  me_name: string;
  /** Names used by that person in WhatsApp exports (case-insensitive). */
  me_aliases: string[];
  project: { code: string; name: string; jira_project_key: string | null; timezone: string; working_hours_start: string; working_hours_end: string };
  today: string;
}

export interface ExtractedWorkItem {
  title: string;
  description: string;
  executor: string;
  is_mine: boolean;
  work_date: AIField<string>;
  duration_minutes: AIField<number>;
  start_time: AIField<string | null>;
  end_time: AIField<string | null>;
  work_status: AIField<WorkStatus>;
  explicit_jira_key: string | null;
  confidence: number;
  evidence: Evidence[];
  assumptions: AIAssumption[];
}

export interface AnalysisResult {
  provider: string;
  model: string | null;
  is_demo: boolean;
  participants: ParticipantSummary[];
  work_message_ids: string[];
  noise_count: number;
  items: ExtractedWorkItem[];
  warnings: string[];
}

export type ProgressFn = (processed: number, detected: number) => Promise<void>;

export interface AIProvider {
  readonly name: string;
  readonly model: string | null;
  readonly is_demo: boolean;
  analyse(messages: AIMessage[], ctx: AIContext, onProgress?: ProgressFn): Promise<AnalysisResult>;
}

export const JIRA_KEY_RE = /\b([A-Z][A-Z0-9]{1,9}-\d{1,6})\b/g;

export function isAlias(sender: string, ctx: AIContext): boolean {
  const s = sender.trim().toLowerCase();
  return ctx.me_aliases.some((a) => a.trim().toLowerCase() === s) || s === ctx.me_name.trim().toLowerCase();
}

export function clamp01(n: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
}
