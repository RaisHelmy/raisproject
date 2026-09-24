import { useEffect, useState, type FormEvent } from "react";
import { PageHeader, InfoTip, StatusBadge, ConfirmationDialog } from "../ux/components";
import { api } from "../lib/api";
import { CATEGORY_META, type Theory } from "./TheoryGallery";

interface EmailSettingsView {
  provider: "dev" | "cloudflare" | "resend";
  fromEmail: string;
  fromName: string;
  hasApiKey: boolean;
}

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  email_verified: number;
  created_at: string;
}

export function AdminPage() {
  const [settings, setSettings] = useState<EmailSettingsView | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [notice, setNotice] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    api
      .get<{ settings: EmailSettingsView }>("/admin/email-settings")
      .then((r) => setSettings(r.settings))
      .catch((e) => setNotice({ tone: "warn", text: e instanceof Error ? e.message : "Could not load settings." }));
    api
      .get<{ users: AdminUser[] }>("/admin/users")
      .then((r) => setUsers(r.users))
      .catch(() => {});
  }, []);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setNotice(null);
    try {
      await api.put("/admin/email-settings", {
        provider: settings.provider,
        fromEmail: settings.fromEmail,
        fromName: settings.fromName,
        ...(apiKey ? { apiKey } : {}),
      });
      setApiKey("");
      setNotice({ tone: "ok", text: "Email settings saved. Send a test email to confirm delivery works." });
    } catch (err) {
      setNotice({ tone: "warn", text: err instanceof Error ? err.message : "Saving failed." });
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    setTesting(true);
    setNotice(null);
    try {
      const res = await api.post<{ ok: boolean; provider: string; devNote?: string; error?: string }>(
        "/admin/test-email"
      );
      setNotice({
        tone: "ok",
        text: res.devNote ?? `Test email sent via ${res.provider}. Check your inbox.`,
      });
    } catch (err) {
      setNotice({ tone: "warn", text: err instanceof Error ? err.message : "Test send failed." });
    } finally {
      setTesting(false);
    }
  };

  return (
    <>
      <PageHeader
        crumbs={[{ label: "System", to: "/system/settings" }, { label: "Administration" }]}
        eyebrow="System"
        title="Administration"
        description="Configure how Rais Fintech sends email — verification links, notifications and alerts — and review workspace members."
      />

      {notice && (
        <div className={`alert ${notice.tone === "ok" ? "alert-info" : "alert-warn"}`} style={{ marginBottom: 16 }}>
          <span aria-hidden>{notice.tone === "ok" ? "✓" : "⚠️"}</span>
          <span>{notice.text}</span>
        </div>
      )}

      <form className="card" onSubmit={save}>
        <div className="card-title">
          Email server{" "}
          <InfoTip>
            Rais Fintech sends transactional email only — verification links, security notices
            and alerts. Choose the provider that delivers them.
          </InfoTip>
        </div>

        {!settings ? (
          <p className="muted mt-16">Loading settings…</p>
        ) : (
          <>
            <div className="mt-16">
              {(
                [
                  {
                    id: "dev",
                    icon: "🧪",
                    title: "Development mode",
                    desc: "No email is sent. Verification links appear directly in the app — ideal while developing locally.",
                  },
                  {
                    id: "cloudflare",
                    icon: "☁️",
                    title: "Cloudflare Email Service",
                    desc: "Sends through the Workers binding. Requires a domain onboarded with `wrangler email sending enable <domain>`.",
                  },
                  {
                    id: "resend",
                    icon: "📮",
                    title: "Resend",
                    desc: "Sends through the Resend HTTPS API using the key below. Works from local dev and production.",
                  },
                ] as const
              ).map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className={`ob-option ${settings.provider === o.id ? "selected" : ""}`}
                  onClick={() => setSettings({ ...settings, provider: o.id })}
                >
                  <span className="obo-icon" aria-hidden>{o.icon}</span>
                  <span>
                    <span className="obo-title">{o.title}</span>
                    <br />
                    <span className="obo-desc">{o.desc}</span>
                  </span>
                </button>
              ))}
            </div>

            <div className="form-grid mt-24">
              <div className="field">
                <label htmlFor="ad-from">From address</label>
                <input
                  id="ad-from"
                  type="email"
                  value={settings.fromEmail}
                  onChange={(e) => setSettings({ ...settings, fromEmail: e.target.value })}
                  required
                />
                <div className="hint">Must belong to a domain your provider is allowed to send from.</div>
              </div>
              <div className="field">
                <label htmlFor="ad-name">From name</label>
                <input
                  id="ad-name"
                  value={settings.fromName}
                  onChange={(e) => setSettings({ ...settings, fromName: e.target.value })}
                  required
                />
              </div>
            </div>

            {settings.provider === "resend" && (
              <div className="field">
                <label htmlFor="ad-key">Resend API key</label>
                <input
                  id="ad-key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={settings.hasApiKey ? "•••••••• (key stored — enter a new one to replace it)" : "re_..."}
                  autoComplete="off"
                />
                <div className="hint">Stored server-side and never shown again.</div>
              </div>
            )}

            <div className="wizard-actions">
              <button type="button" className="btn btn-secondary" onClick={sendTest} disabled={testing}>
                {testing ? "Sending…" : "Send Test Email"}
              </button>
              <span className="spacer" />
              <button className="btn btn-primary" disabled={saving}>
                {saving ? "Saving…" : "Save Settings"}
              </button>
            </div>
          </>
        )}
      </form>

      <SuggestionReview />

      <TheoryManager />

      <div className="card">
        <div className="card-title">Workspace members</div>
        <div className="table-wrap mt-16">
          <table className="data">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Verified</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td><strong>{u.name}</strong></td>
                  <td>{u.email}</td>
                  <td><StatusBadge tone={u.role === "admin" ? "gold" : "gray"}>{u.role}</StatusBadge></td>
                  <td>{u.email_verified ? <StatusBadge tone="green">Verified</StatusBadge> : <StatusBadge tone="red">Pending</StatusBadge>}</td>
                  <td>{u.created_at.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Theory Gallery management                                           */
/* ------------------------------------------------------------------ */

const EMPTY_THEORY = {
  title: "",
  category: "general",
  summary: "",
  content: "",
  when_to_use: "",
  risk_notes: "",
  source: "",
  related_technique: "",
  published: true,
};

type TheoryForm = typeof EMPTY_THEORY;

function TheoryManager() {
  const [theories, setTheories] = useState<Theory[]>([]);
  const [form, setForm] = useState<TheoryForm>(EMPTY_THEORY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Theory | null>(null);

  const load = () => {
    api
      .get<{ theories: Theory[] }>("/theories?all=1")
      .then((r) => setTheories(r.theories))
      .catch(() => {});
  };
  useEffect(load, []);

  const startCreate = () => {
    setForm(EMPTY_THEORY);
    setEditingId(null);
    setShowForm(true);
    setNote(null);
  };

  const startEdit = (t: Theory) => {
    setForm({
      title: t.title,
      category: t.category,
      summary: t.summary,
      content: t.content,
      when_to_use: t.when_to_use ?? "",
      risk_notes: t.risk_notes ?? "",
      source: t.source ?? "",
      related_technique: t.related_technique ?? "",
      published: !!t.published,
    });
    setEditingId(t.id);
    setShowForm(true);
    setNote(null);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setNote(null);
    const payload = { ...form, related_technique: form.related_technique || null };
    try {
      if (editingId) {
        await api.put(`/admin/theories/${editingId}`, payload);
        setNote("Theory updated. Users see the change immediately.");
      } else {
        await api.post("/admin/theories", payload);
        setNote(form.published ? "Theory published to the gallery." : "Theory saved as a draft (unpublished).");
      }
      setShowForm(false);
      load();
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Saving failed.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (t: Theory) => {
    setToDelete(null);
    try {
      await api.del(`/admin/theories/${t.id}`);
      load();
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Deleting failed.");
    }
  };

  const set = (patch: Partial<TheoryForm>) => setForm((f) => ({ ...f, ...patch }));

  return (
    <div className="card">
      <div className="row">
        <div className="grow">
          <div className="card-title">
            Theory Gallery{" "}
            <InfoTip>
              Theories you publish here appear in Investments → Theory Gallery, where users
              consult them for decision making. Unpublished entries stay drafts.
            </InfoTip>
          </div>
          <p className="muted">{theories.length} entries · {theories.filter((t) => t.published).length} published</p>
        </div>
        <button className="btn btn-primary" onClick={startCreate}>Add Theory</button>
      </div>

      {note && (
        <div className="alert alert-info mt-16">
          <span aria-hidden>ⓘ</span>
          <span>{note}</span>
        </div>
      )}

      {showForm && (
        <form onSubmit={save} className="mt-24" style={{ borderTop: "1px solid var(--line-soft)", paddingTop: 18 }}>
          <div className="form-grid">
            <div className="field">
              <label>Title</label>
              <input value={form.title} onChange={(e) => set({ title: e.target.value })} required />
            </div>
            <div className="field">
              <label>Category</label>
              <select value={form.category} onChange={(e) => set({ category: e.target.value })}>
                {Object.entries(CATEGORY_META).map(([id, m]) => (
                  <option key={id} value={id}>{m.icon} {m.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label>One-line summary</label>
            <input value={form.summary} onChange={(e) => set({ summary: e.target.value })} required />
          </div>
          <div className="field">
            <label>The theory (main content)</label>
            <textarea rows={4} value={form.content} onChange={(e) => set({ content: e.target.value })} required />
          </div>
          <div className="form-grid">
            <div className="field">
              <label>When to use it</label>
              <textarea rows={2} value={form.when_to_use} onChange={(e) => set({ when_to_use: e.target.value })} />
            </div>
            <div className="field">
              <label>What can go wrong (risk notes)</label>
              <textarea rows={2} value={form.risk_notes} onChange={(e) => set({ risk_notes: e.target.value })} />
            </div>
          </div>
          <div className="form-grid">
            <div className="field">
              <label>Source / attribution</label>
              <input value={form.source} onChange={(e) => set({ source: e.target.value })} />
            </div>
            <div className="field">
              <label>
                Linked quant technique{" "}
                <InfoTip>Linking a technique adds "See live signals" actions on the theory, connecting it to the algorithm engine.</InfoTip>
              </label>
              <select value={form.related_technique} onChange={(e) => set({ related_technique: e.target.value })}>
                <option value="">None</option>
                <option value="trend">Trend Following</option>
                <option value="mean-reversion">Mean Reversion</option>
                <option value="momentum">Momentum</option>
              </select>
            </div>
          </div>
          <div className="row" style={{ marginBottom: 16 }}>
            <label className="row" style={{ gap: 8, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={form.published}
                onChange={(e) => set({ published: e.target.checked })}
              />
              <span>Published — visible to all users</span>
            </label>
          </div>
          <div className="row">
            <button className="btn btn-primary" disabled={busy}>
              {busy ? "Saving…" : editingId ? "Save Changes" : "Add to Gallery"}
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="table-wrap mt-16">
        <table className="data">
          <thead>
            <tr>
              <th>Theory</th>
              <th>Category</th>
              <th>Status</th>
              <th>Updated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {theories.map((t) => {
              const m = CATEGORY_META[t.category] ?? CATEGORY_META.general;
              return (
                <tr key={t.id}>
                  <td>
                    <strong>{t.title}</strong>
                    <div className="muted" style={{ maxWidth: 340, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {t.summary}
                    </div>
                  </td>
                  <td><StatusBadge tone={m.tone}>{m.icon} {m.label}</StatusBadge></td>
                  <td>
                    {t.published ? (
                      <StatusBadge tone="green">Published</StatusBadge>
                    ) : (
                      <StatusBadge tone="gray">Draft</StatusBadge>
                    )}
                  </td>
                  <td className="muted" style={{ whiteSpace: "nowrap" }}>{t.updated_at.slice(0, 10)}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button className="btn btn-sm btn-secondary" onClick={() => startEdit(t)}>Edit</button>{" "}
                    <button className="btn btn-sm btn-ghost" onClick={() => setToDelete(t)}>Delete</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmationDialog
        open={toDelete !== null}
        title={`Delete “${toDelete?.title}”?`}
        body="The theory is removed from the gallery for every user. This cannot be undone — consider unpublishing instead if you may want it back."
        confirmLabel="Delete Theory"
        danger
        onCancel={() => setToDelete(null)}
        onConfirm={() => toDelete && remove(toDelete)}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Suggestion review                                                   */
/* ------------------------------------------------------------------ */

interface AdminSuggestion {
  id: string;
  context: string;
  title: string;
  description: string;
  status: string;
  admin_note: string | null;
  created_at: string;
  user_name: string;
  user_email: string;
}

function SuggestionReview() {
  const [items, setItems] = useState<AdminSuggestion[]>([]);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    api.get<{ suggestions: AdminSuggestion[] }>("/admin/suggestions").then((r) => setItems(r.suggestions)).catch(() => {});
  };
  useEffect(load, []);

  const decide = async (s: AdminSuggestion, status: string) => {
    setBusyId(s.id);
    try {
      await api.put(`/admin/suggestions/${s.id}`, {
        status,
        admin_note: noteFor === s.id ? note : s.admin_note ?? "",
      });
      setNoteFor(null);
      setNote("");
      load();
    } finally {
      setBusyId(null);
    }
  };

  const pending = items.filter((s) => s.status === "pending");
  const decided = items.filter((s) => s.status !== "pending");
  const tone = (s: string) =>
    s === "approved" ? "green" : s === "implemented" ? "blue" : s === "rejected" ? "red" : "gold";

  return (
    <div className="card">
      <div className="card-title">
        User suggestions{" "}
        <InfoTip>
          Ideas submitted from the 💡 Suggest buttons across the app. Approving awards the
          contributor +150 points; mark a suggestion "implemented" once it ships.
        </InfoTip>
      </div>
      <p className="muted">
        {pending.length} awaiting review · {decided.length} decided
      </p>

      {items.length === 0 ? (
        <p className="muted mt-16">Nothing yet — suggestions users submit will appear here.</p>
      ) : (
        <div className="mt-16">
          {items.map((s) => (
            <div key={s.id} style={{ borderTop: "1px solid var(--line-soft)", padding: "14px 0" }}>
              <div className="row" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
                <div className="grow" style={{ minWidth: 240 }}>
                  <strong>{s.title}</strong>{" "}
                  <StatusBadge tone={tone(s.status) as "green" | "gold" | "red" | "blue"}>{s.status}</StatusBadge>
                  <div className="muted" style={{ marginTop: 4 }}>
                    {s.user_name} ({s.user_email}) · from {s.context} · {s.created_at.slice(0, 10)}
                  </div>
                  <p style={{ marginTop: 8, maxWidth: 560 }}>{s.description}</p>
                  {s.admin_note && <p className="muted" style={{ marginTop: 6 }}>Note: {s.admin_note}</p>}
                </div>
                <div className="row" style={{ flexWrap: "wrap" }}>
                  {s.status === "pending" && (
                    <>
                      <button className="btn btn-sm btn-primary" disabled={busyId === s.id} onClick={() => decide(s, "approved")}>
                        Approve (+150 pts)
                      </button>
                      <button className="btn btn-sm btn-secondary" disabled={busyId === s.id} onClick={() => decide(s, "rejected")}>
                        Reject
                      </button>
                    </>
                  )}
                  {s.status === "approved" && (
                    <button className="btn btn-sm btn-gold" disabled={busyId === s.id} onClick={() => decide(s, "implemented")}>
                      Mark Implemented
                    </button>
                  )}
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => {
                      setNoteFor(noteFor === s.id ? null : s.id);
                      setNote(s.admin_note ?? "");
                    }}
                  >
                    {noteFor === s.id ? "Hide note" : "Add note"}
                  </button>
                </div>
              </div>
              {noteFor === s.id && (
                <div className="field" style={{ marginTop: 10, marginBottom: 0, maxWidth: 560 }}>
                  <textarea
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Visible to the user — e.g. why it was approved/rejected, or what shipped."
                  />
                  <div className="hint">The note is saved with your next Approve / Reject / Implemented action.</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
