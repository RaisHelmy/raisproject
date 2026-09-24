import { useLoad, PageHeader, Stat } from "./_shared";
import { Chart } from "@/components/Charts";
import { fmtMoney, fmtNum, fmtBytes, Skeleton } from "@/components/ui";
import { useT } from "@/i18n";
import { api } from "@/services/api";
import { useEffect, useState } from "react";

interface Dash { users: number; active_today: number; requests_today: number; tokens_today: number; cost_today: number; requests_month: number; tokens_month: number; cost_month: number; knowledge: { documents: number; chunks: number; embeddings: number; storage_bytes: number; ready: number; processing: number; failed: number }; knowledge_searches_month: number; monthly_revenue: number; top_models: { name: string; requests: number; tokens: number; cost: number }[]; top_users: { email: string; name: string; requests: number; tokens: number }[]; top_knowledge_bases: { name: string; searches: number }[]; plan_distribution: { code: string; n: number }[]; feedback: { up: number; down: number } }
interface Analytics { user_growth: { day: string; n: number }[]; usage: { day: string; requests: number; tokens: number; cost: number }[]; model_usage: { name: string; requests: number }[]; popular_topics: { code: string; n: number }[]; revenue: { day: string; mrr: number }[] }

export default function DashboardPage() {
  const { t } = useT(); const { data } = useLoad<Dash>("/admin/dashboard"); const [an, setAn] = useState<Analytics | null>(null);
  useEffect(() => { api<Analytics>("/admin/analytics", { query: { days: 30 } }).then((r) => setAn(r.data)).catch(() => undefined); }, []);
  if (!data) return <div className="row g-3">{[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="col-6 col-lg-2"><Skeleton h={90} /></div>)}</div>;
  const embPct = data.knowledge.chunks ? Math.round((data.knowledge.embeddings / data.knowledge.chunks) * 100) : 0;
  return (
    <>
      <PageHeader title={t("admin.dashboard")} subtitle="玄知 AI · overview" />
      <div className="row g-3 mb-4">
        <div className="col-6 col-lg-2"><Stat k={t("admin.users")} v={fmtNum(data.users)} /></div>
        <div className="col-6 col-lg-2"><Stat k="Active today" v={fmtNum(data.active_today)} /></div>
        <div className="col-6 col-lg-2"><Stat k="AI requests (30d)" v={fmtNum(data.requests_month)} sub={`${fmtNum(data.requests_today)} today`} /></div>
        <div className="col-6 col-lg-2"><Stat k="Knowledge documents" v={fmtNum(data.knowledge.documents)} sub={`${fmtNum(data.knowledge.chunks)} chunks · ${embPct}% embedded`} /></div>
        <div className="col-6 col-lg-2"><Stat k="Monthly revenue" v={fmtMoney(data.monthly_revenue)} /></div>
        <div className="col-6 col-lg-2"><Stat k="AI cost (30d)" v={fmtMoney(data.cost_month)} sub={`${fmtMoney(data.cost_today)} today`} /></div>
      </div>
      <div className="row g-3 mb-4">
        <div className="col-lg-6"><div className="card p-3"><div className="fw-medium mb-2">User growth (30d)</div><Chart type="area" height={220} categories={an?.user_growth.map((x) => x.day.slice(5)) ?? []} series={[{ name: "Sign-ups", data: an?.user_growth.map((x) => x.n) ?? [] }]} /></div></div>
        <div className="col-lg-6"><div className="card p-3"><div className="fw-medium mb-2">AI usage (30d)</div><Chart type="column" height={220} categories={an?.usage.map((x) => x.day.slice(5)) ?? []} series={[{ name: "Requests", data: an?.usage.map((x) => x.requests) ?? [] }]} /></div></div>
        <div className="col-lg-4"><div className="card p-3"><div className="fw-medium mb-2">Model usage</div><Chart type="pie" height={220} series={[{ name: "Requests", data: (an?.model_usage ?? []).map((m) => ({ name: m.name, y: m.requests })) }]} /></div></div>
        <div className="col-lg-4"><div className="card p-3"><div className="fw-medium mb-2">Popular topics</div><Chart type="bar" height={220} categories={an?.popular_topics.map((x) => x.code) ?? []} series={[{ name: "Questions", data: an?.popular_topics.map((x) => x.n) ?? [] }]} /></div></div>
        <div className="col-lg-4"><div className="card p-3"><div className="fw-medium mb-2">Token consumption (30d)</div><Chart type="line" height={220} categories={an?.usage.map((x) => x.day.slice(5)) ?? []} series={[{ name: "Tokens", data: an?.usage.map((x) => x.tokens) ?? [] }]} /></div></div>
      </div>
      <div className="row g-3">
        <div className="col-lg-4"><div className="card p-3"><div className="fw-medium mb-2">Top models (30d)</div><table className="table table-sm fs-14 mb-0"><tbody>{data.top_models.map((m) => <tr key={m.name}><td>{m.name}</td><td className="text-end">{fmtNum(m.requests)}</td><td className="text-end text-muted">{fmtMoney(m.cost)}</td></tr>)}</tbody></table></div></div>
        <div className="col-lg-4"><div className="card p-3"><div className="fw-medium mb-2">Top users (30d)</div><table className="table table-sm fs-14 mb-0"><tbody>{data.top_users.map((u) => <tr key={u.email}><td className="text-truncate" style={{ maxWidth: 180 }}>{u.name} <span className="text-faint">{u.email}</span></td><td className="text-end">{fmtNum(u.requests)}</td></tr>)}</tbody></table></div></div>
        <div className="col-lg-4"><div className="card p-3"><div className="fw-medium mb-2">Top knowledge bases (30d)</div><table className="table table-sm fs-14 mb-0"><tbody>{data.top_knowledge_bases.map((k) => <tr key={k.name}><td>{k.name}</td><td className="text-end">{fmtNum(k.searches)}</td></tr>)}<tr><td className="text-muted">Knowledge searches</td><td className="text-end">{fmtNum(data.knowledge_searches_month)}</td></tr><tr><td className="text-muted">Storage</td><td className="text-end">{fmtBytes(data.knowledge.storage_bytes)}</td></tr><tr><td className="text-muted">Feedback 👍 / 👎</td><td className="text-end">{data.feedback.up} / {data.feedback.down}</td></tr></tbody></table></div></div>
      </div>
    </>
  );
}
