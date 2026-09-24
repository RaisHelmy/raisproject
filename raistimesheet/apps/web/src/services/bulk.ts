import type { TimesheetDTO } from "@rais/shared-types";
import { api } from "@/services/api";

type Query = Record<string, string | number | boolean | null | undefined>;

export async function fetchAllTimesheetIds(query: Query): Promise<TimesheetDTO[]> {
  const out: TimesheetDTO[] = [];
  for (let page = 1; ; page++) {
    const r = await api<{ items: TimesheetDTO[]; total: number }>("/timesheets", { query: { ...query, page, page_size: 200 } });
    out.push(...r.data.items);
    if (out.length >= r.data.total || r.data.items.length === 0) return out;
  }
}

// Small chunks keep each request well inside the Worker's per-request CPU budget.
export async function bulkInChunks(action: "submit" | "approve" | "reject", ids: string[], reason?: string, onProgress?: (done: number) => void) {
  const succeeded: string[] = [];
  const failed: { id: string; reason: string }[] = [];
  for (let i = 0; i < ids.length; i += 20) {
    const chunk = ids.slice(i, i + 20);
    try {
      const r = await api<{ succeeded: string[]; failed: { id: string; reason: string }[] }>("/timesheets/bulk", { body: { action, ids: chunk, reason } });
      succeeded.push(...r.data.succeeded);
      failed.push(...r.data.failed);
    } catch (e) {
      failed.push(...chunk.map((id) => ({ id, reason: e instanceof Error ? e.message : "Request failed" })));
    }
    onProgress?.(Math.min(ids.length, i + chunk.length));
  }
  return { succeeded, failed };
}
