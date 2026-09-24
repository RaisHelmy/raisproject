import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Locale, ModeDTO } from "@xuanzhi/shared-types";
import { api } from "@/services/api";
import { useAuth } from "@/services/auth";
import { useT, LOCALE_LABELS, pickName, pickDescription } from "@/i18n";
import { usePrefs } from "@/services/prefs";

const INTERESTS = [["iching", "易经", "I Ching"], ["fengshui", "风水", "Feng Shui"], ["taoism", "道家", "Taoism"], ["buddhism", "佛学", "Buddhism"], ["confucianism", "儒家", "Confucianism"], ["culture", "文化", "Chinese Culture"], ["classics", "经典", "Classical Texts"], ["wisdom", "智慧", "Life Wisdom"]] as const;
const MODE_FOR: Record<string, string> = { iching: "iching", fengshui: "fengshui", taoism: "taoist", buddhism: "buddhist", confucianism: "confucian", culture: "culture", classics: "general", wisdom: "culture" };

export default function OnboardingPage() {
  const { t, locale } = useT(); const { refresh, user } = useAuth(); const prefs = usePrefs(); const nav = useNavigate();
  const [step, setStep] = useState(0); const [interests, setInterests] = useState<string[]>([]); const [lang, setLang] = useState<Locale>(locale); const [modes, setModes] = useState<ModeDTO[]>([]); const [defaultMode, setDefaultMode] = useState<string | null>(null);
  useEffect(() => { if (user?.onboarding_completed) nav("/app"); api<ModeDTO[]>("/modes").then((r) => setModes(r.data)).catch(() => undefined); }, [user, nav]);
  const recommended = modes.filter((m) => interests.some((i) => MODE_FOR[i] === m.code) || m.code === "general");
  const finish = async () => { await api("/account/profile", { method: "PATCH", body: { interests, locale: lang, default_mode_id: defaultMode, onboarding_completed: true } }); prefs.setLocale(lang); await refresh(); nav("/app/chat"); };
  return (
    <div className="container py-5" style={{ maxWidth: 640 }}>
      <div className="text-center mb-4"><span className="xz-seal lg">玄</span><h1 className="h3 mt-3">{t("onboard.welcome")}</h1><div className="text-faint fs-13">{step + 1} / 3</div></div>
      <div className="card p-4">
        {step === 0 && (<><h2 className="h5 mb-3">{t("onboard.interests")}</h2><div className="row g-2">{INTERESTS.map(([k, zh, en]) => <div key={k} className="col-6 col-md-3"><button className={`xz-topic w-100 ${interests.includes(k) ? "border-primary" : ""}`} style={interests.includes(k) ? { borderColor: "var(--xz-cinnabar)", background: "var(--xz-cinnabar-soft)" } : undefined} onClick={() => setInterests((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]))}><span className="zh">{zh}</span><span className="fs-14">{en}</span></button></div>)}</div></>)}
        {step === 1 && (<><h2 className="h5 mb-3">{t("onboard.language")}</h2><div className="d-grid gap-2">{(Object.keys(LOCALE_LABELS) as Locale[]).map((l) => <button key={l} className={`btn ${lang === l ? "btn-primary" : "btn-outline-secondary"} btn-lg`} onClick={() => { setLang(l); prefs.setLocale(l); }}>{LOCALE_LABELS[l]}</button>)}</div></>)}
        {step === 2 && (<><h2 className="h5 mb-3">{t("onboard.modes")}</h2><div className="d-grid gap-2">{recommended.map((m) => <button key={m.id} className={`text-start card p-3 ${defaultMode === m.id ? "border-primary" : ""}`} style={defaultMode === m.id ? { borderColor: "var(--xz-cinnabar)" } : undefined} onClick={() => setDefaultMode(m.id)}><div className="d-flex align-items-center gap-2"><i className={`bi ${m.icon}`} style={{ color: "var(--xz-cinnabar)" }} /><span className="fw-medium">{pickName(m, lang)}</span>{m.is_advanced && <span className="badge badge-cinnabar ms-auto">Pro</span>}</div><div className="text-muted fs-14">{pickDescription(m, lang)}</div></button>)}</div></>)}
        <div className="d-flex justify-content-between mt-4"><button className="btn btn-ghost" onClick={() => (step === 0 ? finish() : setStep(step - 1))}>{step === 0 ? t("onboard.skip") : t("common.back")}</button>{step < 2 ? <button className="btn btn-primary" onClick={() => setStep(step + 1)}>{t("onboard.continue")}</button> : <button className="btn btn-primary" onClick={finish}>{t("onboard.finish")}</button>}</div>
      </div>
    </div>
  );
}
