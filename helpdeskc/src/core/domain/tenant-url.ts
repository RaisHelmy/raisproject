import { PLATFORM_ROOT_DOMAIN } from "./config";

export interface TenantHostInfo {
  slug: string;
  /** A verified, primary custom hostname, if the tenant has one. */
  primaryHostname: string | null;
}

/**
 * The single place primary-hostname logic lives (CLAUDE.md §6.5). Never
 * build a tenant URL by string-concatenating a slug anywhere else.
 */
export function tenantUrl(tenant: TenantHostInfo, path: string): string {
  const host = tenant.primaryHostname ?? `${tenant.slug}.${PLATFORM_ROOT_DOMAIN}`;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `https://${host}${normalizedPath}`;
}
