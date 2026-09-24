import { useSyncExternalStore } from "react";
import { subscribe } from "../services/storage";

/** Re-render when any storage-backed state changes. */
export function useStore<T>(selector: () => T): T {
  return useSyncExternalStore(subscribe, selector);
}
