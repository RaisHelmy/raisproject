import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api } from "../lib/api";
import { useAuth } from "../AuthContext";
import { GuidanceState, initialGuidance } from "./guidance";

/**
 * Journey state lives server-side (D1, per user) so setup progress, feature
 * unlocks, tour history and saved wizard steps follow the user across
 * devices. Writes are debounced; the UI updates optimistically.
 */

interface GuidanceApi {
  state: GuidanceState;
  ready: boolean;
  update: (patch: Partial<GuidanceState>) => void;
  markTourDone: (tourId: string) => void;
  toggleGroup: (group: string) => void;
  resetAll: () => void;
}

const GuidanceContext = createContext<GuidanceApi | null>(null);

export function GuidanceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<GuidanceState>(initialGuidance);
  const [ready, setReady] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // (Re)load whenever the signed-in user changes; reset on logout.
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setState(initialGuidance);
    if (!user) {
      setReady(false);
      return;
    }
    let cancelled = false;
    setReady(false);
    api
      .get<{ data: Partial<GuidanceState> | null }>("/guidance")
      .then(({ data }) => {
        if (!cancelled && data) setState({ ...initialGuidance, ...data });
      })
      .catch(() => {
        /* first visit or transient error — start from defaults */
      })
      .finally(() => !cancelled && setReady(true));
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const persist = useCallback((next: GuidanceState) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      api.put("/guidance", next).catch(() => {
        /* retried on next change; optimistic state is kept */
      });
    }, 400);
  }, []);

  const update = useCallback(
    (patch: Partial<GuidanceState>) => {
      setState((prev) => {
        const next = { ...prev, ...patch };
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const markTourDone = useCallback(
    (tourId: string) => {
      setState((prev) => {
        if (prev.toursDone.includes(tourId)) return prev;
        const next = { ...prev, toursDone: [...prev.toursDone, tourId] };
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const toggleGroup = useCallback(
    (group: string) => {
      setState((prev) => {
        const open = prev.expandedGroups.includes(group);
        const next = {
          ...prev,
          expandedGroups: open
            ? prev.expandedGroups.filter((g) => g !== group)
            : [...prev.expandedGroups, group],
        };
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const resetAll = useCallback(() => {
    setState(initialGuidance);
    persist(initialGuidance);
  }, [persist]);

  const apiValue = useMemo(
    () => ({ state, ready, update, markTourDone, toggleGroup, resetAll }),
    [state, ready, update, markTourDone, toggleGroup, resetAll]
  );

  return <GuidanceContext.Provider value={apiValue}>{children}</GuidanceContext.Provider>;
}

export function useGuidance(): GuidanceApi {
  const ctx = useContext(GuidanceContext);
  if (!ctx) throw new Error("useGuidance must be used inside <GuidanceProvider>");
  return ctx;
}
