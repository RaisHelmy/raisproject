import type { Queryable } from "../db/client";
import type { AuditRow, OrganizationRow, PlanRow, SubscriptionRow } from "./types";

export class OrganizationsRepo {
  constructor(private readonly db: Queryable) {}
  findById(id: string) { return this.db.one<OrganizationRow>(`SELECT * FROM organizations WHERE id = $1 AND deleted_at IS NULL`, [id]); }
  listForUser(userId: string) {
    return this.db.query<OrganizationRow & { role: string; plan_code: string | null; member_count: number }>(
      `SELECT o.*, m.role, p.code AS plan_code, (SELECT count(*)::int FROM organization_members x WHERE x.organization_id = o.id) AS member_count
       FROM organizations o JOIN organization_members m ON m.organization_id = o.id LEFT JOIN plans p ON p.id = o.plan_id WHERE m.user_id = $1 AND o.deleted_at IS NULL ORDER BY o.name`, [userId]);
  }
  listAll(q: { search?: string; offset: number; limit: number }) {
    const p: unknown[] = []; let where = "o.deleted_at IS NULL";
    if (q.search) { p.push(`%${q.search}%`); where += ` AND (o.name ILIKE $1 OR o.slug ILIKE $1)`; }
    p.push(q.limit, q.offset);
    return this.db.query<OrganizationRow & { plan_code: string | null; member_count: number; owner_email: string; total: number }>(
      `SELECT o.*, p.code AS plan_code, u.email AS owner_email, (SELECT count(*)::int FROM organization_members x WHERE x.organization_id = o.id) AS member_count, count(*) OVER()::int AS total
       FROM organizations o LEFT JOIN plans p ON p.id = o.plan_id JOIN users u ON u.id = o.owner_user_id WHERE ${where} ORDER BY o.created_at DESC LIMIT $${p.length - 1} OFFSET $${p.length}`, p);
  }
  create(o: { name: string; slug: string; owner_user_id: string; plan_id: string | null }) {
    return this.db.one<OrganizationRow>(`INSERT INTO organizations (name, slug, owner_user_id, plan_id) VALUES ($1,$2,$3,$4) RETURNING *`, [o.name, o.slug, o.owner_user_id, o.plan_id]);
  }
  update(id: string, patch: Record<string, unknown>) {
    const keys = Object.keys(patch).filter((k) => patch[k] !== undefined && k !== "id");
    if (!keys.length) return this.findById(id);
    return this.db.one<OrganizationRow>(`UPDATE organizations SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(", ")}, updated_at = now() WHERE id = $1 RETURNING *`, [id, ...keys.map((k) => patch[k])]);
  }
  addMember(orgId: string, userId: string, role: string) { return this.db.query(`INSERT INTO organization_members (organization_id, user_id, role) VALUES ($1,$2,$3) ON CONFLICT (organization_id, user_id) DO UPDATE SET role = excluded.role`, [orgId, userId, role]); }
  removeMember(orgId: string, userId: string) { return this.db.query(`DELETE FROM organization_members WHERE organization_id = $1 AND user_id = $2`, [orgId, userId]); }
  members(orgId: string) { return this.db.query<{ user_id: string; role: string; email: string; name: string; created_at: Date }>(`SELECT m.user_id, m.role, u.email, u.name, m.created_at FROM organization_members m JOIN users u ON u.id = m.user_id WHERE m.organization_id = $1 ORDER BY m.created_at`, [orgId]); }
  membership(orgId: string, userId: string) { return this.db.one<{ role: string }>(`SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2`, [orgId, userId]); }
  orgIdsForUser(userId: string) { return this.db.query<{ organization_id: string }>(`SELECT organization_id FROM organization_members WHERE user_id = $1`, [userId]); }
  softDelete(id: string) { return this.db.query(`UPDATE organizations SET deleted_at = now() WHERE id = $1`, [id]); }
}

export class SubscriptionsRepo {
  constructor(private readonly db: Queryable) {}
  activeForUser(userId: string) { return this.db.one<SubscriptionRow & { plan: PlanRow }>(`SELECT s.*, row_to_json(p) AS plan FROM subscriptions s JOIN plans p ON p.id = s.plan_id WHERE s.user_id = $1 AND s.status IN ('active','trialing','past_due') ORDER BY p.priority DESC, s.created_at DESC LIMIT 1`, [userId]); }
  activeForOrg(orgId: string) { return this.db.one<SubscriptionRow & { plan: PlanRow }>(`SELECT s.*, row_to_json(p) AS plan FROM subscriptions s JOIN plans p ON p.id = s.plan_id WHERE s.organization_id = $1 AND s.status IN ('active','trialing','past_due') ORDER BY p.priority DESC, s.created_at DESC LIMIT 1`, [orgId]); }
  findByStripeSubscription(id: string) { return this.db.one<SubscriptionRow>(`SELECT * FROM subscriptions WHERE stripe_subscription_id = $1`, [id]); }
  findByStripeCustomer(id: string) { return this.db.one<SubscriptionRow>(`SELECT * FROM subscriptions WHERE stripe_customer_id = $1 ORDER BY created_at DESC LIMIT 1`, [id]); }
  create(s: { user_id: string | null; organization_id: string | null; plan_id: string; status: string; managed_by: string; stripe_customer_id?: string | null; stripe_subscription_id?: string | null; current_period_start?: string | null; current_period_end?: string | null }) {
    return this.db.one<SubscriptionRow>(`INSERT INTO subscriptions (user_id, organization_id, plan_id, status, managed_by, stripe_customer_id, stripe_subscription_id, current_period_start, current_period_end) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [s.user_id, s.organization_id, s.plan_id, s.status, s.managed_by, s.stripe_customer_id ?? null, s.stripe_subscription_id ?? null, s.current_period_start ?? null, s.current_period_end ?? null]);
  }
  update(id: string, patch: Record<string, unknown>) {
    const keys = Object.keys(patch).filter((k) => patch[k] !== undefined && k !== "id");
    if (!keys.length) return null;
    return this.db.one<SubscriptionRow>(`UPDATE subscriptions SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(", ")}, updated_at = now() WHERE id = $1 RETURNING *`, [id, ...keys.map((k) => patch[k])]);
  }
  cancelOthersForUser(userId: string, keepId: string) { return this.db.query(`UPDATE subscriptions SET status = 'canceled', updated_at = now() WHERE user_id = $1 AND id <> $2 AND status IN ('active','trialing','past_due','incomplete')`, [userId, keepId]); }
  cancelOthersForOrg(orgId: string, keepId: string) { return this.db.query(`UPDATE subscriptions SET status = 'canceled', updated_at = now() WHERE organization_id = $1 AND id <> $2 AND status IN ('active','trialing','past_due','incomplete')`, [orgId, keepId]); }
  async planDistribution() { return this.db.query<{ code: string; n: number }>(`SELECT p.code, count(*)::int AS n FROM subscriptions s JOIN plans p ON p.id = s.plan_id WHERE s.status IN ('active','trialing') GROUP BY p.code`); }
  async monthlyRevenue(): Promise<number> { return (await this.db.one<{ mrr: number }>(`SELECT coalesce(sum(p.price_monthly), 0)::numeric AS mrr FROM subscriptions s JOIN plans p ON p.id = s.plan_id WHERE s.status IN ('active','trialing')`))!.mrr; }
}

export class UsageRepo {
  constructor(private readonly db: Queryable) {}
  record(u: { user_id: string | null; organization_id: string | null; model_id: string | null; conversation_id: string | null; message_id: string | null; kind: string; request_tokens: number; response_tokens: number; estimated_cost: number; knowledge_base_ids?: string[] }) {
    return this.db.query(`INSERT INTO usage_records (user_id, organization_id, model_id, conversation_id, message_id, kind, request_tokens, response_tokens, total_tokens, estimated_cost, knowledge_base_ids) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [u.user_id, u.organization_id, u.model_id, u.conversation_id, u.message_id, u.kind, u.request_tokens, u.response_tokens, u.request_tokens + u.response_tokens, u.estimated_cost, JSON.stringify(u.knowledge_base_ids ?? [])]);
  }
  async countTodayForUser(userId: string, kind: string): Promise<number> { return (await this.db.one<{ n: number }>(`SELECT count(*)::int AS n FROM usage_records WHERE user_id = $1 AND kind = $2 AND created_at >= date_trunc('day', now())`, [userId, kind]))!.n; }
  async summary(since: Date, until?: Date) {
    return (await this.db.one<{ requests: number; tokens: number; request_tokens: number; response_tokens: number; estimated_cost: number }>(
      `SELECT count(*)::int AS requests, coalesce(sum(total_tokens),0)::bigint AS tokens, coalesce(sum(request_tokens),0)::bigint AS request_tokens, coalesce(sum(response_tokens),0)::bigint AS response_tokens, coalesce(sum(estimated_cost),0)::numeric AS estimated_cost
       FROM usage_records WHERE kind = 'chat' AND created_at >= $1 AND created_at < $2`, [since.toISOString(), (until ?? new Date(Date.now() + 60_000)).toISOString()]))!;
  }
  daily(days: number) {
    return this.db.query<{ day: string; requests: number; tokens: number; cost: number }>(
      `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day, count(*)::int AS requests, coalesce(sum(total_tokens),0)::bigint AS tokens, coalesce(sum(estimated_cost),0)::numeric AS cost
       FROM usage_records WHERE kind = 'chat' AND created_at >= now() - make_interval(days => $1) GROUP BY 1 ORDER BY 1`, [days]);
  }
  topModels(since: Date, limit = 8) {
    return this.db.query<{ model_id: string; name: string; requests: number; tokens: number; cost: number }>(
      `SELECT u.model_id, coalesce(m.name, 'unknown') AS name, count(*)::int AS requests, coalesce(sum(u.total_tokens),0)::bigint AS tokens, coalesce(sum(u.estimated_cost),0)::numeric AS cost
       FROM usage_records u LEFT JOIN models m ON m.id = u.model_id WHERE u.kind = 'chat' AND u.created_at >= $1 GROUP BY 1, 2 ORDER BY requests DESC LIMIT $2`, [since.toISOString(), limit]);
  }
  topUsers(since: Date, limit = 8) {
    return this.db.query<{ user_id: string; email: string; name: string; requests: number; tokens: number; cost: number }>(
      `SELECT u.user_id, x.email, x.name, count(*)::int AS requests, coalesce(sum(u.total_tokens),0)::bigint AS tokens, coalesce(sum(u.estimated_cost),0)::numeric AS cost
       FROM usage_records u JOIN users x ON x.id = u.user_id WHERE u.kind = 'chat' AND u.created_at >= $1 GROUP BY 1, 2, 3 ORDER BY requests DESC LIMIT $2`, [since.toISOString(), limit]);
  }
  topKnowledgeBases(since: Date, limit = 8) {
    return this.db.query<{ knowledge_base_id: string; name: string; searches: number }>(
      `SELECT kb_id AS knowledge_base_id, coalesce(kb.name, 'unknown') AS name, count(*)::int AS searches
       FROM (SELECT jsonb_array_elements_text(knowledge_base_ids)::uuid AS kb_id FROM usage_records WHERE kind = 'knowledge_search' AND created_at >= $1) x LEFT JOIN knowledge_bases kb ON kb.id = x.kb_id
       GROUP BY 1, 2 ORDER BY searches DESC LIMIT $2`, [since.toISOString(), limit]);
  }
  async knowledgeSearches(since: Date): Promise<number> { return (await this.db.one<{ n: number }>(`SELECT count(*)::int AS n FROM usage_records WHERE kind = 'knowledge_search' AND created_at >= $1`, [since.toISOString()]))!.n; }
  userDaily(userId: string, days: number) {
    return this.db.query<{ day: string; requests: number; tokens: number }>(`SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day, count(*)::int AS requests, coalesce(sum(total_tokens),0)::bigint AS tokens FROM usage_records WHERE user_id = $1 AND kind = 'chat' AND created_at >= now() - make_interval(days => $2) GROUP BY 1 ORDER BY 1`, [userId, days]);
  }
}

export class SettingsRepo {
  constructor(private readonly db: Queryable) {}
  async get<T>(key: string, fallback: T): Promise<T> { const r = await this.db.one<{ value: T }>(`SELECT value FROM system_settings WHERE key = $1`, [key]); return r ? r.value : fallback; }
  set(key: string, value: unknown, updatedBy: string | null) { return this.db.query(`INSERT INTO system_settings (key, value, updated_by, updated_at) VALUES ($1, $2::jsonb, $3, now()) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = now()`, [key, JSON.stringify(value), updatedBy]); }
  all() { return this.db.query<{ key: string; value: unknown; updated_at: Date }>(`SELECT key, value, updated_at FROM system_settings ORDER BY key`); }
}

export class AuditRepo {
  constructor(private readonly db: Queryable) {}
  insert(a: { actor_id: string | null; action: string; resource_type: string; resource_id: string | null; ip: string | null; result: "ok" | "error"; details: unknown }) {
    return this.db.query(`INSERT INTO audit_logs (actor_id, action, resource_type, resource_id, ip, result, details) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`, [a.actor_id, a.action, a.resource_type, a.resource_id, a.ip, a.result, JSON.stringify(a.details ?? null)]);
  }
  list(q: { action?: string; actor_id?: string; resource_type?: string; offset: number; limit: number }) {
    const p: unknown[] = []; const where: string[] = ["1=1"];
    if (q.action) { p.push(`${q.action}%`); where.push(`a.action ILIKE $${p.length}`); }
    if (q.actor_id) { p.push(q.actor_id); where.push(`a.actor_id = $${p.length}`); }
    if (q.resource_type) { p.push(q.resource_type); where.push(`a.resource_type = $${p.length}`); }
    p.push(q.limit, q.offset);
    return this.db.query<AuditRow & { total: number }>(`SELECT a.*, u.email AS actor_email, count(*) OVER()::int AS total FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id WHERE ${where.join(" AND ")} ORDER BY a.created_at DESC LIMIT $${p.length - 1} OFFSET $${p.length}`, p);
  }
}

export class AnalyticsRepo {
  constructor(private readonly db: Queryable) {}
  userGrowth(days: number) { return this.db.query<{ day: string; n: number }>(`SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day, count(*)::int AS n FROM users WHERE deleted_at IS NULL AND created_at >= now() - make_interval(days => $1) GROUP BY 1 ORDER BY 1`, [days]); }
  topicEvent(userId: string | null, categoryCode: string | null, modeCode: string | null) { return this.db.query(`INSERT INTO topic_events (user_id, category_code, mode_code) VALUES ($1,$2,$3)`, [userId, categoryCode, modeCode]); }
  popularTopics(since: Date, limit = 10) { return this.db.query<{ code: string; n: number }>(`SELECT coalesce(category_code, mode_code, 'general') AS code, count(*)::int AS n FROM topic_events WHERE created_at >= $1 GROUP BY 1 ORDER BY n DESC LIMIT $2`, [since.toISOString(), limit]); }
  async conversationsCount(): Promise<number> { return (await this.db.one<{ n: number }>(`SELECT count(*)::int AS n FROM conversations WHERE deleted_at IS NULL`))!.n; }
  async feedbackSummary() { return (await this.db.one<{ up: number; down: number }>(`SELECT count(*) FILTER (WHERE feedback = 1)::int AS up, count(*) FILTER (WHERE feedback = -1)::int AS down FROM messages WHERE role = 'assistant'`))!; }
}
