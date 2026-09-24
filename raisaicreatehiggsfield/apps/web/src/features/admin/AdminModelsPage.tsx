import { useCallback, useEffect, useState } from "react";
import { AppError, formatMYR, MODEL_TAGS, PRICING_UNITS, type ModelTag, type PricingUnit } from "@raisai/shared";
import { api } from "../../lib/api";
import { useAuth } from "../auth/AuthContext";

interface AdminModel {
  id: string;
  displayName: string;
  description: string;
  category: string;
  task: string;
  capabilities: string[];
  tags: ModelTag[];
  status: "discovered" | "configured" | "enabled" | "deprecated";
  hosting: string;
  version: string;
  sortOrder: number;
}

interface Pricing {
  unit: PricingUnit;
  providerUsd: Record<string, number> & { source?: string; verifiedOn?: string };
  markupPercent: number;
  minimumChargeSen: number;
  roundingSen: number;
  fxRateUsdMyr: number;
  effectiveFrom: string;
}

type Preview = { estimatedSen: number } | { error: string };

/**
 * Model management (§124, §125).
 *
 * The lifecycle is the point: a model is discovered, then priced, then tested,
 * and only then can it be enabled. The gates live in the service, so this page
 * shows what is still missing rather than trying to enforce anything itself.
 */
export function AdminModelsPage() {
  const { user } = useAuth();
  const [models, setModels] = useState<AdminModel[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | AdminModel["status"]>("all");
  const [category, setCategory] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  const load = useCallback(async () => {
    const list = await api<{ items: AdminModel[] }>("/admin/models");
    setModels(list.items);
  }, []);

  useEffect(() => {
    load().catch(() => setModels([]));
  }, [load]);

  if (user && !user.isAdmin) {
    return <p className="text-secondary">This page is for administrators.</p>;
  }

  async function act(run: () => Promise<string>) {
    setMessage(null);
    try {
      setMessage({ tone: "success", text: await run() });
      await load();
    } catch (err) {
      setMessage({
        tone: "danger",
        text: err instanceof AppError ? [err.message, err.action].filter(Boolean).join(" ") : "That did not work.",
      });
    }
  }

  const term = query.trim().toLowerCase();
  const shown =
    models
      ?.filter((model) => filter === "all" || model.status === filter)
      .filter((model) => category === "all" || model.category === category)
      .filter(
        (model) =>
          term === "" ||
          model.id.toLowerCase().includes(term) ||
          model.displayName.toLowerCase().includes(term) ||
          model.description.toLowerCase().includes(term),
      ) ?? null;

  const categories = [...new Set(models?.map((m) => m.category) ?? [])].sort();

  return (
    <section>
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-1">
        <div><p className="lp-eyebrow mb-2">Control plane</p><h1 className="display-6 fw-bold mb-0">Models</h1></div>
        <div className="d-flex gap-2">
          <button
            className="btn btn-sm btn-outline-secondary"
            type="button"
            onClick={() => act(async () => {
              const r = await api<{ added: number; describedAgain: number; total: number }>(
                "/admin/models/import", { method: "POST" },
              );
              return `Catalog loaded. ${r.added} new of ${r.total}, ${r.describedAgain} descriptions refreshed.`;
            })}
          >
            Load full catalog
          </button>
          <button
            className="btn btn-sm btn-outline-secondary"
            type="button"
            onClick={() => act(async () => {
              const r = await api<{
                discovered: number; updated: number; priced: number;
                pricingSkipped: { modelId: string; reason: string }[]; skippedReason?: string;
              }>("/admin/models/sync", { method: "POST" });
              if (r.skippedReason) throw new AppError("invalid_input", r.skippedReason);
              const skipped = r.pricingSkipped.length
                ? ` ${r.pricingSkipped.length} could not be priced: ${r.pricingSkipped.slice(0, 3).map((s) => `${s.modelId.split("/").pop()} (${s.reason})`).join("; ")}${r.pricingSkipped.length > 3 ? "…" : ""}.`
                : "";
              return `Synced from your account. ${r.discovered} new, ${r.updated} updated, ${r.priced} priced from live rates.${skipped}`;
            })}
          >
            Sync from account
          </button>
          <button
            className="btn btn-sm btn-outline-secondary"
            type="button"
            onClick={() => act(async () => {
              const r = await api<{ seeded: number; enabled: number; skippedPricing: number }>(
                "/admin/models/seed", { method: "POST" },
              );
              return `Seeded ${r.seeded} models, ${r.enabled} of them enabled.`;
            })}
          >
            Seed curated
          </button>
        </div>
      </div>
      <p className="text-secondary mb-3">
        A model has to be priced and pass a test run before it can be offered to customers.
        Sync from account reads each model's current rate from Cloudflare, so prices do not have to be typed.
      </p>

      {message && <div className={`alert alert-${message.tone}`} role="alert">{message.text}</div>}

      <div className="btn-group btn-group-sm mb-3" role="group" aria-label="Filter by status">
        {(["all", "discovered", "configured", "enabled", "deprecated"] as const).map((status) => (
          <button
            key={status}
            type="button"
            className={`btn btn-outline-secondary ${filter === status ? "active" : ""}`}
            aria-pressed={filter === status}
            onClick={() => setFilter(status)}
          >
            {status === "all" ? "All" : status}
          </button>
        ))}
      </div>

      <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
        <label className="visually-hidden" htmlFor="model-search">Search models</label>
        <input
          id="model-search"
          type="search"
          className="form-control form-control-sm"
          style={{ maxWidth: 280 }}
          placeholder="Search the catalog"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="btn-group btn-group-sm" role="group" aria-label="Filter by kind">
          <button type="button" className={`btn btn-outline-secondary ${category === "all" ? "active" : ""}`} aria-pressed={category === "all"} onClick={() => setCategory("all")}>
            All kinds
          </button>
          {categories.map((c) => (
            <button key={c} type="button" className={`btn btn-outline-secondary ${category === c ? "active" : ""}`} aria-pressed={category === c} onClick={() => setCategory(c)}>
              {c}
            </button>
          ))}
        </div>
        {shown && models && (
          <span className="small text-secondary">
            {shown.length} of {models.length}
          </span>
        )}
      </div>

      {shown?.length === 0 && <p className="text-secondary">Nothing matches.</p>}

      <div className="vstack gap-2">
        {shown?.map((model) => (
          <article className="card" key={model.id}>
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap">
                <div className="min-w-0">
                  <h2 className="h6 mb-1">
                    {model.displayName} <StatusBadge status={model.status} />
                  </h2>
                  <p className="small text-secondary mb-1 text-break font-monospace">{model.id}</p>
                  <p className="small text-secondary mb-0">
                    {model.category} · {model.capabilities.join(", ")}
                  </p>
                </div>
                <div className="d-flex gap-2 flex-shrink-0">
                  <button
                    className="btn btn-sm btn-outline-secondary"
                    type="button"
                    aria-expanded={openId === model.id}
                    onClick={() => setOpenId(openId === model.id ? null : model.id)}
                  >
                    {openId === model.id ? "Close" : "Configure"}
                  </button>
                  <button
                    className="btn btn-sm btn-outline-secondary"
                    type="button"
                    onClick={() => act(async () => {
                      const r = await api<{ ok: boolean; message: string; durationMs: number }>(
                        `/admin/models/${model.id}/test`, { method: "POST" },
                      );
                      if (!r.ok) throw new AppError("invalid_input", r.message);
                      return `${model.displayName} passed in ${r.durationMs} ms.`;
                    })}
                  >
                    Test
                  </button>
                  {model.status === "enabled" ? (
                    <button
                      className="btn btn-sm btn-outline-danger"
                      type="button"
                      onClick={() => act(async () => {
                        await api(`/admin/models/${model.id}/status`, { method: "PUT", body: JSON.stringify({ status: "deprecated" }) });
                        return `${model.displayName} is no longer offered.`;
                      })}
                    >
                      Retire
                    </button>
                  ) : (
                    <button
                      className="btn btn-sm btn-primary"
                      type="button"
                      onClick={() => act(async () => {
                        await api(`/admin/models/${model.id}/status`, { method: "PUT", body: JSON.stringify({ status: "enabled" }) });
                        return `${model.displayName} is now offered to customers.`;
                      })}
                    >
                      Enable
                    </button>
                  )}
                </div>
              </div>

              {openId === model.id && <ModelEditor model={model} onSaved={load} />}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function StatusBadge(props: { status: AdminModel["status"] }) {
  const look = {
    enabled: "text-bg-success",
    configured: "text-bg-info",
    discovered: "text-bg-secondary",
    deprecated: "text-bg-warning",
  }[props.status];
  return <span className={`badge ${look} align-middle`}>{props.status}</span>;
}

/** Pricing and presentation for one model, with what a customer would pay. */
function ModelEditor(props: { model: AdminModel; onSaved: () => Promise<void> }) {
  const [pricing, setPricing] = useState<Pricing | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [unit, setUnit] = useState<PricingUnit>("flat");
  const [ratesText, setRatesText] = useState("{}");
  const [markup, setMarkup] = useState(20);
  const [tags, setTags] = useState<ModelTag[]>(props.model.tags);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadPricing = useCallback(async () => {
    const r = await api<{ pricing: Pricing | null; preview: Preview }>(`/admin/models/${props.model.id}/pricing`);
    setPricing(r.pricing);
    setPreview(r.preview);
    if (r.pricing) {
      setUnit(r.pricing.unit);
      const { source: _s, verifiedOn: _v, ...rates } = r.pricing.providerUsd;
      setRatesText(JSON.stringify(rates, null, 2));
      setMarkup(r.pricing.markupPercent);
    }
  }, [props.model.id]);

  useEffect(() => {
    loadPricing().catch(() => setPricing(null));
  }, [loadPricing]);

  async function savePricing() {
    setBusy(true);
    setError(null);
    try {
      const providerUsd = JSON.parse(ratesText) as Record<string, number>;
      await api(`/admin/models/${props.model.id}/pricing`, {
        method: "PUT",
        body: JSON.stringify({ unit, providerUsd, markupPercent: markup }),
      });
      await loadPricing();
      await props.onSaved();
    } catch (err) {
      setError(
        err instanceof AppError ? [err.message, err.action].filter(Boolean).join(" ")
        : err instanceof SyntaxError ? "The rates must be valid JSON."
        : "Pricing could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveTags(next: ModelTag[]) {
    setTags(next);
    await api(`/admin/models/${props.model.id}`, { method: "PATCH", body: JSON.stringify({ tags: next }) });
    await props.onSaved();
  }

  return (
    <div className="border-top mt-3 pt-3">
      {error && <div className="alert alert-danger py-2 small" role="alert">{error}</div>}

      <div className="row g-3">
        <div className="col-md-4">
          <label className="form-label" htmlFor={`unit-${props.model.id}`}>Priced by</label>
          <select id={`unit-${props.model.id}`} className="form-select" value={unit} onChange={(e) => setUnit(e.target.value as PricingUnit)}>
            {PRICING_UNITS.map((value) => <option key={value}>{value}</option>)}
          </select>
        </div>
        <div className="col-md-4">
          <label className="form-label" htmlFor={`markup-${props.model.id}`}>Markup %</label>
          <input
            id={`markup-${props.model.id}`}
            className="form-control"
            type="number"
            min={0}
            max={500}
            value={markup}
            onChange={(e) => setMarkup(Number(e.target.value))}
          />
        </div>
        <div className="col-md-4">
          <span className="form-label d-block">Customer pays</span>
          <p className="mb-0 fs-5">
            {preview && "estimatedSen" in preview ? formatMYR(preview.estimatedSen) : <span className="small text-secondary">{preview && "error" in preview ? preview.error : "—"}</span>}
          </p>
          <span className="small text-secondary">for a typical request</span>
        </div>
        <div className="col-12">
          <label className="form-label" htmlFor={`rates-${props.model.id}`}>Provider rates, USD</label>
          <textarea
            id={`rates-${props.model.id}`}
            className="form-control font-monospace"
            rows={4}
            value={ratesText}
            onChange={(e) => setRatesText(e.target.value)}
          />
          <div className="form-text">
            What the provider charges, before markup. Never shown to customers.
            {pricing && ` Current rate in force since ${new Date(pricing.effectiveFrom).toLocaleDateString()}.`}
            {pricing?.providerUsd.source === "cloudflare-api" && " Read from your Cloudflare account; refreshed on each sync."}
            {pricing && pricing.providerUsd.source !== "cloudflare-api" && " Entered by hand; sync will not change it."}
          </div>
        </div>
      </div>

      <button className="btn btn-primary btn-sm mt-3" type="button" onClick={savePricing} disabled={busy}>
        {busy ? "Saving…" : "Save pricing"}
      </button>

      <fieldset className="mt-4">
        <legend className="form-label fs-6">Shown to customers as</legend>
        <div className="d-flex flex-wrap gap-3">
          {MODEL_TAGS.map((tag) => (
            <div className="form-check" key={tag}>
              <input
                className="form-check-input"
                type="checkbox"
                id={`tag-${props.model.id}-${tag}`}
                checked={tags.includes(tag)}
                onChange={(e) => saveTags(e.target.checked ? [...tags, tag] : tags.filter((t) => t !== tag))}
              />
              <label className="form-check-label small" htmlFor={`tag-${props.model.id}-${tag}`}>{tag}</label>
            </div>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
