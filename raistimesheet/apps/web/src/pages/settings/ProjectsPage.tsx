import { useEffect, useState } from "react";
import type { ClientDTO, ProjectDTO, UserDTO } from "@rais/shared-types";
import { useApi, useAction } from "@/hooks/useApi";
import { api } from "@/services/api";
import { Card, ErrorAlert, Modal, PageHeader, Spinner, StatusBadge, useToast } from "@/components/ui";

const EMPTY = { client_id: "", name: "", code: "", jira_project_key: "", jira_url: "", default_issue_type: "Task", default_assignee_account_id: "", timezone: "Asia/Kuala_Lumpur", working_hours_start: "09:00", working_hours_end: "18:00", is_active: true, member_ids: [] as string[] };

export default function ProjectsPage() {
  const projects = useApi<ProjectDTO[]>("/projects", { all: 1 });
  const clients = useApi<ClientDTO[]>("/clients");
  const users = useApi<UserDTO[]>("/admin/users");
  const [edit, setEdit] = useState<{ id: string | null; f: typeof EMPTY } | null>(null);
  const [client, setClient] = useState<{ id: string | null; name: string; code: string } | null>(null);
  const act = useAction();
  const toast = useToast();
  const members = useApi<string[]>(edit?.id ? `/admin/projects/${edit.id}/members` : null);
  // Real project keys from the connected Jira site. A key that doesn't exist
  // there syncs zero issues silently, so offer the actual list rather than
  // making an admin guess.
  const jiraProjects = useApi<{ demo: boolean; projects: { key: string; name: string }[] }>(edit ? "/jira/projects" : null);
  useEffect(() => { if (members.data && edit) setEdit({ ...edit, f: { ...edit.f, member_ids: members.data } }); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [members.data]);

  const save = async () => {
    if (!edit) return;
    const body = { ...edit.f, jira_project_key: edit.f.jira_project_key || null, jira_url: edit.f.jira_url || null, default_assignee_account_id: edit.f.default_assignee_account_id || null };
    const r = await act.run(() => edit.id ? api(`/admin/projects/${edit.id}`, { method: "PATCH", body }) : api("/admin/projects", { body }));
    if (r) { toast.show("Project saved"); setEdit(null); projects.reload(); }
  };
  const saveClient = async () => {
    if (!client) return;
    const r = await act.run(() => client.id ? api(`/admin/clients/${client.id}`, { method: "PATCH", body: { name: client.name, code: client.code } }) : api("/admin/clients", { body: { name: client.name, code: client.code } }));
    if (r) { toast.show("Client saved"); setClient(null); clients.reload(); }
  };

  return (
    <div>
      <PageHeader title="Projects & Clients" subtitle="Nothing is hardcoded: each project carries its Jira key, defaults, timezone and working hours." actions={<><button className="btn btn-outline-primary" onClick={() => setClient({ id: null, name: "", code: "" })}>New client</button><button className="btn btn-primary" onClick={() => setEdit({ id: null, f: { ...EMPTY, client_id: clients.data?.[0]?.id ?? "" } })}><i className="bi bi-plus-lg me-1" />New project</button></>} />
      <div className="row g-3">
        <div className="col-lg-8">
          <Card title="Projects" className="p-0">
            {!projects.data ? <Spinner /> : <div className="table-responsive"><table className="table table-hover align-middle mb-0 data-table"><thead><tr><th>Project</th><th>Client</th><th>Jira key</th><th>Issue type</th><th>Hours</th><th>Status</th><th /></tr></thead><tbody>{projects.data.map((p) => <tr key={p.id}><td><strong>{p.code}</strong> · {p.name}</td><td>{p.client_name}</td><td>{p.jira_project_key ?? <span className="text-secondary">—</span>}</td><td>{p.default_issue_type}</td><td className="text-nowrap">{p.working_hours_start}–{p.working_hours_end}</td><td><StatusBadge value={p.is_active ? "HEALTHY" : "DISCONNECTED"} /></td><td className="text-end"><button className="btn btn-sm btn-outline-secondary" onClick={() => setEdit({ id: p.id, f: { client_id: p.client_id, name: p.name, code: p.code, jira_project_key: p.jira_project_key ?? "", jira_url: p.jira_url ?? "", default_issue_type: p.default_issue_type, default_assignee_account_id: p.default_assignee_account_id ?? "", timezone: p.timezone, working_hours_start: p.working_hours_start, working_hours_end: p.working_hours_end, is_active: p.is_active, member_ids: [] } })}>Edit</button></td></tr>)}</tbody></table></div>}
          </Card>
        </div>
        <div className="col-lg-4">
          <Card title="Clients" className="p-0">{!clients.data ? <Spinner /> : <ul className="list-group list-group-flush">{clients.data.map((c) => <li key={c.id} className="list-group-item d-flex justify-content-between align-items-center"><span><strong>{c.code}</strong> · {c.name}</span><button className="btn btn-sm btn-link" onClick={() => setClient({ id: c.id, name: c.name, code: c.code })}>Edit</button></li>)}</ul>}</Card>
        </div>
      </div>

      {edit && (
        <Modal open title={edit.id ? "Edit project" : "New project"} onClose={() => setEdit(null)} size="lg" footer={<><button className="btn btn-outline-secondary" onClick={() => setEdit(null)}>Cancel</button><button className="btn btn-primary" onClick={save} disabled={act.busy}>Save</button></>}>
          <ErrorAlert error={act.error} />
          <div className="row g-2">
            <div className="col-md-4"><label className="form-label small" htmlFor="p-client">Client</label><select id="p-client" className="form-select form-select-sm" value={edit.f.client_id} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, client_id: e.target.value } })}>{clients.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div className="col-md-5"><label className="form-label small" htmlFor="p-name">Name</label><input id="p-name" className="form-control form-control-sm" value={edit.f.name} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, name: e.target.value } })} /></div>
            <div className="col-md-3"><label className="form-label small" htmlFor="p-code">Code</label><input id="p-code" className="form-control form-control-sm" value={edit.f.code} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, code: e.target.value.toUpperCase() } })} placeholder="BNM" /></div>
            <div className="col-md-3"><label className="form-label small" htmlFor="p-jkey">Jira project key</label><input id="p-jkey" list="jira-project-keys" className="form-control form-control-sm" value={edit.f.jira_project_key} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, jira_project_key: e.target.value.toUpperCase() } })} /><datalist id="jira-project-keys">{(jiraProjects.data?.projects ?? []).map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}</datalist>{jiraProjects.data && (jiraProjects.data.projects.length ? <div className="form-text">On {jiraProjects.data.demo ? "the demo adapter" : "your Jira site"}: {jiraProjects.data.projects.map((p) => p.key).join(", ")}</div> : <div className="form-text text-warning">No projects found on the connected Jira site.</div>)}{edit.f.jira_project_key && jiraProjects.data && !jiraProjects.data.projects.some((p) => p.key === edit.f.jira_project_key) && <div className="form-text text-danger">{edit.f.jira_project_key} doesn't exist on the connected Jira site — sync will find no issues.</div>}</div>
            <div className="col-md-5"><label className="form-label small" htmlFor="p-jurl">Jira URL</label><input id="p-jurl" className="form-control form-control-sm" value={edit.f.jira_url} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, jira_url: e.target.value } })} placeholder="https://site.atlassian.net" /></div>
            <div className="col-md-4"><label className="form-label small" htmlFor="p-type">Default issue type</label><input id="p-type" className="form-control form-control-sm" value={edit.f.default_issue_type} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, default_issue_type: e.target.value } })} /></div>
            <div className="col-md-6"><label className="form-label small" htmlFor="p-asg">Default assignee (Jira account id)</label><input id="p-asg" className="form-control form-control-sm" value={edit.f.default_assignee_account_id} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, default_assignee_account_id: e.target.value } })} /></div>
            <div className="col-md-6"><label className="form-label small" htmlFor="p-tz">Timezone</label><input id="p-tz" className="form-control form-control-sm" value={edit.f.timezone} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, timezone: e.target.value } })} /></div>
            <div className="col-md-3"><label className="form-label small" htmlFor="p-ws">Working hours start</label><input id="p-ws" type="time" className="form-control form-control-sm" value={edit.f.working_hours_start} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, working_hours_start: e.target.value } })} /></div>
            <div className="col-md-3"><label className="form-label small" htmlFor="p-we">Working hours end</label><input id="p-we" type="time" className="form-control form-control-sm" value={edit.f.working_hours_end} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, working_hours_end: e.target.value } })} /></div>
            <div className="col-md-6 d-flex align-items-end"><div className="form-check"><input className="form-check-input" type="checkbox" id="p-active" checked={edit.f.is_active} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, is_active: e.target.checked } })} /><label className="form-check-label" htmlFor="p-active">Active</label></div></div>
            <div className="col-12"><label className="form-label small">Members</label><div className="d-flex flex-wrap gap-3">{users.data?.map((u) => <div key={u.id} className="form-check"><input className="form-check-input" type="checkbox" id={`m-${u.id}`} checked={edit.f.member_ids.includes(u.id)} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, member_ids: e.target.checked ? [...edit.f.member_ids, u.id] : edit.f.member_ids.filter((x) => x !== u.id) } })} /><label className="form-check-label" htmlFor={`m-${u.id}`}>{u.name}</label></div>)}</div></div>
          </div>
        </Modal>
      )}
      {client && (
        <Modal open title={client.id ? "Edit client" : "New client"} onClose={() => setClient(null)} footer={<><button className="btn btn-outline-secondary" onClick={() => setClient(null)}>Cancel</button><button className="btn btn-primary" onClick={saveClient} disabled={act.busy}>Save</button></>}>
          <ErrorAlert error={act.error} />
          <div className="mb-2"><label className="form-label small" htmlFor="c-name">Name</label><input id="c-name" className="form-control" value={client.name} onChange={(e) => setClient({ ...client, name: e.target.value })} /></div>
          <div><label className="form-label small" htmlFor="c-code">Code</label><input id="c-code" className="form-control" value={client.code} onChange={(e) => setClient({ ...client, code: e.target.value.toUpperCase() })} placeholder="BNM" /></div>
        </Modal>
      )}
      {toast.node}
    </div>
  );
}
