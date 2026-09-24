/**
 * Timesheet ↔ Jira matching.
 * Sequence: explicit key → existing link → exact title → token similarity with
 * project / assignee / date bonuses. Pure function; no I/O.
 */
import type { MatchResult } from "@rais/shared-types";
import { daysBetween } from "../../lib/time";

export interface MatchTimesheet {
  title: string;
  description: string;
  work_date: string;
  explicit_jira_key?: string | null;
  existing_link_key?: string | null;
  user_jira_account_id?: string | null;
}

export interface MatchIssue {
  key: string;
  summary: string;
  description?: string | null;
  project_key: string;
  assignee_account_id?: string | null;
  created?: string | null;
  updated?: string | null;
  status_category?: string;
}

export interface Candidate { issue_key: string; summary: string; confidence: number; reason: string; result: MatchResult }

const STOP = new Set(["the", "and", "for", "with", "that", "this", "from", "into", "onto", "issue", "task", "please", "pls", "tolong", "boleh", "yang", "dan", "untuk", "dengan", "pada", "dari", "ke", "di", "need", "check", "kindly", "help", "can", "you", "are", "was", "were", "has", "have", "had"]);

export function tokenize(s: string): string[] {
  return s.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}\s-]/gu, " ").split(/[\s-]+/).map(stem).filter((w) => w.length > 2 && !STOP.has(w));
}

function stem(w: string): string {
  return w.replace(/(ing|ed|es|s|ion|ions|ment|ments)$/i, (m) => (w.length - m.length >= 3 ? "" : m));
}

function bigrams(s: string): Set<string> {
  const t = s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const out = new Set<string>();
  for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2));
  return out;
}

function dice(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return (2 * inter) / (a.size + b.size);
}

function jaccard(a: string[], b: string[]): number {
  const A = new Set(a), B = new Set(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

export function titleSimilarity(a: string, b: string): number {
  const j = jaccard(tokenize(a), tokenize(b));
  const d = dice(bigrams(a), bigrams(b));
  return 0.6 * j + 0.4 * d;
}

export function matchTimesheet(ts: MatchTimesheet, issues: MatchIssue[], opts: { project_key?: string | null; suggest_threshold?: number; exact_threshold?: number } = {}): Candidate[] {
  const suggest = opts.suggest_threshold ?? 0.45;
  const exactT = opts.exact_threshold ?? 0.92;
  const out: Candidate[] = [];

  // 1. explicit key from conversation
  if (ts.explicit_jira_key) {
    const hit = issues.find((i) => i.key === ts.explicit_jira_key);
    if (hit) out.push({ issue_key: hit.key, summary: hit.summary, confidence: 1, reason: `Issue key ${hit.key} was mentioned in the conversation.`, result: "EXACT_MATCH" });
    else out.push({ issue_key: ts.explicit_jira_key, summary: "(not found in Jira cache)", confidence: 0.6, reason: `Issue key ${ts.explicit_jira_key} was mentioned but could not be found in the synced Jira issues.`, result: "SUGGESTED_MATCH" });
  }
  // 2. existing link
  if (ts.existing_link_key) {
    const hit = issues.find((i) => i.key === ts.existing_link_key);
    if (hit && !out.some((c) => c.issue_key === hit.key)) out.push({ issue_key: hit.key, summary: hit.summary, confidence: 1, reason: "Already linked to this timesheet.", result: "EXACT_MATCH" });
  }

  const scored = issues
    .filter((i) => !opts.project_key || i.project_key === opts.project_key)
    .filter((i) => !out.some((c) => c.issue_key === i.key))
    .map((i) => {
      let score = titleSimilarity(ts.title, i.summary);
      const reasons: string[] = [];
      const normA = ts.title.trim().toLowerCase().replace(/\s+/g, " ");
      const normB = i.summary.trim().toLowerCase().replace(/\s+/g, " ");
      if (normA === normB) { score = Math.max(score, 0.98); reasons.push("Exact title match"); }
      else reasons.push(`Title similarity ${Math.round(score * 100)}%`);
      // description keywords
      if (ts.description && i.description) {
        const ds = jaccard(tokenize(ts.description), tokenize(i.description));
        if (ds > 0.15) { score += Math.min(0.1, ds * 0.3); reasons.push("Description keywords overlap"); }
      }
      // assignee
      if (ts.user_jira_account_id && i.assignee_account_id === ts.user_jira_account_id) { score += 0.08; reasons.push("Assigned to you"); }
      // date proximity
      const ref = i.updated ?? i.created;
      if (ref) {
        const d = Math.abs(daysBetween(ts.work_date, ref));
        if (d <= 3) { score += 0.08; reasons.push("Updated within 3 days of the work date"); }
        else if (d <= 14) { score += 0.04; reasons.push("Updated within two weeks of the work date"); }
        else if (d > 120) { score -= 0.1; reasons.push("Issue activity is far from the work date"); }
      }
      if (i.status_category === "done" && ref && daysBetween(ref, ts.work_date) > 30) { score -= 0.15; reasons.push("Issue was closed long before the work date"); }
      return { i, score: Math.max(0, Math.min(0.99, score)), reasons };
    })
    .filter((x) => x.score >= suggest)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  for (const s of scored) {
    out.push({ issue_key: s.i.key, summary: s.i.summary, confidence: Math.round(s.score * 100) / 100, reason: s.reasons.join(" · "), result: s.score >= exactT ? "EXACT_MATCH" : "SUGGESTED_MATCH" });
  }
  return out;
}

export function overallResult(c: Candidate[]): MatchResult {
  if (!c.length) return "NO_MATCH";
  if (c[0]!.result === "EXACT_MATCH") return "EXACT_MATCH";
  return "SUGGESTED_MATCH";
}

/** Before creating a new issue: anything reasonably similar is a potential duplicate. */
export function duplicateCandidates(ts: MatchTimesheet, issues: MatchIssue[], project_key: string | null): Candidate[] {
  return matchTimesheet(ts, issues, { project_key, suggest_threshold: 0.6 }).map((c) => ({ ...c, result: c.confidence >= 0.6 ? "POTENTIAL_DUPLICATE" : c.result }));
}
