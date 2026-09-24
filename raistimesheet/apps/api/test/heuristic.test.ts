import { describe, expect, it } from "vitest";
import { HeuristicAIProvider } from "../src/services/ai/heuristic";
import { parseWhatsApp } from "../src/services/whatsapp/parser";
import type { AIContext } from "../src/services/ai/types";

const ctx: AIContext = { me_name: "Rais Helmy", me_aliases: ["Rais"], today: "2026-09-04", project: { code: "BNM", name: "BNM", jira_project_key: "BNM", timezone: "Asia/Kuala_Lumpur", working_hours_start: "09:00", working_hours_end: "18:00" } };

function msgs(text: string) {
  return parseWhatsApp(text).messages.map((m, i) => ({ ...m, id: `m${i}` }));
}

describe("Heuristic AI provider", () => {
  const p = new HeuristicAIProvider();

  it("groups a troubleshooting thread into one task with inferred duration and explicit completion", async () => {
    const r = await p.analyse(msgs(`04/09/2026, 09:15 - Rais: API is down, checking logs
04/09/2026, 09:40 - Rais: Found DB timeout
04/09/2026, 10:20 - Rais: Changing connection timeout and testing
04/09/2026, 11:05 - Rais: Fixed, deployed to SIT
04/09/2026, 11:06 - PIC: Thanks`), ctx);
    const mine = r.items.filter((i) => i.is_mine);
    expect(mine.length).toBe(1);
    expect(mine[0]!.work_status.value).toBe("COMPLETED");
    expect(mine[0]!.work_status.source).toBe("explicit");
    expect(mine[0]!.duration_minutes.source).toBe("inferred");
    expect(mine[0]!.duration_minutes.value).toBeGreaterThanOrEqual(60);
    expect(mine[0]!.duration_minutes.value).toBeLessThan(110); // not the full 110-minute window; gaps capped
    expect(mine[0]!.work_date.value).toBe("2026-09-04");
    expect(mine[0]!.evidence.length).toBeGreaterThanOrEqual(4);
    expect(mine[0]!.assumptions.find((a) => a.key === "duration")?.state).toBe("inferred");
  });

  it("separates distinct tasks across days and requests", async () => {
    const r = await p.analyse(msgs(`01/09/2026, 09:00 - PIC: Please fix the API issue
01/09/2026, 09:30 - Rais: Checking
01/09/2026, 10:30 - Rais: Fixed
02/09/2026, 09:00 - PIC: Can you prepare the deployment package?
02/09/2026, 11:00 - Rais: Package prepared and deployed to SIT
03/09/2026, 09:00 - PIC: Please create user account for tester
03/09/2026, 09:20 - Rais: Account created, done`), ctx);
    const mine = r.items.filter((i) => i.is_mine);
    expect(mine.length).toBe(3);
    expect(mine.map((i) => i.work_date.value)).toEqual(["2026-09-01", "2026-09-02", "2026-09-03"]);
  });

  it("does not attribute another developer's work to me", async () => {
    const r = await p.analyse(msgs(`04/09/2026, 09:15 - Aiman: I fixed the API issue and deployed it
04/09/2026, 09:16 - PIC: Thanks Aiman`), ctx);
    expect(r.items.filter((i) => i.is_mine).length).toBe(0);
    expect(r.items.length).toBe(1);
    expect(r.items[0]!.executor).toBe("Aiman");
  });

  it("uses explicit durations and Jira keys when stated, handles Malay", async () => {
    const r = await p.analyse(msgs(`04/09/2026, 14:00 - Nadia: Tolong semak laporan bulanan
04/09/2026, 14:05 - Rais: Boleh, sedang semak
04/09/2026, 16:30 - Rais: Dah siap, took about 2 hours. This is BNM-1005`), ctx);
    const mine = r.items.filter((i) => i.is_mine);
    expect(mine.length).toBe(1);
    expect(mine[0]!.duration_minutes).toMatchObject({ value: 120, source: "explicit" });
    expect(mine[0]!.explicit_jira_key).toBe("BNM-1005");
    expect(mine[0]!.work_status.value).toBe("COMPLETED");
  });

  it("flags low confidence when only one message exists", async () => {
    const r = await p.analyse(msgs(`04/09/2026, 10:05 - Rais: Checked the reporting job, ran fine`), ctx);
    const mine = r.items.filter((i) => i.is_mine);
    expect(mine.length).toBe(1);
    expect(mine[0]!.duration_minutes.source).toBe("assumed");
    expect(mine[0]!.confidence).toBeLessThan(0.7);
  });

  it("ignores pure noise conversations", async () => {
    const r = await p.analyse(msgs(`04/09/2026, 10:05 - Rais: Good morning
04/09/2026, 10:06 - PIC: Morning
04/09/2026, 10:07 - Rais: 👍`), ctx);
    expect(r.items.length).toBe(0);
    expect(r.noise_count).toBe(3);
  });
});
