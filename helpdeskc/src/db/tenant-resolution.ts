import { platformDb } from "./platform-client";
import { PLATFORM_ROOT_DOMAIN } from "../core/domain/config";

const KV_PREFIX = "host:";
const KV_CACHE_TTL_SECONDS = 300;

export interface ResolvedHost {
  tenantId: string;
  isSubdomain: boolean;
}

/**
 * Resolve the Host header to a tenant_id via a KV-cached map (CLAUDE.md
 * §6.1). An unknown host returns null — callers must 404, never fall back
 * to a default tenant. The result is a hint only; it is not authorisation
 * (§6.2) — the caller must still check the session's tenant matches.
 */
export async function resolveTenantForHost(kv: KVNamespace, hyperdrive: Hyperdrive, hostname: string): Promise<ResolvedHost | null> {
  const host = hostname.toLowerCase();
  const cacheKey = `${KV_PREFIX}${host}`;

  const cached = await kv.get(cacheKey, "json") as ResolvedHost | null;
  if (cached) return cached;

  const platform = platformDb(hyperdrive);
  let resolved: ResolvedHost | null = null;

  if (host.endsWith(`.${PLATFORM_ROOT_DOMAIN}`)) {
    const slug = host.slice(0, -(`.${PLATFORM_ROOT_DOMAIN}`.length));
    const tenant = await platform.tenants.getBySlug(slug);
    if (tenant) resolved = { tenantId: tenant.id, isSubdomain: true };
  } else {
    const domain = await platform.domains.findActiveByHostname(host);
    if (domain) resolved = { tenantId: domain.tenantId, isSubdomain: false };
  }

  if (resolved) {
    await kv.put(cacheKey, JSON.stringify(resolved), { expirationTtl: KV_CACHE_TTL_SECONDS });
  }
  return resolved;
}

/** Custom domain removal must purge the mapping immediately (CLAUDE.md §6.6), not wait for TTL expiry. */
export async function purgeHostCache(kv: KVNamespace, hostname: string): Promise<void> {
  await kv.delete(`${KV_PREFIX}${hostname.toLowerCase()}`);
}
