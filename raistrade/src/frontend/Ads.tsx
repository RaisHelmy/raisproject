import { useEffect, useRef, useState } from "react";
import { TEMPLATES } from "../shared/strategies";
import { CATALOG } from "../shared/library";
import { BUNDLES } from "../shared/combos";
import { INSTRUMENTS } from "../shared/market";
import { ThemeToggle, useTheme } from "./theme";
import { SCENES } from "./demo/Tour";
import { DISCLAIMER, FEATURES } from "../shared/adsContent";

const W = 1440, H = 900;

function DemoFrame({ scene, nonce, onScene }: { scene: number; nonce: number; onScene: (i: number) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const theme = useTheme();
  const [src] = useState(() => `/?demo=1&tour=1&theme=${theme}`);
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setScale(e!.contentRect.width / W));
    ro.observe(box.current!);
    const on = (e: MessageEvent) => { if (e.data?.rt === "scene") onScene(e.data.i); };
    window.addEventListener("message", on);
    return () => { ro.disconnect(); window.removeEventListener("message", on); };
  }, []);
  return (
    <div className="ad-browser">
      <div className="ad-chrome"><span /><span /><span /><div className="ad-url">🔒 raistrade.raishelmy.uk</div></div>
      <div ref={box} className="ad-screen" style={{ height: H * scale }}>
        <iframe key={nonce} title="RaisTrade live demo" src={nonce ? `${src.replace(/&scene=\d+/, "")}&scene=${scene}` : src}
          style={{ width: W, height: H, transform: `scale(${scale})` }} />
      </div>
    </div>
  );
}


export function Ads() {
  const [active, setActive] = useState(0);
  const [nonce, setNonce] = useState(0);
  const [jump, setJump] = useState(0);
  useEffect(() => { document.title = "RaisTrade — trading robots that prove themselves"; }, []);
  const go = (i: number) => { setJump(i); setActive(i); setNonce((n) => n + 1); document.getElementById("demo")?.scrollIntoView({ behavior: "smooth", block: "start" }); };
  const cats = [...new Set(TEMPLATES.map((t) => t.category))];

  return (
    <div className="ad-page">
      <nav className="ad-nav">
        <div className="ad-wrap d-flex align-items-center gap-3">
          <span className="h5 brand mb-0">Rais<span>Trade</span></span>
          <a className="ad-link d-none d-sm-inline" href="#demo">Demo</a>
          <a className="ad-link d-none d-sm-inline" href="#features">Features</a>
          <div className="ms-auto d-flex align-items-center gap-2">
            <ThemeToggle />
            <a className="btn btn-accent btn-sm px-3" href="/">Open app →</a>
          </div>
        </div>
      </nav>

      <header className="ad-hero">
        <div className="ad-wrap text-center">
          <span className="ad-pill"><span className="live-dot" /> Live demo · paper money · no sign-up</span>
          <h1 className="ad-h1">Trading robots that<br /><span className="ad-grad">prove themselves</span> first.</h1>
          <p className="ad-lead">Chart {INSTRUMENTS.length} markets, trade stocks and binary options, and let {TEMPLATES.length} strategy robots trade for you — each one backtested live and ranked by how <b>stable</b> it really is.</p>
          <div className="d-flex gap-2 justify-content-center flex-wrap">
            <a className="btn btn-accent btn-lg px-4" href="/">Start trading free</a>
            <a className="btn btn-outline-secondary btn-lg px-4" href="#demo">▶ Watch it work</a>
            <a className="btn btn-outline-secondary btn-lg px-4" href="/?demo=1" title="Click around the real app with demo money — no sign-up">🕹 Try the live demo</a>
          </div>
        </div>
      </header>

      <section id="demo" className="ad-wrap ad-demo">
        <div className="row g-3 align-items-start">
          <div className="col-xl-9"><DemoFrame scene={jump} nonce={nonce} onScene={setActive} /></div>
          <div className="col-xl-3">
            <div className="ad-chapters">
              <div className="step-title">Tour · click to jump</div>
              {SCENES.map((s, i) => (
                <button key={s.title} className={`ad-chapter ${active === i ? "active" : ""}`} onClick={() => go(i)}>
                  <span className="ad-chapter-n">{i + 1}</span>
                  <span><b>{s.title}</b><small>{s.text}</small></span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="ad-stats">
        <div className="ad-wrap d-flex flex-wrap justify-content-around gap-4 text-center">
          {[[INSTRUMENTS.length, "markets"], [TEMPLATES.length, "strategy types"], [CATALOG.size.toLocaleString(), "rules in the catalogue"], [BUNDLES.length, "robot bundles"], ["24/7", "server-side trading"]].map(([v, l]) => (
            <div key={l as string}><div className="ad-stat-v">{v}</div><div className="ad-stat-l">{l}</div></div>
          ))}
        </div>
      </section>

      <section id="features" className="ad-wrap py-5">
        <h2 className="ad-h2 text-center">Everything you need to trade smarter</h2>
        <p className="text-center text-secondary mb-4">Every screen in the demo above is the real app running on simulated data.</p>
        <div className="row g-3">
          {FEATURES.map((f, i) => (
            <div className="col-sm-6 col-lg-3" key={f.title}>
              <div className="ad-feature h-100" style={{ animationDelay: `${i * 60}ms` }}>
                <div className="ad-feature-i">{f.icon}</div>
                <div className="fw-bold mb-1">{f.title}</div>
                <div className="small text-secondary">{f.text}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="ad-wrap pb-5">
        <h2 className="ad-h2 text-center mb-3">{TEMPLATES.length} strategies, from classic to clever</h2>
        <div className="ad-marquee">
          <div className="ad-marquee-track">
            {[...TEMPLATES, ...TEMPLATES].map((t, i) => <span key={i} className="ad-tag"><b className="text-warning">{t.icon}</b> {t.name}</span>)}
          </div>
        </div>
        <div className="d-flex flex-wrap gap-2 justify-content-center mt-3">
          {cats.map((c) => <span key={c} className="badge text-bg-secondary">{c} · {TEMPLATES.filter((t) => t.category === c).length}</span>)}
        </div>
      </section>

      <section className="ad-cta">
        <div className="ad-wrap text-center">
          <h2 className="ad-h2">Ready to meet your first robot?</h2>
          <p className="text-secondary mb-4">Paper money. Real strategies. No risk.</p>
          <div className="d-flex gap-2 justify-content-center flex-wrap">
            <a className="btn btn-accent btn-lg px-5" href="/?demo=1">🕹 Try the live demo</a>
            <a className="btn btn-outline-secondary btn-lg px-4" href="/">Sign in</a>
          </div>
          <div className="small text-secondary mt-2">The demo runs entirely in your browser with practice money — nothing to install, no account needed.</div>
        </div>
      </section>

      <footer className="ad-wrap py-4 small text-secondary text-center">
        {DISCLAIMER}
      </footer>
    </div>
  );
}
