import { useState } from "react";
import { useLoad, PageHeader, Stat } from "./_shared";
import { Chart } from "@/components/Charts";
import { fmtMoney, fmtNum } from "@/components/ui";
import { useT } from "@/i18n";

interface Usage { summary: { requests: number; tokens: number; request_tokens: number; response_tokens: number; estimated_cost: number }; daily: { day: string; requests: number; tokens: number; cost: number }[]; top_models: { name: string; requests: number; tokens: number; cost: number }[]; top_users: { email: string; name: string; requests: number; tokens: number; cost: number }[]; top_knowledge_bases: { name: string; searches: number }[] }
export default function UsagePage() {
  const { t } = useT(); const [days, setDays] = useState(30); const { data } = useLoad<Usage>("/admin/usage", { days });
  return (
    <>
      <PageHeader title={t("admin.usage")} actions={<select className="form-select form-select-sm w-auto" value={days} onChange={(e) => setDays(Number(e.target.value))}><option value={1}>Today</option><option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option></select>} />
      {data && <>
        <div className="row g-3 mb-4"><div className="col-6 col-lg-3"><Stat k="Requests" v={fmtNum(data.summary.requests)} /></div><div className="col-6 col-lg-3"><Stat k="Tokens" v={data.summary.tokens > 1e6 ? `${(data.summary.tokens / 1e6).toFixed(1)}M` : fmtNum(data.summary.tokens)} sub={`${fmtNum(data.summary.request_tokens)} in · ${fmtNum(data.summary.response_tokens)} out`} /></div><div className="col-6 col-lg-3"><Stat k="Estimated AI cost" v={fmtMoney(data.summary.estimated_cost)} /></div><div className="col-6 col-lg-3"><Stat k="Knowledge searches" v={fmtNum(data.top_knowledge_bases.reduce((a, k) => a + k.searches, 0))} /></div></div>
        <div className="card p-3 mb-4"><Chart type="column" height={240} categories={data.daily.map((d) => d.day.slice(5))} series={[{ name: "Requests", data: data.daily.map((d) => d.requests) }]} /></div>
        <div className="row g-3">
          <div className="col-lg-4"><div className="card p-3"><div className="fw-medium mb-2">Top models</div><table className="table table-sm fs-13 mb-0"><thead><tr><th>Model</th><th className="text-end">Req</th><th className="text-end">Tokens</th><th className="text-end">Cost</th></tr></thead><tbody>{data.top_models.map((m) => <tr key={m.name}><td>{m.name}</td><td className="text-end">{fmtNum(m.requests)}</td><td className="text-end">{fmtNum(m.tokens)}</td><td className="text-end">{fmtMoney(m.cost)}</td></tr>)}</tbody></table></div></div>
          <div className="col-lg-4"><div className="card p-3"><div className="fw-medium mb-2">Top users</div><table className="table table-sm fs-13 mb-0"><thead><tr><th>User</th><th className="text-end">Req</th><th className="text-end">Tokens</th></tr></thead><tbody>{data.top_users.map((u) => <tr key={u.email}><td className="text-truncate" style={{ maxWidth: 160 }}>{u.email}</td><td className="text-end">{fmtNum(u.requests)}</td><td className="text-end">{fmtNum(u.tokens)}</td></tr>)}</tbody></table></div></div>
          <div className="col-lg-4"><div className="card p-3"><div className="fw-medium mb-2">Top knowledge bases</div><table className="table table-sm fs-13 mb-0"><tbody>{data.top_knowledge_bases.map((k) => <tr key={k.name}><td>{k.name}</td><td className="text-end">{fmtNum(k.searches)}</td></tr>)}</tbody></table></div></div>
        </div>
      </>}
    </>
  );
}
