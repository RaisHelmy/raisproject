import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { useGuidance } from "../ux/GuidanceContext";
import { PageHeader, SetupProgress, StatusBadge, ConfirmationDialog, InfoTip } from "../ux/components";
import { useEffect, useState } from "react";
import { api } from "../lib/api";

export function SetupPage() {
  return (
    <>
      <PageHeader
        crumbs={[{ label: "System", to: "/system/setup" }, { label: "Setup" }]}
        eyebrow="System"
        title="Rais Fintech Setup"
        description="Your configuration at a glance. Each completed step unlocks more of the application."
      />
      <SetupProgress />
    </>
  );
}

export function SecurityPage() {
  const { state, update } = useGuidance();
  const { user } = useAuth();

  const checks = [
    { ok: true, label: "Password protection", note: "Set at signup" },
    { ok: !!user?.email_verified, label: "Email verified", note: user?.email_verified ? "Verified" : "Check your inbox" },
    { ok: state.securityDone, label: "Security review completed", note: "" },
  ];

  return (
    <>
      <PageHeader
        crumbs={[{ label: "System", to: "/system/security" }, { label: "Security" }]}
        eyebrow="System"
        title="Security"
        description="Confirm the protections on your account. A quick review now saves difficulty later."
      />
      <div className="card">
        <div className="card-title">Account protections</div>
        <div className="mt-16">
          {checks.map((c) => (
            <div className={`check-row ${c.ok ? "ok" : "todo"}`} key={c.label}>
              <span className="cr-state">{c.ok ? "✓" : "○"}</span>
              <span>{c.label}</span>
              {c.note && <span className="cr-action muted">{c.note}</span>}
            </div>
          ))}
        </div>
        {!state.securityDone && (
          <div className="wizard-actions">
            <span className="spacer" />
            <button className="btn btn-primary" onClick={() => update({ securityDone: true })}>
              Mark Review Complete
            </button>
          </div>
        )}
        {state.securityDone && (
          <p className="mt-16">
            <StatusBadge tone="green">✓ Security review complete</StatusBadge>
          </p>
        )}
      </div>

      <ApiTokensCard />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* My Suggestions — status of ideas submitted via Suggest buttons      */
/* ------------------------------------------------------------------ */

interface MySuggestion {
  id: string;
  context: string;
  title: string;
  status: string;
  admin_note: string | null;
  created_at: string;
}

function MySuggestionsCard() {
  const [items, setItems] = useState<MySuggestion[]>([]);
  useEffect(() => {
    api.get<{ suggestions: MySuggestion[] }>("/suggestions").then((r) => setItems(r.suggestions)).catch(() => {});
  }, []);
  if (items.length === 0) return null;

  const tone = (s: string) =>
    s === "approved" ? "green" : s === "implemented" ? "blue" : s === "rejected" ? "red" : "gold";

  return (
    <div className="card">
      <div className="card-title">My Suggestions</div>
      <p className="muted">
        Ideas you've sent through the 💡 Suggest buttons. Approved suggestions earn +150 points
        and may become new features or content.
      </p>
      <div className="table-wrap mt-16">
        <table className="data">
          <thead>
            <tr><th>Idea</th><th>From</th><th>Status</th><th>Admin note</th></tr>
          </thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.id}>
                <td><strong>{s.title}</strong></td>
                <td className="muted">{s.context}</td>
                <td><StatusBadge tone={tone(s.status) as "green" | "gold" | "red" | "blue"}>{s.status}</StatusBadge></td>
                <td className="muted" style={{ maxWidth: 280 }}>{s.admin_note ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* API Access — personal tokens for REST / MCP wealth control          */
/* ------------------------------------------------------------------ */

interface ApiToken {
  id: string;
  name: string;
  prefix: string;
  scopes: string;
  last_used_at: string | null;
  created_at: string;
}

function ApiTokensCard() {
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [name, setName] = useState("");
  const [trade, setTrade] = useState(false);
  const [fresh, setFresh] = useState<{ token: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<ApiToken | null>(null);

  const load = () => {
    api.get<{ tokens: ApiToken[] }>("/tokens").then((r) => setTokens(r.tokens)).catch(() => {});
  };
  useEffect(load, []);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ token: string; name: string }>("/tokens", {
        name: name.trim() || "API token",
        scopes: trade ? ["read", "trade"] : ["read"],
      });
      setFresh(res);
      setName("");
      setTrade(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Creating the token failed.");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (t: ApiToken) => {
    setRevoking(null);
    try {
      await api.del(`/tokens/${t.id}`);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Revoking failed.");
    }
  };

  return (
    <div className="card">
      <div className="card-title">
        API Access{" "}
        <InfoTip>
          Personal tokens let you control your wealth programmatically — REST calls, scripts,
          or the Rais Fintech MCP server for AI assistants. See docs/api in the repository.
        </InfoTip>
      </div>
      <p className="muted">
        Tokens authenticate as <code>Authorization: Bearer rfk_…</code> against <code>/api/v1/*</code>.
        The <strong>read</strong> scope covers portfolio, holdings, activity, markets and analysis;
        <strong> trade</strong> additionally allows queuing robo orders. Admin, documents and
        settings are never reachable with a token.
      </p>

      {error && (
        <div className="alert alert-warn mt-16">
          <span aria-hidden>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {fresh && (
        <div className="alert alert-info mt-16" style={{ flexWrap: "wrap" }}>
          <span aria-hidden>🔑</span>
          <span className="grow">
            <strong>“{fresh.name}” created.</strong> Copy it now — it will never be shown again.
            <code style={{ display: "block", marginTop: 8, wordBreak: "break-all", background: "var(--paper-raised)", padding: "8px 10px", borderRadius: 6 }}>
              {fresh.token}
            </code>
          </span>
          <button
            className="btn btn-sm btn-gold"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(fresh.token);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch { /* field remains selectable */ }
            }}
          >
            {copied ? "✓ Copied" : "Copy"}
          </button>
          <button className="btn btn-sm btn-ghost" onClick={() => setFresh(null)}>Done</button>
        </div>
      )}

      <div className="row mt-16" style={{ flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className="field grow" style={{ marginBottom: 0, minWidth: 200 }}>
          <label>Token name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. MCP on my laptop" />
        </div>
        <label className="row" style={{ gap: 6, cursor: "pointer", paddingBottom: 9 }}>
          <input type="checkbox" checked={trade} onChange={(e) => setTrade(e.target.checked)} />
          <span>Allow trading (queue orders)</span>
        </label>
        <button className="btn btn-primary" onClick={create} disabled={busy}>
          {busy ? "Creating…" : "Create Token"}
        </button>
      </div>

      {tokens.length > 0 && (
        <div className="table-wrap mt-16">
          <table className="data">
            <thead>
              <tr>
                <th>Name</th>
                <th>Token</th>
                <th>Scopes</th>
                <th>Last used</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tokens.map((t) => (
                <tr key={t.id}>
                  <td><strong>{t.name}</strong></td>
                  <td><code>{t.prefix}…</code></td>
                  <td>
                    {t.scopes.split(",").map((s) => (
                      <span key={s} style={{ marginRight: 4 }}>
                        <StatusBadge tone={s === "trade" ? "gold" : "gray"}>{s}</StatusBadge>
                      </span>
                    ))}
                  </td>
                  <td className="muted">{t.last_used_at ? t.last_used_at.slice(0, 16) : "never"}</td>
                  <td style={{ textAlign: "right" }}>
                    <button className="btn btn-sm btn-ghost" onClick={() => setRevoking(t)}>Revoke</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmationDialog
        open={revoking !== null}
        title={`Revoke “${revoking?.name}”?`}
        body="Anything using this token stops working immediately. This cannot be undone — create a new token if needed."
        confirmLabel="Revoke Token"
        danger
        onCancel={() => setRevoking(null)}
        onConfirm={() => revoking && revoke(revoking)}
      />
    </div>
  );
}

export function SettingsPage() {
  const { user, logout } = useAuth();
  const { resetAll } = useGuidance();
  const navigate = useNavigate();
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <>
      <PageHeader
        crumbs={[{ label: "System", to: "/system/settings" }, { label: "Settings" }]}
        eyebrow="System"
        title="Settings"
        description="Your account and workspace preferences."
      />
      <div className="card">
        <div className="card-title">Account</div>
        <div className="mt-16">
          <p><strong>{user?.name}</strong></p>
          <p className="muted">{user?.email} · {user?.role === "admin" ? "Administrator" : "Member"}</p>
        </div>
        <div className="wizard-actions">
          <button
            className="btn btn-secondary"
            onClick={async () => {
              await logout();
              navigate("/login");
            }}
          >
            Sign Out
          </button>
          <span className="spacer" />
        </div>
      </div>
      <div className="card">
        <div className="card-title">Guided experience</div>
        <p className="muted mt-16">
          Restart the guided journey — onboarding, tours and setup progress return to the
          beginning. Your account, documents and connections are not affected.
        </p>
        <div className="wizard-actions">
          <span className="spacer" />
          <button className="btn btn-secondary" onClick={() => setConfirmReset(true)}>
            Restart Guided Journey
          </button>
        </div>
      </div>

      <MySuggestionsCard />

      <ConfirmationDialog
        open={confirmReset}
        title="Restart the guided journey?"
        body="Onboarding, product tours and setup progress will reset. Your account, family data captured in the journey, documents and connections settings on the server are replaced by a fresh journey state."
        confirmLabel="Restart Journey"
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          resetAll();
          setConfirmReset(false);
          navigate("/welcome");
        }}
      />
    </>
  );
}
