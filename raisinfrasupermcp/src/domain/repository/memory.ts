import type { DataStore, Repo } from "./store";
import { STORE_COLLECTIONS, matchesFilter } from "./store";

export class MemoryRepo<E extends { id: string }> implements Repo<E> {
  private map = new Map<string, E>();
  constructor(private onChange?: () => void) {}
  async get(id: string) { return this.map.get(id); }
  async list(filter?: Partial<E> | ((e: E) => boolean)) { return [...this.map.values()].filter((e) => matchesFilter(e, filter)); }
  async put(entity: E) { this.map.set(entity.id, structuredClone(entity)); this.onChange?.(); return entity; }
  async putMany(entities: E[]) { for (const e of entities) this.map.set(e.id, structuredClone(e)); this.onChange?.(); }
  async delete(id: string) { this.map.delete(id); this.onChange?.(); }
  async count(filter?: Partial<E>) { return (await this.list(filter)).length; }
  toJSON() { return [...this.map.values()]; }
  load(items: E[]) { this.map = new Map(items.map((i) => [i.id, i])); }
  clear() { this.map.clear(); }
}

export type MemoryStore = DataStore & { snapshot(): Record<string, unknown[]>; restore(data: Record<string, unknown[]>): void; reset(): void };

export function createMemoryStore(onChange?: () => void): MemoryStore {
  const store = {} as Record<string, MemoryRepo<{ id: string }>>;
  for (const name of STORE_COLLECTIONS) store[name] = new MemoryRepo(onChange);
  const api = store as unknown as MemoryStore;
  api.snapshot = () => Object.fromEntries(STORE_COLLECTIONS.map((n) => [n, store[n].toJSON()]));
  api.restore = (data) => { for (const n of STORE_COLLECTIONS) if (data[n]) store[n].load(data[n] as { id: string }[]); };
  api.reset = () => { for (const n of STORE_COLLECTIONS) store[n].clear(); };
  return api;
}
