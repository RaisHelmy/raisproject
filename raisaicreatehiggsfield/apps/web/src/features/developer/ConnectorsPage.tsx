import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AppError } from "@raisai/shared";
import { api } from "../../lib/api";
import { EmptyState } from "../../components/EmptyState";

interface Connector {
  id: string;
  type: "mcp_server" | "http_auth";
  name: string;
  url: string;
  headerName: string | null;
  hasToken: boolean;
  createdAt: string;
}

interface TestResult {
  ok: boolean;
  reason?: string;
  action?: string;
  tools?: { name: string; description: string | null }[];
}

/**
 * Saved connections to servers outside RaisAI (§10, §137).
 *
 * A canvas node points at a connection by id rather than carrying the token
 * itself, so a canvas can be exported, shared or published as a template
 * without the credential travelling with it.
 */
export function ConnectorsPage() {
  const [items, setItems] = useState<Connector[] | null>(null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [type, setType] = useState<Connector["type"]>("mcp_server");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tested, setTested] = useState<Record<string, TestResult | "testing">>({});

  const load = useCallback(async () => {
    const list = await api<{ items: Connector[] }>("/connectors");
    setItems(list.items);
  }, []);

  useEffect(() => {
    load().catch(() => setItems([]));
  }, [load]);

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/connectors", {
        method: "POST",
        body: JSON.stringify({ type, name, url, token: token || undefined }),
      });
      setName("");
      setUrl("");
      setToken("");
      await load();
    } catch (err) {
      setError(err instanceof AppError ? [err.message, err.action].filter(Boolean).join(" ") : "That connection could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function test(id: string) {
    setTested((prev) => ({ ...prev, [id]: "testing" }));
    try {
      const result = await api<TestResult>(`/connectors/${id}/test`, { method: "POST" });
      setTested((prev) => ({ ...prev, [id]: result }));
    } catch (err) {
      setTested((prev) => ({
        ...prev,
        [id]: { ok: false, reason: err instanceof AppError ? err.message : "The test could not run." },
      }));
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this connection? Canvases that use it will stop working.")) return;
    await api(`/connectors/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <section className="workspace-page" style={{ maxWidth: 900 }}>
      <div className="workspace-page-head"><div><p className="lp-eyebrow mb-2">Integrations</p><h1 className="display-6 fw-bold mb-2">Connectors</h1><p className="text-secondary mb-0">Bring your production stack into one governed creative canvas.</p></div><span className="badge rounded-pill text-bg-warning"><i className="bi bi-plug me-1" />SCIM & SSO · coming soon</span></div>
      <p className="text-secondary mb-4">
        Servers your canvases can reach. The token stays here, so a canvas that uses a connection can still be shared.
      </p>

      <form className="card mb-4" onSubmit={create}>
        <div className="card-body">
          <h2 className="h6 mb-3">New connection</h2>
          {error && <div className="alert alert-danger py-2 small" role="alert">{error}</div>}

          <div className="row g-3">
            <div className="col-sm-6">
              <label className="form-label" htmlFor="con-name">Name</label>
              <input id="con-name" className="form-control" value={name} required onChange={(e) => setName(e.target.value)} placeholder="My tool server" />
            </div>
            <div className="col-sm-6">
              <label className="form-label" htmlFor="con-type">Kind</label>
              <select id="con-type" className="form-select" value={type} onChange={(e) => setType(e.target.value as Connector["type"])}>
                <option value="mcp_server">MCP server</option>
                <option value="http_auth">HTTP service</option>
              </select>
            </div>
            <div className="col-12">
              <label className="form-label" htmlFor="con-url">Address</label>
              <input id="con-url" className="form-control" type="url" value={url} required onChange={(e) => setUrl(e.target.value)} placeholder="https://tools.example.com/mcp" />
            </div>
            <div className="col-12">
              <label className="form-label" htmlFor="con-token">Token</label>
              <input id="con-token" className="form-control" type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Leave empty for an open server" />
              <div className="form-text">Stored encrypted. It is never shown again and never sent to the browser.</div>
            </div>
          </div>

          <button className="btn btn-primary mt-3" type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save connection"}
          </button>
        </div>
      </form>

      {items?.length === 0 && (
        <EmptyState
          icon="plug"
          title="No connections yet."
          description="Add an MCP server and canvases can call its tools."
        />
      )}

      <div className="vstack gap-3">
        {items?.map((connector) => {
          const result = tested[connector.id];
          return (
            <article className="card" key={connector.id}>
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-start gap-3">
                  <div className="min-w-0">
                    <h2 className="h6 mb-1">{connector.name}</h2>
                    <p className="small text-secondary mb-1 text-break">{connector.url}</p>
                    <p className="small text-secondary mb-0">
                      {connector.type === "mcp_server" ? "MCP server" : "HTTP service"}
                      {connector.hasToken ? " · token saved" : " · no token"}
                    </p>
                  </div>
                  <div className="d-flex gap-2 flex-shrink-0">
                    <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => test(connector.id)} disabled={result === "testing"}>
                      {result === "testing" ? "Testing…" : "Test"}
                    </button>
                    <button className="btn btn-sm btn-outline-danger" type="button" onClick={() => remove(connector.id)}>Delete</button>
                  </div>
                </div>

                {result && result !== "testing" && (
                  <div className={`alert py-2 small mt-3 mb-0 ${result.ok ? "alert-success" : "alert-danger"}`} role="status">
                    {result.ok ? (
                      result.tools?.length ? (
                        <>
                          <strong>{result.tools.length} tools available.</strong>{" "}
                          {result.tools.map((tool) => tool.name).join(", ")}
                        </>
                      ) : (
                        <>Connected, but the server offers no tools.</>
                      )
                    ) : (
                      <>{result.reason} {result.action}</>
                    )}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
