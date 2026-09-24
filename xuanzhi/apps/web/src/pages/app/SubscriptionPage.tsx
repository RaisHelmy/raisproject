import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { SubscriptionDTO } from "@xuanzhi/shared-types";
import { api } from "@/services/api";
import { useAuth } from "@/services/auth";
import { useT } from "@/i18n";
import { useToast } from "@/services/toast";
import { Skeleton, fmtDate } from "@/components/ui";

export default function SubscriptionPage() {
  const { t, locale } = useT(); const { me, refresh } = useAuth(); const toast = useToast(); const [sp] = useSearchParams();
  const [sub, setSub] = useState<(SubscriptionDTO & { source: string }) | null>(null);
  useEffect(() => { api<typeof sub>("/billing/subscription").then((r) => setSub(r.data)).catch((e) => toast.error((e as Error).message)); if (sp.get("checkout") === "success") { toast.success("Thank you! Your plan is being activated."); void refresh(); } }, [sp, toast, refresh]);
  const ent = me?.entitlements;
  const Bar = ({ used, limit }: { used: number; limit: number | null }) => limit === null ? <span className="badge badge-jade">{t("sub.unlimited")}</span> : <div><div className="d-flex justify-content-between fs-13 text-muted"><span>{used} / {limit}</span></div><div className="progress" style={{ height: 6 }}><div className="progress-bar" style={{ width: `${Math.min(100, (used / limit) * 100)}%` }} /></div></div>;
  return (
    <div className="xz-page" style={{ maxWidth: 760 }}>
      <h1 className="h2 mb-3">{t("sub.title")}</h1>
      {!sub || !ent ? <Skeleton h={160} /> : (<>
        <div className="card p-4 mb-3">
          <div className="d-flex align-items-center gap-3"><span className="xz-seal lg">玄</span><div><div className="text-muted fs-14">{t("sub.current")}{sub.source === "organization" ? ` (${t("sub.org")})` : ""}</div><div className="h3 mb-0">{sub.plan.name}</div></div>
            <div className="ms-auto text-end fs-14 text-muted">{sub.managed_by === "admin" ? t("sub.managed_admin") : sub.current_period_end ? `${sub.cancel_at_period_end ? t("sub.cancels") : t("sub.renews")} ${fmtDate(sub.current_period_end, locale)}` : null}</div></div>
          <div className="row mt-4 g-3"><div className="col-md-6"><div className="fs-14 fw-medium mb-1">{t("sub.messages")} · {t("sub.usage_today")}</div><Bar used={ent.messages_used_today} limit={ent.messages_remaining_today === null ? null : ent.messages_used_today + ent.messages_remaining_today} /></div>
            <div className="col-md-6"><div className="fs-14 fw-medium mb-1">{t("sub.searches")} · {t("sub.usage_today")}</div><Bar used={ent.knowledge_searches_used_today} limit={ent.knowledge_searches_remaining_today === null ? null : ent.knowledge_searches_used_today + ent.knowledge_searches_remaining_today} /></div></div>
          <ul className="list-unstyled fs-14 mt-4 mb-0 row">{sub.plan.features.map((f) => <li key={f} className="col-md-6 mb-1"><i className="bi bi-check2 me-2" style={{ color: "var(--xz-jade)" }} />{f}</li>)}</ul>
          <div className="d-flex gap-2 mt-4 flex-wrap">
            <Link to="/pricing" className="btn btn-primary">{t("sub.upgrade")}</Link>
            {sub.stripe_configured && sub.managed_by === "stripe" && <button className="btn btn-outline-secondary" onClick={async () => { try { const r = await api<{ url: string }>("/billing/portal", { body: {} }); window.location.href = r.data.url; } catch (e) { toast.error((e as Error).message); } }}>{t("sub.manage")}</button>}
          </div>
          {!sub.stripe_configured && <div className="text-faint fs-13 mt-3">{t("sub.stripe_off")}</div>}
        </div>
      </>)}
    </div>
  );
}
