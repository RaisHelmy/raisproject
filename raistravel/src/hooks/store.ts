import { useSyncExternalStore } from 'react'

// Minimal external store with optional localStorage persistence.
export function createStore<T>(initial: T, persistKey?: string) {
  let state = initial
  if (persistKey) {
    try {
      const raw = localStorage.getItem(persistKey)
      if (raw) state = { ...initial, ...JSON.parse(raw) }
    } catch { /* corrupted storage — fall back to defaults */ }
  }
  const listeners = new Set<() => void>()

  function set(update: Partial<T> | ((prev: T) => T)) {
    state = typeof update === 'function' ? (update as (prev: T) => T)(state) : { ...state, ...update }
    if (persistKey) {
      try { localStorage.setItem(persistKey, JSON.stringify(state)) } catch { /* storage full/blocked */ }
    }
    listeners.forEach((l) => l())
  }

  function get(): T { return state }

  function subscribe(l: () => void): () => void {
    listeners.add(l)
    return () => listeners.delete(l)
  }

  function useStore(): T {
    return useSyncExternalStore(subscribe, get, get)
  }

  return { set, get, subscribe, useStore }
}
