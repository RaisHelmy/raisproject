// Thin localStorage-backed store with change notification, so favorites /
// recents / theme stay in sync across all mounted components.

import type { CopiedItem, FavoriteItem, FavoriteKind, MyTemplate, RecentItem } from "../types";

const PREFIX = "devstart-atlas:";

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  listeners.forEach((fn) => fn());
}

// In-memory cache so getters return stable references between writes —
// required by useSyncExternalStore, which compares snapshots by identity.
const cache = new Map<string, unknown>();

function read<T>(key: string, fallback: T): T {
  if (cache.has(key)) return cache.get(key) as T;
  let value = fallback;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw) value = JSON.parse(raw) as T;
  } catch {
    // unreadable — use fallback
  }
  cache.set(key, value);
  return value;
}

function write<T>(key: string, value: T) {
  cache.set(key, value);
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // storage full or unavailable — degrade to in-memory only
  }
  notify();
}

// ----- Theme -----

export type Theme = "light" | "dark";

export function getTheme(): Theme {
  const stored = read<Theme | null>("theme", null);
  if (stored) return stored;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function setTheme(theme: Theme) {
  document.documentElement.setAttribute("data-bs-theme", theme);
  write("theme", theme);
}

// ----- Favorites -----

export function getFavorites(): FavoriteItem[] {
  return read<FavoriteItem[]>("favorites", []);
}

export function isFavorite(kind: FavoriteKind, id: string): boolean {
  return getFavorites().some((f) => f.kind === kind && f.id === id);
}

export function toggleFavorite(kind: FavoriteKind, id: string, title: string) {
  const favs = getFavorites();
  const exists = favs.some((f) => f.kind === kind && f.id === id);
  const next = exists
    ? favs.filter((f) => !(f.kind === kind && f.id === id))
    : [{ kind, id, title, addedAt: Date.now() }, ...favs];
  write("favorites", next);
}

// ----- Recently viewed -----

const MAX_RECENT = 30;

export function getRecent(): RecentItem[] {
  return read<RecentItem[]>("recent", []);
}

export function trackView(kind: string, id: string, title: string, path: string) {
  const items = getRecent().filter((r) => !(r.kind === kind && r.id === id));
  items.unshift({ kind, id, title, path, at: Date.now() });
  write("recent", items.slice(0, MAX_RECENT));
}

// ----- Recently copied -----

export function getCopied(): CopiedItem[] {
  return read<CopiedItem[]>("copied", []);
}

export function trackCopy(label: string, code: string) {
  const items = getCopied().filter((c) => c.code !== code);
  items.unshift({ label, code, at: Date.now() });
  write("copied", items.slice(0, MAX_RECENT));
}

// ----- My Templates -----

export function getMyTemplates(): MyTemplate[] {
  return read<MyTemplate[]>("my-templates", []);
}

export function saveMyTemplate(t: MyTemplate) {
  const items = getMyTemplates().filter((x) => x.id !== t.id);
  items.unshift(t);
  write("my-templates", items);
}

export function deleteMyTemplate(id: string) {
  write(
    "my-templates",
    getMyTemplates().filter((x) => x.id !== id),
  );
}
