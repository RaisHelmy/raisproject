import { describe, expect, it } from "vitest";
import { duplicateCandidates, matchTimesheet, overallResult, titleSimilarity } from "../src/services/jira/matcher";
import { classifyDelay } from "../src/lib/delay";

const issues = [
  { key: "BNM-1524", summary: "Investigate API timeout issue", project_key: "BNM", assignee_account_id: "rais", updated: "2026-09-04T10:00:00+08:00" },
  { key: "BNM-1002", summary: "SIT deployment package v2.3", project_key: "BNM", assignee_account_id: "rais", updated: "2026-09-01T10:00:00+08:00" },
  { key: "BNM-1004", summary: "User access request for UAT testers", project_key: "BNM", assignee_account_id: "aiman", updated: "2026-05-01T10:00:00+08:00", status_category: "done" },
  { key: "TNB-201", summary: "Investigate API timeout issue", project_key: "TNB", assignee_account_id: "rais", updated: "2026-09-04T10:00:00+08:00" },
];

describe("Jira matcher", () => {
  it("prefers an explicit issue key from the conversation", () => {
    const c = matchTimesheet({ title: "Something else", description: "", work_date: "2026-09-04", explicit_jira_key: "BNM-1002" }, issues, { project_key: "BNM" });
    expect(c[0]).toMatchObject({ issue_key: "BNM-1002", confidence: 1, result: "EXACT_MATCH" });
    expect(overallResult(c)).toBe("EXACT_MATCH");
  });

  it("finds exact title matches within the project only", () => {
    const c = matchTimesheet({ title: "Investigate API timeout issue", description: "", work_date: "2026-09-04", user_jira_account_id: "rais" }, issues, { project_key: "BNM" });
    expect(c[0]!.issue_key).toBe("BNM-1524");
    expect(c[0]!.result).toBe("EXACT_MATCH");
    expect(c.some((x) => x.issue_key === "TNB-201")).toBe(false);
  });

  it("suggests similar titles with lower confidence", () => {
    const c = matchTimesheet({ title: "Investigated the API timeouts on SIT", description: "", work_date: "2026-09-04" }, issues, { project_key: "BNM" });
    expect(c[0]!.issue_key).toBe("BNM-1524");
    expect(c[0]!.result).toBe("SUGGESTED_MATCH");
    expect(c[0]!.confidence).toBeGreaterThan(0.45);
    expect(c[0]!.confidence).toBeLessThan(0.92);
  });

  it("returns no match for unrelated work", () => {
    const c = matchTimesheet({ title: "Prepare quarterly billing statement", description: "", work_date: "2026-09-04" }, issues, { project_key: "BNM" });
    expect(c.length).toBe(0);
    expect(overallResult(c)).toBe("NO_MATCH");
  });

  it("flags potential duplicates before creation", () => {
    const d = duplicateCandidates({ title: "Investigate API timeout", description: "", work_date: "2026-09-04" }, issues, "BNM");
    expect(d[0]).toMatchObject({ issue_key: "BNM-1524", result: "POTENTIAL_DUPLICATE" });
  });

  it("title similarity is symmetric-ish and bounded", () => {
    const s = titleSimilarity("Fix login bug", "Fix the login bug");
    expect(s).toBeGreaterThan(0.6);
    expect(s).toBeLessThanOrEqual(1);
    expect(titleSimilarity("abc", "xyz")).toBe(0);
  });
});

describe("Delay classification", () => {
  const today = "2026-09-04";
  it("never calls a task delayed without a due date", () => {
    expect(classifyDelay({ due_date: null, resolved_at: null, status_category: "done", status: "Done", today }).state).toBe("NO_DUE_DATE");
  });
  it("computes delay days for completed tasks", () => {
    expect(classifyDelay({ due_date: "2026-09-02", resolved_at: "2026-09-04T11:00:00+08:00", status_category: "done", status: "Done", today })).toMatchObject({ state: "DELAYED", days: 2 });
    expect(classifyDelay({ due_date: "2026-09-05", resolved_at: "2026-09-04T11:00:00+08:00", status_category: "done", status: "Done", today }).state).toBe("ON_TIME");
  });
  it("marks open tasks as at risk, overdue or open", () => {
    expect(classifyDelay({ due_date: "2026-09-05", resolved_at: null, status_category: "indeterminate", status: "In Progress", today }).state).toBe("AT_RISK");
    expect(classifyDelay({ due_date: "2026-09-01", resolved_at: null, status_category: "new", status: "To Do", today })).toMatchObject({ state: "DELAYED", days: 3 });
    expect(classifyDelay({ due_date: "2026-09-30", resolved_at: null, status_category: "new", status: "To Do", today }).state).toBe("OPEN");
    expect(classifyDelay({ due_date: "2026-09-30", resolved_at: null, status_category: "new", status: "Blocked", today }).state).toBe("BLOCKED");
  });
});
