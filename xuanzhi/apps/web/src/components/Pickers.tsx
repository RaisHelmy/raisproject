import type { ModeDTO, ModelDTO } from "@xuanzhi/shared-types";
import { useT, pickName, pickDescription } from "@/i18n";

export function ModelPicker({ models, value, onChange, onLocked }: { models: ModelDTO[]; value: string | null; onChange: (id: string) => void; onLocked: (m: ModelDTO) => void }) {
  const { t } = useT();
  const current = models.find((m) => m.id === value) ?? models.find((m) => m.is_default && m.available) ?? models.find((m) => m.available);
  return (
    <div className="dropdown">
      <button className="btn btn-ghost dropdown-toggle" data-bs-toggle="dropdown" type="button" onClick={(e) => { const menu = e.currentTarget.nextElementSibling; menu?.classList.toggle("show"); }} onBlur={(e) => { const menu = e.currentTarget.nextElementSibling; setTimeout(() => menu?.classList.remove("show"), 150); }}>
        <i className="bi bi-cpu me-1 text-faint" />{current?.name ?? t("chat.model")}
      </button>
      <ul className="dropdown-menu" style={{ minWidth: 300 }}>
        {models.map((m) => (
          <li key={m.id}>
            <button className={`dropdown-item d-flex align-items-start gap-2 py-2 ${m.id === current?.id ? "active" : ""}`} onClick={() => (m.available ? onChange(m.id) : onLocked(m))}>
              <i className={`bi ${m.available ? (m.id === current?.id ? "bi-check2" : "bi-dot") : "bi-lock"} mt-1`} />
              <span className="flex-grow-1"><span className="d-block">{m.name} <span className="badge badge-soft ms-1">{t(`tier.${m.tier}` as never)}</span></span><span className="d-block text-muted fs-13 text-wrap">{m.description ?? m.provider_name}</span></span>
              {!m.available && m.required_plan && <span className="badge badge-cinnabar">{t(`common.${m.required_plan}` as never)}</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ModePicker({ modes, value, onChange, onLocked }: { modes: ModeDTO[]; value: string | null; onChange: (id: string | null) => void; onLocked: (m: ModeDTO) => void }) {
  const { t, locale } = useT();
  const current = modes.find((m) => m.id === value) ?? null;
  return (
    <div className="dropdown">
      <button className="btn btn-ghost dropdown-toggle" type="button" onClick={(e) => e.currentTarget.nextElementSibling?.classList.toggle("show")} onBlur={(e) => { const menu = e.currentTarget.nextElementSibling; setTimeout(() => menu?.classList.remove("show"), 150); }}>
        <i className={`bi ${current?.icon ?? "bi-stars"} me-1 text-faint`} />{current ? pickName(current, locale) : t("chat.mode")}
      </button>
      <ul className="dropdown-menu" style={{ minWidth: 300 }}>
        <li><button className={`dropdown-item ${!current ? "active" : ""}`} onClick={() => onChange(null)}><i className="bi bi-dot me-1" />{t("profile.none")}</button></li>
        {modes.map((m) => (
          <li key={m.id}>
            <button className={`dropdown-item d-flex align-items-start gap-2 py-2 ${m.id === current?.id ? "active" : ""}`} onClick={() => (m.available !== false ? onChange(m.id) : onLocked(m))}>
              <i className={`bi ${m.available === false ? "bi-lock" : m.icon} mt-1`} />
              <span className="flex-grow-1"><span className="d-block">{pickName(m, locale)}</span><span className="d-block text-muted fs-13 text-wrap">{pickDescription(m, locale)}</span></span>
              {m.is_advanced && <span className="badge badge-cinnabar">Pro</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
