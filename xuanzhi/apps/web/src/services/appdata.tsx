import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ConversationDTO, ModeDTO, ModelDTO } from "@xuanzhi/shared-types";
import { api } from "./api";
import { useAuth } from "./auth";

interface AppData {
  models: ModelDTO[]; modes: ModeDTO[]; conversations: ConversationDTO[]; loadingConversations: boolean;
  refreshCatalog: () => Promise<void>; refreshConversations: (search?: string, archived?: boolean) => Promise<void>;
  upsertConversation: (c: ConversationDTO) => void; removeConversation: (id: string) => void;
}
const Ctx = createContext<AppData | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [models, setModels] = useState<ModelDTO[]>([]); const [modes, setModes] = useState<ModeDTO[]>([]);
  const [conversations, setConversations] = useState<ConversationDTO[]>([]); const [loadingConversations, setLoading] = useState(true);
  const refreshCatalog = useCallback(async () => { const [m, mo] = await Promise.all([api<ModelDTO[]>("/models"), api<ModeDTO[]>("/modes")]); setModels(m.data); setModes(mo.data); }, []);
  const refreshConversations = useCallback(async (search?: string, archived?: boolean) => { setLoading(true); try { const r = await api<{ items: ConversationDTO[] }>("/conversations", { query: { search, archived: archived ? "true" : undefined, page_size: 100 } }); setConversations(r.data.items); } finally { setLoading(false); } }, []);
  useEffect(() => { if (user) { void refreshCatalog(); void refreshConversations(); } }, [user, refreshCatalog, refreshConversations]);
  const upsertConversation = useCallback((c: ConversationDTO) => setConversations((list) => { const i = list.findIndex((x) => x.id === c.id); if (i < 0) return [c, ...list]; const copy = [...list]; copy[i] = c; return copy.sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned) || b.updated_at.localeCompare(a.updated_at)); }), []);
  const removeConversation = useCallback((id: string) => setConversations((l) => l.filter((x) => x.id !== id)), []);
  const value = useMemo(() => ({ models, modes, conversations, loadingConversations, refreshCatalog, refreshConversations, upsertConversation, removeConversation }), [models, modes, conversations, loadingConversations, refreshCatalog, refreshConversations, upsertConversation, removeConversation]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useAppData(): AppData { const v = useContext(Ctx); if (!v) throw new Error("useAppData outside provider"); return v; }
