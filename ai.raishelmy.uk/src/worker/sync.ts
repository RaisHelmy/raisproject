import type { Env } from "./env";
import { ACCOUNT_ID } from "./env";
import { getSetting, setSetting } from "./db";

interface CfLog { id: string; created_at: string; cost: number; tokens_in: number; tokens_out: number; model: string; provider: string; metadata: Record<string, unknown> | null; success: boolean }

/**
 * Pulls recent AI Gateway logs and copies Cloudflare's own cost figure onto our usage rows
 * (matched via metadata.request_id). Our estimate stays as cost_usd; cf_cost_usd is informational
 * and shown side by side in the portal.
 */
export async function syncCosts(env: Env, opts: { force?: boolean } = {}): Promise<{ scanned: number; matched: number; skipped?: string }> {
  if (!env.CLOUDFLARE_API_TOKEN) return { scanned: 0, matched: 0, skipped: "CLOUDFLARE_API_TOKEN secret not set" };
  const last = Number((await getSetting(env, "last_cost_sync")) ?? 0);
  const nowS = Math.floor(Date.now() / 1000);
  if (!opts.force && nowS - last < 300) return { scanned: 0, matched: 0, skipped: "synced less than 5 minutes ago" };

  // Look back 26h so late-arriving costs are still caught; matching is idempotent.
  const since = new Date((last ? Math.max(last - 26 * 3600, nowS - 7 * 86400) : nowS - 7 * 86400) * 1000).toISOString();
  const filters = encodeURIComponent(JSON.stringify([{ key: "created_at", operator: "gte", value: [since] }]));
  let page = 1, scanned = 0, matched = 0;
  const stmts: D1PreparedStatement[] = [];
  while (page <= 20) {
    const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai-gateway/gateways/${env.AI_GATEWAY_ID}/logs?per_page=100&page=${page}&order_by=created_at&order_by_direction=desc&filters=${filters}`, {
      headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` },
    });
    if (!r.ok) throw new Error(`AI Gateway logs API HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const data = (await r.json()) as { result: CfLog[]; result_info?: { count: number; total_count: number } };
    const logs = data.result ?? [];
    for (const log of logs) {
      scanned++;
      const rid = log.metadata?.request_id;
      if (typeof rid !== "string" || !rid.startsWith("req_")) continue;
      matched++;
      stmts.push(env.DB.prepare("UPDATE usage SET cf_cost_usd = ? WHERE id = ?").bind(Number(log.cost) || 0, rid));
    }
    if (logs.length < 100) break;
    page++;
  }
  for (let i = 0; i < stmts.length; i += 100) await env.DB.batch(stmts.slice(i, i + 100));
  await setSetting(env, "last_cost_sync", String(nowS));
  return { scanned, matched };
}
