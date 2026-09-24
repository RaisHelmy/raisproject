import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api";

export interface BalanceDTO {
  availableSen: number;
  reservedSen: number;
  currency: string;
  updatedAt: string;
}

export function useBalance(enabled: boolean) {
  const [balance, setBalance] = useState<BalanceDTO | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      setBalance(await api<BalanceDTO>("/balance"));
    } catch {
      setBalance(null);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { balance, loading, refresh };
}
