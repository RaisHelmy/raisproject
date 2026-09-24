import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AppError } from "@raisai/shared";
import { api } from "../../lib/api";
import { EmptyState } from "../../components/EmptyState";

interface Webhook {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  createdAt: string;
}

interface Delivery {
  id: string;
  event: string;
  status: "pending" | "delivered" | "failed";
  attempts: number;
  lastError: string | null;
  createdAt: string;
}

/**
 * Outbound webhooks and what happened to them (§62).
 *
 * The deliveries log is the point of the page. A webhook that silently fails
 * is worse than no webhook, so every attempt and the reason it failed is
 * visible rather than buried in a log nobody can read.
 */
export function WebhooksPage() {
  const [items, setItems] = useState<Webhook[] | null>(null);
  const [available, setAvailable] = useState<string[]>([]);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>([]);
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[] | null>(null);

  const load = useCallback(async () => {
    const list = await api<{ items: Webhook[]; availableEvents: string[] }>("/webhooks");
    setItems(list.items);
    setAvailable(list.availableEvents);
  }, []);

  useEffect(() => {
    load().catch(() => setItems([]));
  }, [load]);

  useEffect(() => {
    if (!open) return;
    setDeliveries(null);
    api<{ items: Delivery[] }>(`/webhooks/${open}/deliveries`)
      .then((r) => setDeliveries(r.items))
      .catch(() => setDeliveries([]));
  }, [open]);

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await api<Webhook & { secret: string }>("/webhooks", {
        method: "POST",
        body: JSON.stringify({ url, events }),
      });
      setSecret(created.secret);
      setUrl("");
      setEvents([]);
      await load();
    } catch (err) {
      setError(err instanceof AppError ? [err.message, err.action].filter(Boolean).join(" ") : "That endpoint could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this endpoint? It will stop receiving events.")) return;
    await api(`/webhooks/${id}`, { method: "DELETE" });
    if (open === id) setOpen(null);
    await load();
  }

  return (
    <section style={{ maxWidth: 820 }}>
      <h1 className="h3 mb-1">Webhooks</h1>
      <p className="text-secondary mb-4">
        RaisAI posts to your endpoint when something finishes. Every request is signed so you can prove it came from us.
      </p>

      {secret && (
        <div className="alert alert-success" role="alert">
          <h2 className="h6">Copy this signing secret now</h2>
          <p className="small mb-2">This is the only time it will be shown. Check it against the X-RaisAI-Signature header.</p>
          <code className="d-block user-select-all p-2 bg-body-tertiary rounded text-break">{secret}</code>
          <button className="btn btn-sm btn-outline-secondary mt-2" type="button" onClick={() => setSecret(null)}>
            I have copied it
          </button>
        </div>
      )}

      <form className="card mb-4" onSubmit={create}>
        <div className="card-body">
          <h2 className="h6 mb-3">New endpoint</h2>
          {error && <div className="alert alert-danger py-2 small" role="alert">{error}</div>}

          <div className="mb-3">
            <label className="form-label" htmlFor="hook-url">Endpoint address</label>
            <input id="hook-url" className="form-control" type="url" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/raisai" />
          </div>

          <fieldset className="mb-3">
            <legend className="form-label fs-6">Events</legend>
            <div className="d-flex flex-wrap gap-3">
              {available.map((event) => (
                <div className="form-check" key={event}>
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id={`event-${event}`}
                    checked={events.includes(event)}
                    onChange={(e) =>
                      setEvents((prev) => (e.target.checked ? [...prev, event] : prev.filter((x) => x !== event)))
                    }
                  />
                  <label className="form-check-label small" htmlFor={`event-${event}`}>{event}</label>
                </div>
              ))}
            </div>
          </fieldset>

          <button className="btn btn-primary" type="submit" disabled={busy || events.length === 0}>
            {busy ? "Saving…" : "Add endpoint"}
          </button>
        </div>
      </form>

      {items?.length === 0 && (
        <EmptyState icon="broadcast" title="No endpoints yet." description="Add one to be told when a generation finishes." />
      )}

      <div className="vstack gap-3">
        {items?.map((webhook) => (
          <article className="card" key={webhook.id}>
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-start gap-3">
                <div className="min-w-0">
                  <h2 className="h6 mb-1 text-break">{webhook.url}</h2>
                  <p className="small text-secondary mb-0">{webhook.events.join(", ")}</p>
                </div>
                <div className="d-flex gap-2 flex-shrink-0">
                  <button
                    className="btn btn-sm btn-outline-secondary"
                    type="button"
                    aria-expanded={open === webhook.id}
                    onClick={() => setOpen(open === webhook.id ? null : webhook.id)}
                  >
                    Deliveries
                  </button>
                  <button className="btn btn-sm btn-outline-danger" type="button" onClick={() => remove(webhook.id)}>Delete</button>
                </div>
              </div>

              {open === webhook.id && (
                <div className="mt-3">
                  {deliveries === null && <p className="small text-secondary mb-0">Loading…</p>}
                  {deliveries?.length === 0 && <p className="small text-secondary mb-0">Nothing has been sent to this endpoint yet.</p>}
                  {deliveries && deliveries.length > 0 && (
                    <div className="table-responsive">
                      <table className="table table-sm align-middle mb-0">
                        <thead>
                          <tr>
                            <th scope="col">Event</th>
                            <th scope="col">Result</th>
                            <th scope="col">Attempts</th>
                            <th scope="col">When</th>
                          </tr>
                        </thead>
                        <tbody>
                          {deliveries.map((delivery) => (
                            <tr key={delivery.id}>
                              <td className="small">{delivery.event}</td>
                              <td className="small">
                                <DeliveryStatus status={delivery.status} />
                                {delivery.lastError && <div className="text-danger">{delivery.lastError}</div>}
                              </td>
                              <td className="small">{delivery.attempts}</td>
                              <td className="small text-secondary">{new Date(delivery.createdAt).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

/** Icon and word together: colour alone would not carry the meaning (§113). */
function DeliveryStatus(props: { status: Delivery["status"] }) {
  const look = {
    delivered: { icon: "check-circle", cls: "text-success", label: "Delivered" },
    failed: { icon: "x-circle", cls: "text-danger", label: "Failed" },
    pending: { icon: "hourglass-split", cls: "text-secondary", label: "Waiting" },
  }[props.status];
  return (
    <span className={look.cls}>
      <i className={`bi bi-${look.icon} me-1`} aria-hidden="true" />
      {look.label}
    </span>
  );
}
