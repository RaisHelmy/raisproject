import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useApp, errorMessage } from "@/app/providers";
import { useAsync } from "@/hooks/useAsync";
import { PageHeader, Panel, Loading, ErrorState, EmptyState, ComingSoon, MetricCard } from "@/components/Panels";
import { DataTable } from "@/components/DataTable";
import { StatusBadge, ModeBadge } from "@/components/StatusBadge";
import { Drawer } from "@/components/Dialogs";
import { timeAgo, fmtDate } from "@/utils/format";

function useInfra() { const { api } = useApp(); return useAsync(async () => ({ envs: await api.platform.environments(), servers: await api.platform.servers(), apps: await api.platform.applications(), agents: await api.platform.agents(), deployments: await api.platform.deployments(), integrations: await api.platform.integrations() }), []); }

export function Environments() {
  const { api, toast, can } = useApp();
  const { data, loading, error } = useInfra();
  const [snap, setSnap] = useState<unknown | null>(null);
  const [envId, setEnvId] = useState<string | null>(null);
  const nav = useNavigate();
  if (loading) return <Loading />; if (error || !data) return <ErrorState message={error} />;
  const bootstrap = async (id: string) => { try { const server = data.servers.find((s) => s.environmentId === id); const r = await api.tasks.create({ definitionId: "environment-bootstrap", inputs: { serverId: server?.id ?? "" }, environmentId: id }); toast(r.approvalRequestId ? `${r.task.key} created — approval required` : `${r.task.key} created`, "success"); nav(`/tasks/${r.task.id}`); } catch (e) { toast(errorMessage(e), "error"); } };
  return <div><PageHeader title="Environments" subtitle="Development → Staging → Production. Each environment maps to an Agent, servers and deployed application versions." />
    <div className="row g-3">{data.envs.map((e) => { const agent = data.agents.find((a) => a.id === e.agentId); const servers = data.servers.filter((s) => s.environmentId === e.id); return <div className="col-lg-4" key={e.id}><div className="panel h-100"><div className="panel-header"><h2 className="panel-title">{e.name}</h2><span><StatusBadge status={e.health} /> <ModeBadge mode={e.mode} /></span></div><div className="panel-body">
      <dl className="kv"><dt>Kind</dt><dd>{e.kind.toLowerCase()}</dd><dt>URL</dt><dd>{e.url ? <a href={e.url} target="_blank" rel="noreferrer">{e.url}</a> : "—"}</dd><dt>Agent</dt><dd>{agent ? <Link to={`/agents/${agent.id}`}>{agent.name} <StatusBadge status={agent.status} /></Link> : <span className="text-secondary">none</span>}</dd><dt>Servers</dt><dd>{servers.map((s) => s.name).join(", ") || "—"}</dd></dl>
      <div className="panel-title mt-2 mb-1">Applications</div>{data.apps.map((a) => <div key={a.id} className="d-flex justify-content-between small py-1 border-bottom"><span>{a.name}</span><span className="mono">{a.deployedVersions[e.id] ?? "—"}</span></div>)}
      <div className="d-flex gap-2 mt-3 flex-wrap"><button className="btn btn-sm btn-outline-secondary" onClick={async () => { setEnvId(e.id); setSnap(await api.platform.environmentSnapshot(e.id)); }}><i className="bi bi-camera me-1" />Snapshot</button>{can("server.install") && <button className="btn btn-sm btn-outline-secondary" onClick={() => bootstrap(e.id)}><i className="bi bi-box-seam me-1" />Bootstrap</button>}</div>
    </div></div></div>; })}</div>
    <Drawer open={!!snap} onClose={() => setSnap(null)} title={`Environment snapshot — ${data.envs.find((e) => e.id === envId)?.name}`} wide><div className="small text-secondary mb-2">This is what <code>super.environment.snapshot</code> returns to AI in one call, instead of 14 inspect calls.</div><pre className="task-log" style={{ maxHeight: "70vh" }}>{JSON.stringify(snap, null, 2)}</pre></Drawer>
  </div>;
}

export function Servers({ view }: { view: "servers" | "vms" | "proxmox" | "docker" }) {
  const { data, loading, error } = useInfra();
  const { api, toast, can } = useApp();
  const nav = useNavigate();
  if (loading) return <Loading />; if (error || !data) return <ErrorState message={error} />;
  const envName = (id: string) => data.envs.find((e) => e.id === id)?.name ?? id;
  const proxmox = data.integrations.find((i) => i.kind === "PROXMOX");
  const vmAction = async (definitionId: string, s: (typeof data.servers)[number], name: string) => { try { const r = await api.tasks.create({ definitionId, inputs: { vmId: s.proxmoxVmId ?? 0, environmentId: s.environmentId, service: name, node: s.proxmoxNode ?? "", template: "", cpu: s.cpu, memoryGb: s.memoryGb }, environmentId: s.environmentId, name: `${name} ${s.name}`, destructive: definitionId === "proxmox-vm-delete" }); toast(r.approvalRequestId ? `${r.task.key}: approval required (${r.task.risk})` : `${r.task.key} created`, "success"); nav(`/tasks/${r.task.id}`); } catch (e) { toast(errorMessage(e), "error"); } };
  if (view === "proxmox") return <div><PageHeader title="Proxmox" badge={<ModeBadge mode={proxmox?.status ?? "NOT_CONNECTED"} />} subtitle={proxmox ? `${proxmox.name} · cluster discovery, nodes, VMs, containers, CPU/RAM/storage, backups.` : "Connect a Proxmox cluster to discover nodes and VMs."} />
    <div className="row g-3">{[...new Set(data.servers.map((s) => s.proxmoxNode).filter(Boolean))].map((node) => <div className="col-lg-6" key={node}><Panel title={<span><i className="bi bi-hdd-rack me-1" />{node}</span>}>{data.servers.filter((s) => s.proxmoxNode === node).map((s) => <div key={s.id} className="list-row px-0"><i className="bi bi-pc-display text-secondary" /><div className="flex-grow-1"><div className="title">VM {s.proxmoxVmId} · {s.name}</div><div className="meta">{envName(s.environmentId)} · {s.cpu} vCPU · {s.memoryGb} GB · {s.diskGb} GB · {s.os}</div></div><StatusBadge status={s.status === "RUNNING" ? "HEALTHY" : s.status} label={s.status} />{can("proxmox.vm.stop") && <div className="d-flex gap-1"><button className="btn btn-sm btn-outline-secondary" onClick={() => vmAction("restart-service", s, "Restart")}>Restart</button>{can("proxmox.vm.delete") && <button className="btn btn-sm btn-outline-danger" onClick={() => vmAction("proxmox-vm-delete", s, "Delete VM")}>Delete</button>}</div>}</div>)}</Panel></div>)}</div>
    <div className="mt-3"><Panel title="Topology"><pre className="mb-0 small">{`Proxmox (${proxmox?.baseUrl ?? "—"})\n` + [...new Set(data.servers.map((s) => s.proxmoxNode))].map((n, i, arr) => `${i === arr.length - 1 ? "└──" : "├──"} ${n}\n` + data.servers.filter((s) => s.proxmoxNode === n).map((s, j, a) => `${i === arr.length - 1 ? "    " : "│   "}${j === a.length - 1 ? "└──" : "├──"} VM ${s.proxmoxVmId} ${s.name} (${s.status.toLowerCase()})`).join("\n")).join("\n")}</pre></Panel></div></div>;
  if (view === "docker") return <div><PageHeader title="Docker" subtitle="Containers per host, from the Agent's docker capability." badge={<ModeBadge mode="DEMO" />} />
    <div className="panel"><DataTable rows={data.servers.filter((s) => s.components.docker)} rowKey={(s) => s.id} columns={[{ key: "h", header: "Host", render: (s) => <span className="fw-semibold">{s.name}</span> }, { key: "e", header: "Environment", render: (s) => envName(s.environmentId) }, { key: "d", header: "Docker", render: (s) => <span className="mono">{s.components.docker}</span> }, { key: "c", header: "Containers", render: (s) => <span className="small">{data.apps.map((a) => a.deployedVersions[s.environmentId] ? `${a.slug}:${a.deployedVersions[s.environmentId]}` : null).filter(Boolean).join(", ") || "—"}</span> }, { key: "p", header: "Portainer", render: (s) => s.components.portainer ? <StatusBadge status="CONNECTED" label={`v${s.components.portainer}`} /> : <span className="text-secondary small">not installed</span> }, { key: "a", header: "", render: (s) => can("docker.restart") ? <button className="btn btn-sm btn-outline-secondary" onClick={() => vmAction("restart-service", s, "Restart containers on")}>Restart</button> : null }]} /></div></div>;
  return <div><PageHeader title={view === "vms" ? "Virtual Machines" : "Servers"} subtitle="Discovered via Proxmox and Agents. Installed components come from environment discovery." />
    <div className="panel"><DataTable rows={data.servers.filter((s) => view === "servers" || s.kind === "VM")} rowKey={(s) => s.id} columns={[{ key: "n", header: "Name", render: (s) => <div><span className="fw-semibold">{s.name}</span><div className="small text-secondary mono">{s.host} · {s.os}</div></div> }, { key: "e", header: "Environment", render: (s) => envName(s.environmentId) }, { key: "k", header: "Kind", render: (s) => <span className="small">{s.kind}{s.proxmoxVmId ? ` · VM ${s.proxmoxVmId} @ ${s.proxmoxNode}` : ""}</span> }, { key: "r", header: "Resources", render: (s) => <span className="small mono">{s.cpu} vCPU · {s.memoryGb} GB · {s.diskGb} GB</span> }, { key: "c", header: "Components", render: (s) => <span className="small">{Object.entries(s.components).map(([k, v]) => `${k} ${v}`).join(" · ")}</span> }, { key: "s", header: "Status", render: (s) => <StatusBadge status={s.status === "RUNNING" ? "HEALTHY" : s.status} label={s.status} /> }, { key: "a", header: "", render: (s) => can("server.restart") ? <button className="btn btn-sm btn-outline-secondary" onClick={() => vmAction("restart-service", s, "Restart")}>Restart</button> : null }]} /></div></div>;
}

export function Applications() {
  const { data, loading, error } = useInfra();
  const { api, toast, can } = useApp();
  const nav = useNavigate();
  if (loading) return <Loading />; if (error || !data) return <ErrorState message={error} />;
  const deploy = async (appId: string, envId: string) => { try { const r = await api.tasks.create({ definitionId: "deploy-application", inputs: { applicationId: appId, environmentId: envId, version: "next" }, environmentId: envId, applicationId: appId }); toast(r.approvalRequestId ? `${r.task.key}: approval required` : `${r.task.key} queued`, "success"); nav(`/tasks/${r.task.id}`); } catch (e) { toast(errorMessage(e), "error"); } };
  return <div><PageHeader title="Applications" subtitle="Deployed versions per environment. Deployments always go through policy → approval → Task Engine → Agent." />
    <div className="panel"><div className="table-wrap"><table className="table-smcp"><thead><tr><th>Application</th><th>Runtime</th>{data.envs.map((e) => <th key={e.id}>{e.name}</th>)}</tr></thead><tbody>{data.apps.map((a) => <tr key={a.id}><td><span className="fw-semibold">{a.name}</span><div className="small text-secondary mono">{a.slug}</div></td><td className="small">{a.runtime}</td>{data.envs.map((e) => <td key={e.id}><span className="mono">{a.deployedVersions[e.id] ?? "—"}</span>{can("deployment.create") && <button className="btn btn-sm btn-link py-0" onClick={() => deploy(a.id, e.id)}>deploy</button>}</td>)}</tr>)}</tbody></table></div></div></div>;
}

export function Deployments() {
  const { api } = useApp();
  const nav = useNavigate();
  const { data, loading, error } = useAsync(() => api.platform.deployments(), []);
  if (loading) return <Loading />; if (error) return <ErrorState message={error} />;
  return <div><PageHeader title="Deployments" subtitle="BUILD → TEST → PACKAGE → DEPLOY → VERIFY → MONITOR → ALERT → HEAL → ROLLBACK" />
    <div className="panel"><DataTable rows={data ?? []} rowKey={(d) => d.id} onRowClick={(d) => nav(`/deployments/${d.id}`)} empty={<EmptyState icon="bi-rocket-takeoff" title="No deployments yet" body="Deployments are created by the Task Engine when a Change reaches the Deployment stage." />} columns={[{ key: "a", header: "Application", render: (d) => <span className="fw-semibold">{d.applicationName} <span className="mono fw-normal">{d.version}</span></span> }, { key: "e", header: "Environment", render: (d) => d.environmentName }, { key: "s", header: "Status", render: (d) => <StatusBadge status={d.status} /> }, { key: "h", header: "Health", render: (d) => <StatusBadge status={d.health} /> }, { key: "hc", header: "Health checks", render: (d) => <span className="small">{d.healthChecks.filter((h) => h.status === "PASS").length}/{d.healthChecks.length} passed{d.healthChecks.some((h) => h.status === "FAIL") && <span className="text-warning ms-1">(self-healed)</span>}</span> }, { key: "p", header: "Previous", render: (d) => <span className="mono small">{d.previousVersion ?? "—"}</span> }, { key: "t", header: "Started", render: (d) => <span className="small text-secondary">{timeAgo(d.startedAt)}</span> }]} /></div></div>;
}

export function DeploymentDetail() {
  const { id = "" } = useParams();
  const { api, toast, can } = useApp();
  const nav = useNavigate();
  const { data, loading, error } = useAsync(() => api.platform.deployment(id), [id]);
  if (loading) return <Loading />; if (error || !data) return <ErrorState message={error} />;
  const { deployment: d, task } = data;
  const rollback = async () => { try { const r = await api.tasks.create({ definitionId: "rollback-application", inputs: { deploymentId: d.id }, environmentId: d.environmentId, applicationId: d.applicationId, changeId: d.changeId, destructive: true, name: `Rollback ${d.applicationName} ${d.version} → ${d.previousVersion ?? "previous"}` }); toast(r.approvalRequestId ? `${r.task.key}: approval required` : `${r.task.key} queued`, "success"); nav(`/tasks/${r.task.id}`); } catch (e) { toast(errorMessage(e), "error"); } };
  return <div><PageHeader title={`${d.applicationName} ${d.version} → ${d.environmentName}`} badge={<><StatusBadge status={d.status} /><StatusBadge status={d.health} /></>} subtitle={`Started ${fmtDate(d.startedAt)}${d.finishedAt ? ` · finished ${fmtDate(d.finishedAt)}` : ""} · previous ${d.previousVersion ?? "—"}`} actions={can("deployment.rollback") && d.status === "HEALTHY" && <button className="btn btn-outline-danger" onClick={rollback}><i className="bi bi-arrow-counterclockwise me-1" />Rollback</button>} />
    <div className="row g-3"><div className="col-lg-6"><Panel title="Health checks">{d.healthChecks.length === 0 ? <span className="text-secondary small">No checks recorded yet.</span> : d.healthChecks.map((h, i) => <div key={i} className="check-row"><span>{h.name}{h.detail && <span className="text-secondary small ms-2">{h.detail}</span>}</span><StatusBadge status={h.status} /></div>)}</Panel></div><div className="col-lg-6"><Panel title="Links"><dl className="kv">{task && <><dt>Task</dt><dd><Link to={`/tasks/${task.id}`}>{task.key} {task.name}</Link> <StatusBadge status={task.status} /></dd></>}{d.changeId && <><dt>Change</dt><dd><Link to={`/changes/${d.changeId}`}>Open change</Link></dd></>}{d.agentId && <><dt>Agent</dt><dd><Link to={`/agents/${d.agentId}`}>{d.agentId}</Link></dd></>}<dt>Execution</dt><dd>{d.executionMode}</dd></dl></Panel></div></div></div>;
}

export function DockerPlaceholder() { return <ComingSoon title="Docker" />; }
export { MetricCard };
