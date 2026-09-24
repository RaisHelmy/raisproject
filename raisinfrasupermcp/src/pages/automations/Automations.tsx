import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp, errorMessage } from "@/app/providers";
import { useAsync } from "@/hooks/useAsync";
import { PageHeader, Panel, Loading, ErrorState, EmptyState } from "@/components/Panels";
import { StatusBadge } from "@/components/StatusBadge";
import { Drawer } from "@/components/Dialogs";
import { myr, timeAgo } from "@/utils/format";
import { marketplaceSplit } from "@/domain/billing";
import type { MarketplaceItem } from "@/domain/types";

export function Installed() {
  const { api, toast, can } = useApp();
  const nav = useNavigate();
  const { data, loading, error, reload } = useAsync(() => api.platform.automations(), []);
  if (loading) return <Loading />; if (error) return <ErrorState message={error} />;
  const run = async (defId: string, name: string) => { try { const envs = await api.platform.environments(); const r = await api.tasks.create({ definitionId: defId, inputs: defId === "backup-database" ? { environmentId: envs[0]?.id } : defId === "create-dotnet-project" ? { name: "new-service", architecture: "Clean Architecture" } : defId === "diagnose-incident" ? { incidentId: "manual" } : defId === "environment-bootstrap" ? { serverId: "" } : {}, environmentId: envs[0]?.id, name, executionMode: "AUTOMATION" }); toast(`${r.task.key} queued`, "success"); nav(`/tasks/${r.task.id}`); } catch (e) { toast(errorMessage(e), "error"); } };
  return <div><PageHeader title="Installed automations" subtitle="Automations wrap versioned tasks with triggers (manual, schedule, webhook, agent events)." />
    <div className="panel">{(data ?? []).length === 0 ? <EmptyState icon="bi-lightning-charge" title="No automations installed" body="Browse the marketplace for .NET Project Factory, Docker Recovery, PostgreSQL Backup and more." /> : (data ?? []).map((a) => <div key={a.id} className="list-row"><i className="bi bi-lightning-charge text-secondary" /><div className="flex-grow-1"><div className="title">{a.name} <span className="text-secondary fw-normal small">v{a.version}</span></div><div className="meta">{a.description} · trigger {a.trigger}{a.schedule ? ` (${a.schedule})` : ""} · {a.runs} runs · last {a.lastRunAt ? timeAgo(a.lastRunAt) : "never"}</div></div>{a.lastResult && <StatusBadge status={a.lastResult} />}<div className="form-check form-switch m-0"><input className="form-check-input" type="checkbox" checked={a.enabled} disabled={!can("automation.execute")} onChange={async (e) => { try { await api.platform.toggleAutomation(a.id, e.target.checked); reload(true); } catch (err) { toast(errorMessage(err), "error"); } }} aria-label={`Enable ${a.name}`} /></div>{can("automation.execute") && <button className="btn btn-sm btn-outline-secondary" onClick={() => run(a.taskDefinitionId, a.name)}>Run</button>}</div>)}</div></div>;
}

export function Marketplace() {
  const { api, toast, can } = useApp();
  const { data, loading, error, reload } = useAsync(() => api.platform.marketplace(), []);
  const [sel, setSel] = useState<MarketplaceItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [cat, setCat] = useState("All");
  if (loading) return <Loading />; if (error) return <ErrorState message={error} />;
  const cats = ["All", ...new Set((data ?? []).map((m) => m.category))];
  const install = async (m: MarketplaceItem) => { setBusy(true); try { await api.platform.installMarketplaceItem(m.id); toast(`${m.name} installed${m.pricing !== "FREE" ? " (payment mocked in Phase 1)" : ""}`, "success"); setSel(null); reload(true); } catch (e) { toast(errorMessage(e), "error"); } finally { setBusy(false); } };
  return <div><PageHeader title="Automation Marketplace" subtitle="Free, paid, subscription and enterprise automations from Super MCP and publishers. Revenue share is configurable (currently 70/30)." />
    <div className="tabs-smcp">{cats.map((c) => <button key={c} className={cat === c ? "active" : ""} onClick={() => setCat(c)}>{c}</button>)}</div>
    <div className="row g-3">{(data ?? []).filter((m) => cat === "All" || m.category === cat).map((m) => <div className="col-md-6 col-xl-4" key={m.id}><div className="panel h-100" role="button" onClick={() => setSel(m)}><div className="panel-body"><div className="d-flex justify-content-between align-items-start gap-2"><div><div className="fw-semibold">{m.name}</div><div className="small text-secondary">by {m.publisher} · v{m.version}</div></div><span className="fw-semibold">{m.pricing === "FREE" ? "Free" : m.pricing === "ENTERPRISE" ? "Enterprise" : `${myr(m.priceMyr)}${m.pricing === "SUBSCRIPTION" ? "/mo" : ""}`}</span></div><p className="small mt-2 mb-2">{m.description}</p><div className="d-flex gap-1 flex-wrap align-items-center small"><StatusBadge status={m.risk} /><span className="status tone-neutral">{m.category}</span><span className="text-secondary ms-auto">★ {m.rating.toFixed(1)} · {m.installs.toLocaleString()} installs</span></div>{m.installed && <div className="mt-2"><StatusBadge status="COMPLETED" label="Installed" /></div>}</div></div></div>)}</div>
    <Drawer open={!!sel} onClose={() => setSel(null)} title={sel?.name ?? ""} footer={sel && <div className="d-flex w-100 justify-content-between align-items-center"><span className="small text-secondary">{sel.pricing !== "FREE" && sel.pricing !== "ENTERPRISE" && sel.priceMyr ? `Publisher ${myr(marketplaceSplit(sel.priceMyr).publisher, 2)} · Super MCP ${myr(marketplaceSplit(sel.priceMyr).platform, 2)}` : ""}</span>{sel.installed ? <StatusBadge status="COMPLETED" label="Installed" /> : <button className="btn btn-primary" disabled={busy || !can("automation.create") || sel.pricing === "ENTERPRISE"} onClick={() => install(sel)}>{busy && <i className="bi bi-arrow-repeat spin me-1" />}{sel.pricing === "ENTERPRISE" ? "Contact sales" : sel.pricing === "FREE" ? "Install" : `Buy & install · ${myr(sel.priceMyr)}`}</button>}</div>}>
      {sel && <div><p>{sel.description}</p><dl className="kv"><dt>Publisher</dt><dd>{sel.publisher}</dd><dt>Version</dt><dd>{sel.version}</dd><dt>Risk</dt><dd><StatusBadge status={sel.risk} /></dd><dt>Approvals</dt><dd>{sel.approvalRequirements}</dd><dt>Integrations</dt><dd>{sel.requiredIntegrations.join(", ") || "none"}</dd><dt>Permissions</dt><dd className="mono small">{sel.requiredPermissions.join(", ")}</dd><dt>Triggers</dt><dd>{sel.triggers.join(", ")}</dd><dt>Tasks</dt><dd className="mono small">{sel.tasks.join(", ")}</dd><dt>Reviews</dt><dd>★ {sel.rating.toFixed(1)} from {Math.round(sel.installs / 9)} reviews</dd></dl>{sel.pricing !== "FREE" && <div className="alert alert-warning py-2 small">Payment processing is mocked in this build: an invoice line is recorded but no card is charged.</div>}</div>}
    </Drawer></div>;
}

export function Schedules() {
  const { api } = useApp();
  const { data, loading, error } = useAsync(async () => ({ automations: (await api.platform.automations()).filter((a) => a.schedule), tasks: await api.tasks.list({ status: "scheduled" }) }), []);
  if (loading) return <Loading />; if (error || !data) return <ErrorState message={error} />;
  return <div><PageHeader title="Schedules" subtitle="Cron-triggered automations and queued scheduled tasks." /><div className="row g-3"><div className="col-lg-6"><Panel title="Cron schedules">{data.automations.length === 0 ? <span className="text-secondary small">No scheduled automations.</span> : data.automations.map((a) => <div key={a.id} className="d-flex justify-content-between py-2 border-bottom"><span>{a.name}</span><code>{a.schedule}</code></div>)}</Panel></div><div className="col-lg-6"><Panel title="Queued scheduled tasks">{data.tasks.length === 0 ? <span className="text-secondary small">Nothing queued.</span> : data.tasks.map((t) => <div key={t.id} className="d-flex justify-content-between py-2 border-bottom"><span>{t.key} {t.name}</span><span className="small text-secondary">{timeAgo(t.scheduledFor)}</span></div>)}</Panel></div></div></div>;
}
