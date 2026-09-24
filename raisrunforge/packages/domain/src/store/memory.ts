import type { DemoWorld } from "@runforge/providers";
import { nowIso } from "@runforge/shared";
import type { DataStore, KeyedRepository, ListOptions, TenantRepository } from "./repository";

function matches<T>(item: T, where?: Partial<T>): boolean {
  if (!where) return true;
  for (const [k, v] of Object.entries(where)) {
    if (v === undefined) continue;
    if ((item as Record<string, unknown>)[k] !== v) return false;
  }
  return true;
}

function applyOptions<T>(items: T[], options?: ListOptions<T>): T[] {
  let out = items.filter((i) => matches(i, options?.where));
  if (options?.orderBy) {
    const key = options.orderBy;
    const dir = options.direction === "desc" ? -1 : 1;
    out = [...out].sort((a, b) => {
      const av = (a as Record<string, unknown>)[key] as string | number;
      const bv = (b as Record<string, unknown>)[key] as string | number;
      return av < bv ? -dir : av > bv ? dir : 0;
    });
  }
  if (options?.offset) out = out.slice(options.offset);
  if (options?.limit !== undefined) out = out.slice(0, options.limit);
  return out;
}

export class MemoryKeyedRepository<T extends { id: string; updatedAt?: string }> implements KeyedRepository<T> {
  constructor(private readonly items: T[]) {}
  async list(options?: ListOptions<T>): Promise<T[]> {
    return applyOptions(this.items, options);
  }
  async get(id: string): Promise<T | null> {
    return this.items.find((i) => i.id === id) ?? null;
  }
  async insert(item: T): Promise<T> {
    if (this.items.some((i) => i.id === item.id)) throw new Error(`Duplicate id ${item.id}`);
    this.items.push(item);
    return item;
  }
  async update(id: string, patch: Partial<T>): Promise<T> {
    const item = this.items.find((i) => i.id === id);
    if (!item) throw new Error(`Record ${id} not found`);
    Object.assign(item, patch, "updatedAt" in item ? { updatedAt: nowIso() } : {});
    return item;
  }
  async delete(id: string): Promise<void> {
    const idx = this.items.findIndex((i) => i.id === id);
    if (idx >= 0) this.items.splice(idx, 1);
  }
}

export class MemoryTenantRepository<T extends { id: string; organizationId: string; updatedAt?: string }>
  implements TenantRepository<T>
{
  constructor(private readonly items: T[]) {}
  async list(organizationId: string, options?: ListOptions<T>): Promise<T[]> {
    return applyOptions(
      this.items.filter((i) => i.organizationId === organizationId),
      options,
    );
  }
  async get(organizationId: string, id: string): Promise<T | null> {
    return this.items.find((i) => i.id === id && i.organizationId === organizationId) ?? null;
  }
  async insert(item: T): Promise<T> {
    if (this.items.some((i) => i.id === item.id)) throw new Error(`Duplicate id ${item.id}`);
    this.items.push(item);
    return item;
  }
  async update(organizationId: string, id: string, patch: Partial<T>): Promise<T> {
    const item = this.items.find((i) => i.id === id && i.organizationId === organizationId);
    if (!item) throw new Error(`Record ${id} not found`);
    Object.assign(item, patch, "updatedAt" in item ? { updatedAt: nowIso() } : {});
    return item;
  }
  async delete(organizationId: string, id: string): Promise<void> {
    const idx = this.items.findIndex((i) => i.id === id && i.organizationId === organizationId);
    if (idx >= 0) this.items.splice(idx, 1);
  }
  async count(organizationId: string, where?: Partial<T>): Promise<number> {
    return this.items.filter((i) => i.organizationId === organizationId && matches(i, where)).length;
  }
}

/** In-memory DataStore. In demo mode it shares arrays with the DemoWorld. */
export function createMemoryDataStore(world?: DemoWorld): DataStore {
  const w = world ?? ({} as Partial<DemoWorld>);
  const arr = <T>(items?: T[]): T[] => items ?? [];
  return {
    users: new MemoryKeyedRepository(arr(w.users)),
    organizations: new MemoryKeyedRepository(arr(w.organizations)),
    members: new MemoryTenantRepository(arr(w.members)),
    projects: new MemoryTenantRepository(arr(w.projects)),
    environments: new MemoryTenantRepository(arr(w.environments)),
    applications: new MemoryTenantRepository(arr(w.applications)),
    revisions: new MemoryTenantRepository(arr(w.revisions)),
    deployments: new MemoryTenantRepository(arr(w.deployments)),
    storage: new MemoryTenantRepository(arr(w.storage)),
    backups: new MemoryTenantRepository(arr(w.backups)),
    events: new MemoryTenantRepository(arr(w.events)),
    auditLogs: new MemoryTenantRepository(arr(w.auditLogs)),
    incidents: new MemoryTenantRepository(arr(w.incidents)),
    integrations: new MemoryTenantRepository(arr(w.integrations)),
    gitConnections: new MemoryTenantRepository(arr(w.gitConnections)),
    mcpTokens: new MemoryTenantRepository(arr(w.mcpTokens)),
    jobs: new MemoryTenantRepository(arr(w.jobs)),
  };
}
