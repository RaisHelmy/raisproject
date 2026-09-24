import { useCallback, useEffect, useMemo, useState } from "react";
import { formatMYR } from "@raisai/shared";
import { api } from "../../lib/api";
import type { ModelDTO } from "../../lib/types";

interface Preference {
  modelId: string;
  favourite: boolean;
  lastUsedAt: string | null;
  useCount: number;
}

const GROUPS = [
  { tag: "recommended", label: "Recommended" },
  { tag: "fast", label: "Fast" },
  { tag: "quality", label: "Quality" },
  { tag: "cheap", label: "Cheap" },
  { tag: "cinematic", label: "Cinematic" },
  { tag: "experimental", label: "Experimental" },
] as const;

/**
 * Model choice with a price beside every option (§88, §92). Models are filtered
 * by capability, never by id, so a new model appears here with no code change.
 */
export function ModelSelector(props: {
  models: ModelDTO[];
  value: string | null;
  onChange: (modelId: string) => void;
  /** Capabilities the current request needs, e.g. image-input once a reference is attached. */
  requiredCapabilities?: string[];
}) {
  const [group, setGroup] = useState<string>("recommended");
  const [preferences, setPreferences] = useState<Preference[]>([]);
  const required = props.requiredCapabilities ?? [];

  const loadPreferences = useCallback(async () => {
    try {
      const r = await api<{ items: Preference[] }>("/models/preferences");
      setPreferences(r.items);
    } catch {
      // Favourites are a convenience. If they cannot be read the picker still
      // works, just without the personal groups.
      setPreferences([]);
    }
  }, []);

  useEffect(() => { void loadPreferences(); }, [loadPreferences]);

  const favourites = useMemo(
    () => new Set(preferences.filter((p) => p.favourite).map((p) => p.modelId)),
    [preferences],
  );
  const recent = useMemo(
    () => preferences.filter((p) => p.lastUsedAt).map((p) => p.modelId),
    [preferences],
  );

  const toggleFavourite = useCallback(async (modelId: string, next: boolean) => {
    setPreferences((prev) => {
      const without = prev.filter((p) => p.modelId !== modelId);
      const existing = prev.find((p) => p.modelId === modelId);
      return [...without, { modelId, favourite: next, lastUsedAt: existing?.lastUsedAt ?? null, useCount: existing?.useCount ?? 0 }];
    });
    try {
      await api(`/models/${modelId}/favourite`, { method: "PUT", body: JSON.stringify({ favourite: next }) });
    } catch {
      await loadPreferences();
    }
  }, [loadPreferences]);

  const compatible = useMemo(
    () => props.models.filter((m) => required.every((c) => m.capabilities.includes(c))),
    [props.models, required],
  );

  const visible = useMemo(() => {
    if (group === "all") return compatible;
    if (group === "mine") return compatible.filter((m) => favourites.has(m.id));
    if (group === "recent") {
      const order = new Map(recent.map((id, index) => [id, index]));
      return compatible
        .filter((m) => order.has(m.id))
        .sort((a, b) => order.get(a.id)! - order.get(b.id)!);
    }
    const inGroup = compatible.filter((m) => m.tags.includes(group));
    return inGroup.length > 0 ? inGroup : compatible;
  }, [compatible, group, favourites, recent]);

  // Personal groups appear only once they hold something, so a new account is
  // not shown two empty tabs (§75).
  const personalGroups = [
    ...(compatible.some((m) => favourites.has(m.id)) ? [{ tag: "mine", label: "My models" }] : []),
    ...(compatible.some((m) => recent.includes(m.id)) ? [{ tag: "recent", label: "Recently used" }] : []),
  ];
  const availableGroups = [...personalGroups, ...GROUPS.filter((g) => compatible.some((m) => m.tags.includes(g.tag)))];
  const excluded = props.models.length - compatible.length;
  const chosenIsIncompatible =
    props.value !== null && compatible.length > 0 && !compatible.some((m) => m.id === props.value);
  const chosen = props.models.find((m) => m.id === props.value) ?? null;

  return (
    <fieldset className="mb-3">
      <legend className="form-label fs-6">Model</legend>

      <div className="btn-group btn-group-sm flex-wrap mb-2" role="group" aria-label="Model groups">
        {availableGroups.map((g) => (
          <button
            key={g.tag}
            type="button"
            className={`btn ${group === g.tag ? "btn-primary" : "btn-outline-secondary"}`}
            onClick={() => setGroup(g.tag)}
            aria-pressed={group === g.tag}
          >
            {g.label}
          </button>
        ))}
        <button
          type="button"
          className={`btn ${group === "all" ? "btn-primary" : "btn-outline-secondary"}`}
          onClick={() => setGroup("all")}
          aria-pressed={group === "all"}
        >
          All models
        </button>
      </div>

      {/* Say what cannot be done and offer the way forward in the same breath (§91, §112). */}
      {chosenIsIncompatible && chosen && (
        <div className="alert alert-warning py-2 small" role="alert">
          <strong>{chosen.displayName}</strong> does not support what you have added.
          <button
            type="button"
            className="btn btn-sm btn-warning ms-2"
            onClick={() => props.onChange(compatible[0]!.id)}
          >
            Switch to {compatible[0]!.displayName}
          </button>
        </div>
      )}

      {excluded > 0 && !chosenIsIncompatible && (
        <p className="small text-secondary mb-2">
          {excluded} model{excluded === 1 ? "" : "s"} hidden because they do not support what you added.
        </p>
      )}

      <div className="list-group">
        {visible.map((model) => (
          <label key={model.id} className={`list-group-item list-group-item-action d-flex gap-2 ${props.value === model.id ? "active" : ""}`}>
            <input
              className="form-check-input flex-shrink-0 mt-1"
              type="radio"
              name="model"
              checked={props.value === model.id}
              onChange={() => props.onChange(model.id)}
            />
            <span className="flex-grow-1">
              <span className="d-flex justify-content-between align-items-baseline gap-2">
                <span className="fw-semibold">{model.displayName}</span>
                <span className="d-flex align-items-baseline gap-2">
                  {model.typicalCostSen !== undefined && (
                    <span className="badge text-bg-secondary">
                      {model.typicalCostApproximate ? "~" : ""}{formatMYR(model.typicalCostSen)}
                    </span>
                  )}
                  <button
                    type="button"
                    className="btn btn-sm btn-link p-0 border-0 text-decoration-none"
                    aria-pressed={favourites.has(model.id)}
                    aria-label={favourites.has(model.id) ? `Remove ${model.displayName} from my models` : `Add ${model.displayName} to my models`}
                    onClick={(e) => {
                      // The row is a label, so a click here would otherwise
                      // also select the model.
                      e.preventDefault();
                      e.stopPropagation();
                      void toggleFavourite(model.id, !favourites.has(model.id));
                    }}
                  >
                    <i className={`bi bi-star${favourites.has(model.id) ? "-fill text-warning" : ""}`} aria-hidden="true" />
                  </button>
                </span>
              </span>
              <span className={`d-block small ${props.value === model.id ? "" : "text-secondary"}`}>{model.description}</span>
            </span>
          </label>
        ))}
      </div>
      {visible.length === 0 && (
        <p className="text-secondary small mb-0">No model supports this combination yet. Remove a reference image and try again.</p>
      )}
    </fieldset>
  );
}
