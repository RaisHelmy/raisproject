import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { ModeDTO } from "@xuanzhi/shared-types";
import { api } from "@/services/api";
import { useAuth } from "@/services/auth";
import { useT, pickName, pickDescription } from "@/i18n";

interface Card { zh: string; en: string; desc: string; icon: string; mode: string; q: string }
const SECTIONS: { key: "explore.classical" | "explore.fengshui" | "explore.destiny" | "explore.philosophy"; cards: Card[] }[] = [
  { key: "explore.classical", cards: [
    { zh: "易经", en: "I Ching", desc: "Hexagrams, trigrams and the philosophy of change.", icon: "bi-hexagon", mode: "iching", q: "Introduce the structure of the I Ching and how a hexagram is read." },
    { zh: "道德经", en: "Tao Te Ching", desc: "Laozi on the Way, naturalness and non-forcing action.", icon: "bi-yin-yang", mode: "taoist", q: "What are the key ideas of the Dao De Jing?" },
    { zh: "论语", en: "Analects", desc: "Confucius on humaneness, ritual and learning.", icon: "bi-mortarboard", mode: "confucian", q: "What are the core teachings of the Analects?" },
    { zh: "庄子", en: "Zhuangzi", desc: "Parables of freedom, perspective and transformation.", icon: "bi-feather", mode: "taoist", q: "What does Zhuangzi's butterfly dream mean?" },
    { zh: "孟子", en: "Mencius", desc: "Human nature is good; the ruler serves the people.", icon: "bi-people", mode: "confucian", q: "How does Mencius argue that human nature is good?" },
  ] },
  { key: "explore.fengshui", cards: [
    { zh: "阳宅风水", en: "Residential Feng Shui", desc: "Door, stove and bed: the classical home principles.", icon: "bi-house-door", mode: "fengshui", q: "What are the traditional principles for door, stove and bed placement?" },
    { zh: "峦头", en: "Landscape Feng Shui", desc: "Mountains, water and the four celestial animals.", icon: "bi-image", mode: "fengshui", q: "Explain the Form School and the armchair configuration." },
    { zh: "理气", en: "Compass Schools", desc: "Luopan, Eight Mansions and Flying Stars.", icon: "bi-compass", mode: "fengshui", q: "How do the Eight Mansions and Flying Stars methods differ?" },
    { zh: "基本概念", en: "Traditional Concepts", desc: "Qi, yin-yang and the five phases in space.", icon: "bi-diagram-3", mode: "fengshui", q: "How are the five elements used in Feng Shui remedies?" },
  ] },
  { key: "explore.destiny", cards: [
    { zh: "八字", en: "Ba Zi", desc: "Four Pillars: stems, branches and the Day Master.", icon: "bi-grid-3x3", mode: "general", q: "How is a Ba Zi chart constructed and interpreted traditionally?" },
    { zh: "紫微斗数", en: "Zi Wei Dou Shu", desc: "Purple Star charts and the twelve palaces.", icon: "bi-stars", mode: "general", q: "What are the twelve palaces in Zi Wei Dou Shu?" },
    { zh: "奇门遁甲", en: "Qi Men Dun Jia", desc: "The classical timing and strategy system.", icon: "bi-grid-1x2", mode: "general", q: "What is Qi Men Dun Jia and how was it used historically?" },
    { zh: "六爻", en: "Liu Yao", desc: "Coin-cast hexagram divination with six lines.", icon: "bi-coin", mode: "iching", q: "How does Liu Yao divination differ from a plain I Ching reading?" },
    { zh: "梅花易数", en: "Mei Hua Yi Shu", desc: "Plum Blossom numerology from Shao Yong.", icon: "bi-flower2", mode: "iching", q: "Explain the Plum Blossom (梅花易数) method." },
  ] },
  { key: "explore.philosophy", cards: [
    { zh: "儒家", en: "Confucianism", desc: "Ethics of family, ritual and the noble person.", icon: "bi-mortarboard", mode: "confucian", q: "What is the Confucian view of the junzi?" },
    { zh: "道家", en: "Taoism", desc: "Wu wei, ziran and the uncarved block.", icon: "bi-yin-yang", mode: "taoist", q: "What is wu wei and how can it apply to modern work?" },
    { zh: "佛学", en: "Buddhism", desc: "Chan, Pure Land and the Heart Sutra.", icon: "bi-flower1", mode: "buddhist", q: "What does the Heart Sutra mean by form is emptiness?" },
  ] },
];

export default function ExplorePage({ publicView }: { publicView?: boolean }) {
  const { t, locale } = useT(); const { user } = useAuth(); const [modes, setModes] = useState<ModeDTO[]>([]);
  useEffect(() => { api<ModeDTO[]>("/modes").then((r) => setModes(r.data)).catch(() => undefined); }, []);
  const href = (q: string, mode: string) => (user ? `/app/chat?q=${encodeURIComponent(q)}&mode_code=${mode}` : `/register?redirect=${encodeURIComponent(`/app/chat?q=${encodeURIComponent(q)}&mode_code=${mode}`)}`);
  return (
    <div className={publicView ? "container py-5" : "xz-page"}>
      <h1 className="h2 mb-1">{t("explore.title")}</h1><p className="text-muted">{t("explore.subtitle")}</p>
      {SECTIONS.map((s) => (
        <section key={s.key} className="mt-4" id={s.key.split(".")[1]}>
          <h2 className="h5 mb-3">{t(s.key)}</h2>
          <div className="row g-3">{s.cards.map((c) => (
            <div key={c.en} className="col-sm-6 col-lg-4"><div className="card card-hover h-100 p-3 d-flex flex-column"><div className="d-flex align-items-center gap-2 mb-1"><i className={`bi ${c.icon} fs-4`} style={{ color: "var(--xz-cinnabar)" }} /><span className="zh fs-5">{c.zh}</span></div><div className="fw-medium">{c.en}</div><p className="text-muted fs-14 flex-grow-1 mb-2">{c.desc}</p><Link to={href(c.q, c.mode)} className="btn btn-outline-primary btn-sm align-self-start">{t("explore.start")}</Link></div></div>
          ))}</div>
        </section>
      ))}
      {modes.length > 0 && (
        <section className="mt-5"><h2 className="h5 mb-3">{t("explore.modes")}</h2>
          <div className="row g-3">{modes.map((m) => <div key={m.id} className="col-sm-6 col-lg-4"><Link to={user ? `/app/chat?mode=${m.id}` : "/register"} className="card card-hover h-100 p-3 text-decoration-none"><div className="d-flex align-items-center gap-2"><i className={`bi ${m.icon}`} style={{ color: "var(--xz-cinnabar)" }} /><span className="fw-medium">{pickName(m, locale)}</span>{m.is_advanced && <span className="badge badge-cinnabar ms-auto">Pro</span>}</div><div className="text-muted fs-14 mt-1">{pickDescription(m, locale)}</div></Link></div>)}</div>
        </section>
      )}
    </div>
  );
}
