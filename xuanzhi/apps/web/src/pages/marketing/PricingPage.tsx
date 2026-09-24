import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { PlanDTO } from "@xuanzhi/shared-types";
import { api } from "@/services/api";
import { useAuth } from "@/services/auth";
import { useT } from "@/i18n";
import { useToast } from "@/services/toast";
import { Skeleton } from "@/components/ui";

export default function PricingPage() {
  const { t } = useT(); const { user, me } = useAuth(); const nav = useNavigate(); const toast = useToast();
  const [plans, setPlans] = useState<PlanDTO[] | null>(null); const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { api<PlanDTO[]>("/plans").then((r) => setPlans(r.data)).catch(() => setPlans([])); }, []);
  const current = me?.entitlements.plan.code;
  const choose = async (p: PlanDTO) => {
    if (!user) { nav(`/register?plan=${p.code}`); return; }
    if (p.code === "enterprise") { window.location.href = "mailto:sales@xuanzhi.ai?subject=Enterprise"; return; }
    if (p.code === "free") { nav("/app"); return; }
    setBusy(p.id);
    try { const r = await api<{ url: string }>("/billing/checkout", { body: { plan_id: p.id } }); window.location.href = r.data.url; } catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  };
  return (
    <div className="container py-5 xz-pricing">
      <div className="text-center mb-5"><h1 className="h2">{t("pricing.title")}</h1><p className="text-muted">{t("pricing.subtitle")}</p></div>
      {!plans ? <div className="row g-3">{[1, 2, 3, 4].map((i) => <div key={i} className="col-md-6 col-lg-3"><Skeleton h={320} /></div>)}</div> : (
        <div className="row g-3">
          {plans.map((p) => (
            <div key={p.id} className="col-md-6 col-lg-3">
              <div className={`card h-100 p-4 ${p.code === "pro" ? "featured" : ""}`}>
                {p.code === "pro" && <span className="badge badge-cinnabar align-self-start mb-2">{t("pricing.popular")}</span>}
                <h4 className="mb-0">{p.name}</h4><div className="text-muted fs-14 mb-3">{p.description}</div>
                <div className="mb-3">{p.code === "enterprise" ? <span className="xz-price">{t("pricing.custom")}</span> : <><span className="xz-price">${p.price_monthly}</span><span className="text-muted">{t("pricing.month")}</span></>}</div>
                <ul className="list-unstyled fs-14 flex-grow-1">{p.features.map((f) => <li key={f} className="mb-2"><i className="bi bi-check2 me-2" style={{ color: "var(--xz-jade)" }} />{f}</li>)}</ul>
                {current === p.code ? <button className="btn btn-outline-secondary w-100" disabled>{t("pricing.current")}</button>
                  : <button className={`btn w-100 ${p.code === "pro" ? "btn-primary" : "btn-outline-primary"}`} disabled={busy === p.id} onClick={() => choose(p)}>{p.code === "enterprise" ? t("pricing.contact") : p.code === "free" ? t("pricing.free_cta") : t("pricing.choose", { plan: p.name })}</button>}
              </div>
            </div>
          ))}
        </div>
      )}
      {user && me && !me.features.stripe && <p className="text-center text-faint fs-13 mt-4">{t("sub.stripe_off")} <Link to="/app/subscription">{t("nav.subscription")}</Link></p>}
    </div>
  );
}
