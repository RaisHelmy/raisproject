import type { AppContext, AuthUser } from "./context";
import { entitlements } from "./entitlements";

export interface SearchHit { type: "conversation" | "message" | "document" | "topic" | "mode"; id: string; title: string; subtitle?: string; href: string }

/** Global search (⌘K): conversations, messages, knowledge documents, topics and expert modes. */
export async function globalSearch(ctx: AppContext, user: AuthUser, term: string): Promise<SearchHit[]> {
  const t = term.trim(); if (t.length < 1) return [];
  const vis = await entitlements(ctx).visibleVisibilities(user);
  const [convs, msgs, docs, cats, modes] = await Promise.all([
    ctx.repos.conversations.list(user.id, { search: t, offset: 0, limit: 6 }),
    ctx.repos.messages.search(user.id, t, 6),
    ctx.repos.documents.searchTitles(t, 6, { visibilities: vis, orgIds: user.org_ids }),
    ctx.repos.categories.list(), ctx.repos.modes.listActive(),
  ]);
  const q = t.toLowerCase();
  const hits: SearchHit[] = [];
  for (const c of convs) hits.push({ type: "conversation", id: c.id, title: c.title, subtitle: c.last_message_at ? new Date(c.last_message_at).toLocaleDateString() : undefined, href: `/app/chat/${c.id}` });
  for (const m of msgs) if (!convs.some((c) => c.id === m.conversation_id)) hits.push({ type: "message", id: m.id, title: m.title, subtitle: m.content, href: `/app/chat/${m.conversation_id}` });
  for (const d of docs) hits.push({ type: "document", id: d.id, title: d.title, subtitle: d.author ?? d.category_name ?? undefined, href: `/app/knowledge/${d.id}` });
  for (const c of cats) if ([c.name, c.name_zh, c.name_zh_tw, c.code].some((x) => x.toLowerCase().includes(q))) hits.push({ type: "topic", id: c.id, title: `${c.name_zh} · ${c.name}`, href: `/app/explore#${c.code}` });
  for (const m of modes) if ([m.name, m.name_zh, m.name_zh_tw].some((x) => x.toLowerCase().includes(q))) hits.push({ type: "mode", id: m.id, title: `${m.name_zh} · ${m.name}`, subtitle: m.description, href: `/app/chat?mode=${m.id}` });
  return hits.slice(0, 20);
}
