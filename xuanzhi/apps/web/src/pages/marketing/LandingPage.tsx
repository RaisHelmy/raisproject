import { Link } from "react-router-dom";
import { Mountains } from "@/components/Brand";
import { useT } from "@/i18n";
import { useAuth } from "@/services/auth";

const TOPICS: { zh: string; key: "topic.iching" | "topic.fengshui" | "topic.bazi" | "topic.taoism" | "topic.confucianism" | "topic.buddhism" | "topic.classics" | "topic.wisdom"; mode: string; q: string }[] = [
  { zh: "易经", key: "topic.iching", mode: "iching", q: "What does the I Ching say about starting a business?" }, { zh: "风水", key: "topic.fengshui", mode: "fengshui", q: "How does traditional Feng Shui evaluate the position of a front door?" },
  { zh: "八字", key: "topic.bazi", mode: "general", q: "How does a Ba Zi chart use the five elements?" }, { zh: "道家", key: "topic.taoism", mode: "taoist", q: "What does wu wei mean in the Dao De Jing?" },
  { zh: "儒家", key: "topic.confucianism", mode: "confucian", q: "What is ren (仁) in the Analects?" }, { zh: "佛学", key: "topic.buddhism", mode: "buddhist", q: "How does Chan Buddhism understand emptiness?" },
  { zh: "经典", key: "topic.classics", mode: "general", q: "Which classical texts should a beginner read first?" }, { zh: "智慧", key: "topic.wisdom", mode: "culture", q: "What Chinese proverbs guide patience in difficult times?" },
];
export { TOPICS };

export default function LandingPage() {
  const { t } = useT(); const { user } = useAuth();
  const start = (q?: string, mode?: string) => `${user ? "/app/chat" : "/register"}${q ? `?q=${encodeURIComponent(q)}&mode_code=${mode ?? ""}` : ""}`;
  return (
    <>
      <section className="xz-hero">
        <div className="container text-center py-5 position-relative" style={{ zIndex: 1 }}>
          <div className="mt-4 mb-3"><span className="xz-seal lg">玄</span></div>
          <div className="text-faint fs-14 mb-2" style={{ letterSpacing: ".12em" }}>玄知 AI · XUANZHI AI</div>
          <h1 className="display-5 fw-semibold mb-2">{t("landing.hero")}</h1>
          <div className="zh text-muted fs-5 mb-3">{t("brand.tagline_zh")}</div>
          <p className="lead text-muted mx-auto" style={{ maxWidth: 640 }}>{t("landing.subtitle")}</p>
          <div className="d-flex gap-2 justify-content-center mt-4 flex-wrap">
            <Link to={start()} className="btn btn-primary btn-lg px-4">{t("landing.cta")}</Link>
            <Link to="/explore" className="btn btn-outline-primary btn-lg px-4">{t("landing.secondary")}</Link>
          </div>
        </div>
        <Mountains />
      </section>
      <section className="container py-5">
        <div className="text-faint fs-14 text-uppercase mb-3" style={{ letterSpacing: ".08em" }}>{t("landing.topics")}</div>
        <div className="row g-3">
          {TOPICS.map((tp) => (
            <div key={tp.key} className="col-6 col-md-3"><Link to={start(tp.q, tp.mode)} className="xz-topic h-100 text-decoration-none"><span className="zh">{tp.zh}</span><span className="fw-medium">{t(tp.key)}</span><span className="text-faint fs-13">{tp.q}</span></Link></div>
          ))}
        </div>
      </section>
      <section className="container py-4">
        <h2 className="h3 mb-4">{t("landing.how")}</h2>
        <div className="row g-4">
          {[["bi-chat-left-text", "landing.how1.title", "landing.how1.body"], ["bi-journal-bookmark", "landing.how2.title", "landing.how2.body"], ["bi-shield-check", "landing.how3.title", "landing.how3.body"]].map(([icon, a, b]) => (
            <div key={a} className="col-md-4"><div className="card h-100 p-3"><i className={`bi ${icon} fs-3`} style={{ color: "var(--xz-cinnabar)" }} /><h5 className="mt-2">{t(a as never)}</h5><p className="text-muted mb-0">{t(b as never)}</p></div></div>
          ))}
        </div>
      </section>
      <section className="container py-4">
        <div className="row g-3">
          {[["landing.feature_models", "landing.feature_models_body"], ["landing.feature_library", "landing.feature_library_body"], ["landing.feature_modes", "landing.feature_modes_body"], ["landing.feature_lang", "landing.feature_lang_body"]].map(([a, b]) => (
            <div key={a} className="col-sm-6 col-lg-3"><div className="p-3 border rounded-3 h-100 xz-cloud"><div className="fw-semibold">{t(a as never)}</div><div className="text-muted fs-14">{t(b as never)}</div></div></div>
          ))}
        </div>
      </section>
      <section className="container py-5 text-center">
        <blockquote className="serif fs-4 mb-1">「天行健，君子以自强不息」</blockquote>
        <div className="text-muted fs-14">Heaven moves with strength; the noble person strengthens themselves without ceasing. — 《周易·象传》</div>
      </section>
    </>
  );
}
