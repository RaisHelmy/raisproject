import { useState } from "react";
import { useLoad, PageHeader, Stat } from "./_shared";
import { Chart } from "@/components/Charts";
import { fmtNum } from "@/components/ui";
import { useT } from "@/i18n";

interface Analytics { user_growth: { day: string; n: number }[]; usage: { day: string; requests: number; tokens: number; cost: number }[]; model_usage: { name: string; requests: number }[]; popular_topics: { code: string; n: number }[]; revenue: { day: string; mrr: number }[]; conversations: number }
export default function AnalyticsPage() {
  const { t } = useT(); const [days, setDays] = useState(30); const { data } = useLoad<Analytics>("/admin/analytics", { days });
  return (
    <>
      <PageHeader title={t("admin.analytics")} actions={<select className="form-select form-select-sm w-auto" value={days} onChange={(e) => setDays(Number(e.target.value))}><option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option><option value={365}>1 year</option></select>} />
      {data && <>
        <div className="row g-3 mb-4"><div className="col-6 col-lg-3"><Stat k="New users" v={fmtNum(data.user_growth.reduce((a, x) => a + x.n, 0))} /></div><div className="col-6 col-lg-3"><Stat k="Conversations (all time)" v={fmtNum(data.conversations)} /></div><div className="col-6 col-lg-3"><Stat k="AI requests" v={fmtNum(data.usage.reduce((a, x) => a + x.requests, 0))} /></div><div className="col-6 col-lg-3"><Stat k="MRR" v={`$${fmtNum(data.revenue[data.revenue.length - 1]?.mrr ?? 0)}`} /></div></div>
        <div className="row g-3">
          <div className="col-lg-6"><div className="card p-3"><div className="fw-medium mb-2">User growth</div><Chart type="area" categories={data.user_growth.map((x) => x.day.slice(5))} series={[{ name: "Sign-ups", data: data.user_growth.map((x) => x.n) }]} /></div></div>
          <div className="col-lg-6"><div className="card p-3"><div className="fw-medium mb-2">Revenue (MRR)</div><Chart type="line" categories={data.revenue.map((x) => x.day.slice(5))} series={[{ name: "MRR", data: data.revenue.map((x) => x.mrr), color: "#3f7f6b" }]} valueSuffix=" USD" /></div></div>
          <div className="col-lg-6"><div className="card p-3"><div className="fw-medium mb-2">AI usage</div><Chart type="column" categories={data.usage.map((x) => x.day.slice(5))} series={[{ name: "Requests", data: data.usage.map((x) => x.requests) }]} /></div></div>
          <div className="col-lg-6"><div className="card p-3"><div className="fw-medium mb-2">Token consumption</div><Chart type="area" categories={data.usage.map((x) => x.day.slice(5))} series={[{ name: "Tokens", data: data.usage.map((x) => x.tokens), color: "#b8913f" }]} /></div></div>
          <div className="col-lg-6"><div className="card p-3"><div className="fw-medium mb-2">Model usage</div><Chart type="pie" series={[{ name: "Requests", data: data.model_usage.map((m) => ({ name: m.name, y: m.requests })) }]} /></div></div>
          <div className="col-lg-6"><div className="card p-3"><div className="fw-medium mb-2">Popular topics</div><Chart type="bar" categories={data.popular_topics.map((x) => x.code)} series={[{ name: "Questions", data: data.popular_topics.map((x) => x.n) }]} /></div></div>
        </div>
      </>}
    </>
  );
}
