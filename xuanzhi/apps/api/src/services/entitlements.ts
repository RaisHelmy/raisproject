/**
 * Centralised entitlement checks. Nothing else in the app inspects plans directly — routes and services ask this
 * service. The effective plan comes from the user's own subscription, else the highest-priority plan of any
 * organization they belong to, else the Free plan. Results are cached in KV for 60 s (invalidated on changes).
 */
import type { EntitlementsDTO, PlanCode, Visibility } from "@xuanzhi/shared-types";
import type { AppContext, AuthUser } from "./context";
import { isAdmin } from "./context";
import type { ModeRow, ModelRow, PlanRow } from "../repositories/types";
import { toPlanDTO } from "./mappers";
import { Errors } from "../lib/errors";

export interface EffectivePlan { plan: PlanRow; source: "user" | "organization" | "default"; organization_id: string | null }

export interface IEntitlementService {
  effectivePlan(user: AuthUser): Promise<EffectivePlan>;
  canUseModel(user: AuthUser, model: ModelRow): Promise<{ allowed: boolean; required_plan: PlanCode | null }>;
  canUseKnowledge(user: AuthUser, visibility: Visibility, kbOrganizationId: string | null): Promise<boolean>;
  canUploadFile(user: AuthUser): Promise<{ allowed: boolean; reason?: string; required_plan?: PlanCode | null }>;
  canUseAdvancedMode(user: AuthUser, mode: ModeRow): Promise<{ allowed: boolean; required_plan: PlanCode | null }>;
  visibleVisibilities(user: AuthUser): Promise<Visibility[]>;
  assertMessageQuota(user: AuthUser): Promise<void>;
  knowledgeSearchAllowed(user: AuthUser): Promise<boolean>;
  assertConversationQuota(user: AuthUser): Promise<void>;
  entitlements(user: AuthUser): Promise<EntitlementsDTO>;
  invalidate(userId: string): Promise<void>;
}

const TTL = 60;

export class EntitlementService implements IEntitlementService {
  constructor(private readonly ctx: AppContext) {}

  private get kv(): KVNamespace | undefined { return (this.ctx.env as { CACHE?: KVNamespace }).CACHE; }

  async effectivePlan(user: AuthUser): Promise<EffectivePlan> {
    const key = `ent:v1:${user.id}`;
    try { const cached = await this.kv?.get<EffectivePlan>(key, "json"); if (cached) return cached; } catch { /* cache miss */ }
    const r = this.ctx.repos;
    let out: EffectivePlan | null = null;
    const own = await r.subscriptions.activeForUser(user.id);
    if (own) out = { plan: own.plan, source: "user", organization_id: null };
    for (const orgId of user.org_ids) {
      const s = await r.subscriptions.activeForOrg(orgId);
      const org = s ? null : await r.organizations.findById(orgId);
      const plan = s?.plan ?? (org?.plan_id ? await r.plans.findById(org.plan_id) : null);
      if (plan && (!out || plan.priority > out.plan.priority)) out = { plan, source: "organization", organization_id: orgId };
    }
    if (!out) { const free = (await r.plans.findByCode("free"))!; out = { plan: free, source: "default", organization_id: null }; }
    try { await this.kv?.put(key, JSON.stringify(out), { expirationTtl: TTL }); } catch { /* ignore */ }
    return out;
  }

  async invalidate(userId: string) { try { await this.kv?.delete(`ent:v1:${userId}`); } catch { /* ignore */ } }

  /** Lowest-priced active plan that enables the model (for the upgrade prompt). */
  private async requiredPlanFor(modelId: string): Promise<PlanCode | null> {
    const [plans, pm] = await Promise.all([this.ctx.repos.plans.listActive(), this.ctx.repos.plans.allPlanModels()]);
    const codes = new Set(pm.filter((x) => x.model_id === modelId).map((x) => x.plan_code));
    const p = plans.filter((x) => codes.has(x.code)).sort((a, b) => Number(a.price_monthly) - Number(b.price_monthly))[0];
    return (p?.code as PlanCode) ?? null;
  }

  async canUseModel(user: AuthUser, model: ModelRow) {
    if (!model.is_active || !model.provider_active) return { allowed: false, required_plan: null };
    if (isAdmin(user)) return { allowed: true, required_plan: null };
    const { plan } = await this.effectivePlan(user);
    const pm = await this.ctx.repos.plans.modelsForPlan(plan.id);
    if (pm.some((x) => x.model_id === model.id && x.enabled)) return { allowed: true, required_plan: null };
    return { allowed: false, required_plan: await this.requiredPlanFor(model.id) };
  }

  async visibleVisibilities(user: AuthUser): Promise<Visibility[]> {
    const v: Visibility[] = ["public"];
    const { plan } = await this.effectivePlan(user);
    if (plan.allow_premium_knowledge) v.push("premium");
    if (isAdmin(user)) v.push("premium", "admin");
    return [...new Set(v)];
  }

  async canUseKnowledge(user: AuthUser, visibility: Visibility, kbOrganizationId: string | null) {
    if (isAdmin(user)) return true;
    if (visibility === "admin") return false;
    if (visibility === "private") return !!kbOrganizationId && user.org_ids.includes(kbOrganizationId);
    if (visibility === "premium") return (await this.effectivePlan(user)).plan.allow_premium_knowledge;
    return true;
  }

  async canUploadFile(user: AuthUser) {
    const { plan } = await this.effectivePlan(user);
    if (!plan.allow_file_upload && !isAdmin(user)) return { allowed: false, reason: "File upload is available on Plus and above.", required_plan: await this.cheapestPlanWhere((p) => p.allow_file_upload) };
    const used = await this.ctx.repos.uploads.countToday(user.id);
    if (!isAdmin(user) && plan.max_upload_files_per_day > 0 && used >= plan.max_upload_files_per_day) return { allowed: false, reason: `Daily upload limit reached (${plan.max_upload_files_per_day} files).`, required_plan: null };
    return { allowed: true };
  }

  async canUseAdvancedMode(user: AuthUser, mode: ModeRow) {
    if (!mode.is_advanced || isAdmin(user)) return { allowed: true, required_plan: null };
    const { plan } = await this.effectivePlan(user);
    return plan.allow_advanced_modes ? { allowed: true, required_plan: null } : { allowed: false, required_plan: await this.cheapestPlanWhere((p) => p.allow_advanced_modes) };
  }

  private async cheapestPlanWhere(pred: (p: PlanRow) => boolean): Promise<PlanCode | null> {
    const p = (await this.ctx.repos.plans.listActive()).filter(pred).sort((a, b) => Number(a.price_monthly) - Number(b.price_monthly))[0];
    return (p?.code as PlanCode) ?? null;
  }

  async assertMessageQuota(user: AuthUser) {
    if (isAdmin(user)) return;
    const { plan } = await this.effectivePlan(user);
    if (plan.message_limit_daily === null) return;
    const used = await this.ctx.repos.usage.countTodayForUser(user.id, "chat");
    if (used >= plan.message_limit_daily) throw Errors.quota(`You have used today's ${plan.message_limit_daily} messages on the ${plan.name} plan. Upgrade for higher limits.`, { feature: "messages", required_plan: await this.cheapestPlanWhere((p) => p.message_limit_daily === null || p.message_limit_daily > (plan.message_limit_daily ?? 0)) });
  }

  async knowledgeSearchAllowed(user: AuthUser) {
    if (isAdmin(user)) return true;
    const { plan } = await this.effectivePlan(user);
    if (plan.knowledge_search_limit_daily === null) return true;
    if (plan.knowledge_search_limit_daily === 0) return false;
    return (await this.ctx.repos.usage.countTodayForUser(user.id, "knowledge_search")) < plan.knowledge_search_limit_daily;
  }

  async assertConversationQuota(user: AuthUser) {
    if (isAdmin(user)) return;
    const { plan } = await this.effectivePlan(user);
    if (plan.max_conversations === null) return;
    if ((await this.ctx.repos.conversations.countForUser(user.id)) >= plan.max_conversations) throw Errors.quota(`The ${plan.name} plan allows ${plan.max_conversations} conversations. Delete an old chat or upgrade.`, { feature: "conversations" });
  }

  async entitlements(user: AuthUser): Promise<EntitlementsDTO> {
    const { plan, source } = await this.effectivePlan(user);
    const [msgs, ks] = await Promise.all([this.ctx.repos.usage.countTodayForUser(user.id, "chat"), this.ctx.repos.usage.countTodayForUser(user.id, "knowledge_search")]);
    const admin = isAdmin(user);
    return {
      plan: toPlanDTO(plan), source, messages_used_today: msgs, messages_remaining_today: admin || plan.message_limit_daily === null ? null : Math.max(0, plan.message_limit_daily - msgs),
      knowledge_searches_used_today: ks, knowledge_searches_remaining_today: admin || plan.knowledge_search_limit_daily === null ? null : Math.max(0, plan.knowledge_search_limit_daily - ks),
      can_upload_files: admin || plan.allow_file_upload, can_use_advanced_modes: admin || plan.allow_advanced_modes, can_use_premium_knowledge: admin || plan.allow_premium_knowledge, can_use_api: admin || plan.allow_api_access,
      context_window_tokens: plan.context_window_tokens,
    };
  }
}

export const entitlements = (ctx: AppContext): IEntitlementService => new EntitlementService(ctx);
