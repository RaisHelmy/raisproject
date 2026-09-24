import { describe, expect, it } from "vitest";
import { EntitlementService } from "../src/services/entitlements";
import { fakeCtx, model, mode, plan, user } from "./helpers";

function service(o: { subPlan?: ReturnType<typeof plan> | null; orgPlan?: ReturnType<typeof plan> | null; planModels?: string[]; usedToday?: number; ksUsed?: number; convs?: number } = {}) {
  const free = plan(); const plus = plan({ id: "p-plus", code: "plus", price_monthly: 9.99, allow_file_upload: true, allow_premium_knowledge: true, message_limit_daily: 300, priority: 10, max_upload_files_per_day: 5 });
  const pro = plan({ id: "p-pro", code: "pro", price_monthly: 24.99, allow_file_upload: true, allow_premium_knowledge: true, allow_advanced_modes: true, message_limit_daily: null, priority: 20 });
  const repos = {
    subscriptions: { activeForUser: async () => (o.subPlan ? { plan: o.subPlan } : null), activeForOrg: async () => (o.orgPlan ? { plan: o.orgPlan } : null) },
    organizations: { findById: async () => null },
    plans: { findByCode: async (c: string) => [free, plus, pro].find((p) => p.code === c) ?? null, findById: async () => null, listActive: async () => [free, plus, pro], modelsForPlan: async (id: string) => (o.planModels ?? ["m1"]).map((m) => ({ plan_id: id, model_id: m, enabled: true, priority: 0 })), allPlanModels: async () => [{ plan_id: "p-plus", model_id: "m2", enabled: true, priority: 0, plan_code: "plus" }, { plan_id: "p-pro", model_id: "m2", enabled: true, priority: 0, plan_code: "pro" }, { plan_id: "p-pro", model_id: "m3", enabled: true, priority: 0, plan_code: "pro" }] },
    usage: { countTodayForUser: async (_u: string, kind: string) => (kind === "chat" ? o.usedToday ?? 0 : o.ksUsed ?? 0) },
    uploads: { countToday: async () => 0 },
    conversations: { countForUser: async () => o.convs ?? 0 },
  };
  return new EntitlementService(fakeCtx(repos));
}

describe("EntitlementService", () => {
  it("defaults to the Free plan when there is no subscription", async () => {
    const r = await service().effectivePlan(user());
    expect(r.plan.code).toBe("free"); expect(r.source).toBe("default");
  });
  it("prefers the highest-priority plan between user and organization", async () => {
    const s = service({ subPlan: plan({ code: "plus", priority: 10 }), orgPlan: plan({ code: "pro", priority: 20 }) });
    const r = await s.effectivePlan(user({ org_ids: ["o1"] }));
    expect(r.plan.code).toBe("pro"); expect(r.source).toBe("organization");
  });
  it("allows models enabled for the plan and names the cheapest unlocking plan otherwise", async () => {
    const s = service();
    expect((await s.canUseModel(user(), model({ id: "m1" }))).allowed).toBe(true);
    const r = await s.canUseModel(user(), model({ id: "m2" }));
    expect(r.allowed).toBe(false); expect(r.required_plan).toBe("plus");
    expect((await s.canUseModel(user(), model({ id: "m3" }))).required_plan).toBe("pro");
  });
  it("blocks inactive models even for admins", async () => {
    expect((await service().canUseModel(user({ role: "admin" }), model({ is_active: false }))).allowed).toBe(false);
  });
  it("admins can use every active model", async () => {
    expect((await service().canUseModel(user({ role: "admin" }), model({ id: "m3" }))).allowed).toBe(true);
  });
  it("enforces the daily message quota", async () => {
    await expect(service({ usedToday: 30 }).assertMessageQuota(user())).rejects.toMatchObject({ code: "QUOTA_EXCEEDED" });
    await expect(service({ usedToday: 29 }).assertMessageQuota(user())).resolves.toBeUndefined();
    await expect(service({ subPlan: plan({ code: "pro", message_limit_daily: null }), usedToday: 9999 }).assertMessageQuota(user())).resolves.toBeUndefined();
  });
  it("gates file upload and advanced modes by plan", async () => {
    const free = service();
    expect((await free.canUploadFile(user())).allowed).toBe(false);
    expect((await free.canUploadFile(user())).required_plan).toBe("plus");
    expect((await free.canUseAdvancedMode(user(), mode({ is_advanced: true }))).required_plan).toBe("pro");
    expect((await free.canUseAdvancedMode(user(), mode({ is_advanced: false }))).allowed).toBe(true);
    const pro = service({ subPlan: plan({ code: "pro", allow_file_upload: true, allow_advanced_modes: true }) });
    expect((await pro.canUploadFile(user())).allowed).toBe(true);
    expect((await pro.canUseAdvancedMode(user(), mode({ is_advanced: true }))).allowed).toBe(true);
  });
  it("computes knowledge visibility from plan and role", async () => {
    expect(await service().visibleVisibilities(user())).toEqual(["public"]);
    expect(await service({ subPlan: plan({ allow_premium_knowledge: true }) }).visibleVisibilities(user())).toEqual(["public", "premium"]);
    expect(await service().visibleVisibilities(user({ role: "admin" }))).toEqual(["public", "premium", "admin"]);
    expect(await service().canUseKnowledge(user({ org_ids: ["o1"] }), "private", "o1")).toBe(true);
    expect(await service().canUseKnowledge(user({ org_ids: ["o2"] }), "private", "o1")).toBe(false);
    expect(await service().canUseKnowledge(user(), "admin", null)).toBe(false);
  });
  it("limits conversations on Free", async () => {
    await expect(service({ convs: 30 }).assertConversationQuota(user())).rejects.toMatchObject({ code: "QUOTA_EXCEEDED" });
  });
});
