import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AppError } from "@raisai/shared";
import { api } from "../../lib/api";
import { EmptyState } from "../../components/EmptyState";

interface Credential {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export function CredentialsPage(props: { kind: "api-keys" | "mcp-tokens" }) {
  const isApiKey = props.kind === "api-keys";
  const [items, setItems] = useState<Credential[] | null>(null);
  const [available, setAvailable] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>([]);
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [list, scopeList] = await Promise.all([
      api<{ items: Credential[] }>(`/${props.kind}`),
      api<{ apiKey: string[]; mcp: string[] }>("/scopes"),
    ]);
    setItems(list.items);
    setAvailable(isApiKey ? scopeList.apiKey : scopeList.mcp);
  }, [props.kind, isApiKey]);

  useEffect(() => {
    setItems(null);
    setSecret(null);
    load().catch(() => setItems([]));
  }, [load]);

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await api<Credential & { secret: string }>(`/${props.kind}`, {
        method: "POST",
        body: JSON.stringify({ name, scopes }),
      });
      setSecret(created.secret);
      setName("");
      setScopes([]);
      await load();
    } catch (err) {
      setError(err instanceof AppError ? [err.message, err.action].filter(Boolean).join(" ") : "Could not create the key.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    await api(`/${props.kind}/${id}`, { method: "DELETE" });
    await load();
  }

  const title = isApiKey ? "API keys" : "MCP tokens";
  const lead = isApiKey
    ? "Use an API key to call RaisAI from your own code."
    : "Give an AI agent an MCP token so it can create and run things on your behalf.";

  return (
    <section style={{ maxWidth: 760 }}>
      <h1 className="h3 mb-1">{title}</h1>
      <p className="text-secondary mb-4">{lead}</p>

      {secret && (
        <div className="alert alert-success" role="alert">
          <h2 className="h6">Copy this now</h2>
          <p className="small mb-2">This is the only time it will be shown.</p>
          <code className="d-block user-select-all p-2 bg-body-tertiary rounded text-break">{secret}</code>
          <button className="btn btn-sm btn-outline-secondary mt-2" type="button" onClick={() => setSecret(null)}>
            I have copied it
          </button>
        </div>
      )}

      <form className="card mb-4" onSubmit={create}>
        <div className="card-body">
          <h2 className="h6 mb-3">New {isApiKey ? "key" : "token"}</h2>
          {error && <div className="alert alert-danger py-2" role="alert">{error}</div>}

          <div className="mb-3">
            <label className="form-label" htmlFor="credential-name">Name</label>
            <input
              id="credential-name"
              className="form-control"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isApiKey ? "Production server" : "My assistant"}
            />
          </div>

          <fieldset className="mb-3">
            <legend className="form-label fs-6">What it may do</legend>
            <div className="row g-1">
              {available.map((scope) => (
                <div className="col-sm-6" key={scope}>
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id={`scope-${scope}`}
                      checked={scopes.includes(scope)}
                      onChange={(e) =>
                        setScopes((current) => (e.target.checked ? [...current, scope] : current.filter((s) => s !== scope)))
                      }
                    />
                    <label className="form-check-label small font-monospace" htmlFor={`scope-${scope}`}>{scope}</label>
                  </div>
                </div>
              ))}
            </div>
            <div className="form-text">Grant only what it needs. You can revoke it at any time.</div>
          </fieldset>

          <button className="btn btn-primary" type="submit" disabled={busy || !name.trim()}>
            {busy ? "Creating…" : `Create ${isApiKey ? "key" : "token"}`}
          </button>
        </div>
      </form>

      {items === null && <p className="text-secondary">Loading…</p>}
      {items !== null && items.length === 0 && (
        <EmptyState icon={isApiKey ? "key" : "plugin"} title={`No ${title.toLowerCase()} yet.`} />
      )}

      {items && items.length > 0 && (
        <div className="table-responsive">
          <table className="table align-middle">
            <caption className="visually-hidden">{title}</caption>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Key</th>
                <th scope="col">Last used</th>
                <th scope="col"><span className="visually-hidden">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className={item.revokedAt ? "opacity-50" : ""}>
                  <td>
                    {item.name}
                    <div className="small text-secondary font-monospace">{item.scopes.join(", ") || "no scopes"}</div>
                  </td>
                  <td className="font-monospace small">{item.prefix}</td>
                  <td className="small text-secondary">
                    {item.revokedAt ? "Revoked" : item.lastUsedAt ? new Date(item.lastUsedAt).toLocaleDateString() : "Never"}
                  </td>
                  <td className="text-end">
                    {!item.revokedAt && (
                      <button className="btn btn-sm btn-outline-danger" type="button" onClick={() => void revoke(item.id)}>
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
