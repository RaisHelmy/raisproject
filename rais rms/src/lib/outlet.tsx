import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type { Outlet } from "../../shared/types";
import { useAuth } from "./auth";

interface OutletState {
  outlets: Outlet[];
  outletId: string | null;
  setOutletId: (id: string) => void;
  isLoading: boolean;
}

const OutletContext = createContext<OutletState | null>(null);

export function OutletProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["outlets"],
    queryFn: () => api.get<Outlet[]>("/api/outlets"),
    enabled: !!session,
  });
  const [outletId, setOutletId] = useState<string | null>(null);

  const outlets = useMemo(() => data ?? [], [data]);

  useEffect(() => {
    if (!outletId && outlets.length > 0 && outlets[0]) {
      setOutletId(outlets[0].id);
    }
  }, [outlets, outletId]);

  return (
    <OutletContext.Provider value={{ outlets, outletId, setOutletId, isLoading }}>
      {children}
    </OutletContext.Provider>
  );
}

export function useOutlet(): OutletState {
  const ctx = useContext(OutletContext);
  if (!ctx) throw new Error("useOutlet must be used within OutletProvider");
  return ctx;
}
