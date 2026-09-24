import { Fragment, useEffect, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import {
  CAPABILITY_TAGS, CATALOG, FOOTER_COLUMNS, HERO_TILES, QUICK_TOOLS, STUDIO_ROWS, type Tile,
} from "./showcase";
import { HfHeader } from "../../app/header/HfHeader";

/**
 * Public landing page: a media-first, section-stacked layout in the manner
 * of the big creative suites — feature tiles up top, a quick-tool strip, a
 * banner per platform pillar, and one gallery row per studio.
 *
 * The one rule: it only shows what the product does. Gallery tiles carry
 * example prompts and render as typographic posters until a real generation
 * is dropped in (`showcase.ts`), so nothing on the page passes off a stock
 * picture as our output. Keep that when adding sections.
 */

interface ShowcaseItem {
  id: string; kind: string; mime: string; name: string; width: number | null; height: number | null;
  prompt: string | null; studio: string | null; url: string;
}

/** Real generations an admin featured, keyed by the studio row they belong to. */
function useShowcase(): Record<string, Tile[]> {
  const [byStudio, setByStudio] = useState<Record<string, Tile[]>>({});
  useEffect(() => {
    fetch("/api/v1/public/showcase")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { items: ShowcaseItem[] }) => {
        const grouped: Record<string, Tile[]> = {};
        d.items.forEach((item, i) => {
          const key = item.studio ?? (item.kind === "video" ? "video" : item.kind === "audio" ? "audio" : "image");
          const portrait = item.width && item.height ? item.height > item.width * 1.15 : false;
          const wide = item.width && item.height ? item.width > item.height * 1.4 : false;
          (grouped[key] ??= []).push({
            title: item.studio ? item.studio[0]!.toUpperCase() + item.studio.slice(1) : item.kind,
            prompt: item.prompt ?? item.name,
            src: item.url,
            mime: item.mime,
            shape: portrait ? "portrait" : wide ? "wide" : "square",
            hue: (i * 47) % 360,
          });
        });
        setByStudio(grouped);
      })
      .catch(() => setByStudio({}));
  }, []);
  return byStudio;
}

export function LandingPage() {
  const showcase = useShowcase();
  return (
    <div className="lp">
      <div className="lp-ticker" role="note">
        <div className="lp-container d-flex flex-wrap justify-content-center gap-3">
          <span><i className="bi bi-receipt me-1" aria-hidden="true" />Estimated cost shown before every run</span>
          <span className="lp-ticker-sep" aria-hidden="true">·</span>
          <span><i className="bi bi-collection me-1" aria-hidden="true" />{CATALOG.total}-model Cloudflare catalog</span>
          <span className="lp-ticker-sep" aria-hidden="true">·</span>
          <span><i className="bi bi-plug me-1" aria-hidden="true" />MCP, REST API and Node SDK included</span>
        </div>
      </div>

      <HfHeader />

      <main>
        {/* Hero: media-first, premium and direct — inspired by modern AI creative suites. */}
        <section className="lp-hero" aria-labelledby="lp-hero-title">
          <div className="lp-container">
            <div className="lp-hero-feature">
              <img src="/hero-studio.webp" alt="Abstract light sculpture in a cinematic creative studio" fetchPriority="high" />
              <div className="lp-hero-feature-overlay" />
              <div className="lp-hero-feature-copy">
                <p className="lp-eyebrow">RaisAI Create · Enterprise creative infrastructure</p>
                <h1 id="lp-hero-title" className="lp-hero-title">Your idea.<br /><span>Unbounded.</span></h1>
                <p className="lp-hero-lead">Create campaign-ready images, video, voice and complete films from one intelligent workspace.</p>
                <div className="d-flex flex-wrap gap-2">
                  <Link to="/signup" className="btn lp-btn-lime">Start creating <i className="bi bi-arrow-up-right ms-1" aria-hidden="true" /></Link>
                  <a href="#image" className="btn btn-outline-light">Explore the studios</a>
                </div>
              </div>
              <div className="lp-hero-feature-meta"><span><i className="bi bi-shield-check me-1" />Private by design</span><span><i className="bi bi-lightning-charge me-1" />226 models</span></div>
            </div>

            <div className="lp-hero-grid">
              {HERO_TILES.map((t) => (
                <Link to={t.to} className="lp-hero-tile" style={{ "--h": t.hue } as CSSProperties} key={t.title}>
                  <i className={`bi bi-${t.icon} lp-hero-icon`} aria-hidden="true" />
                  <div className="lp-hero-text"><strong>{t.title}</strong><span>{t.sub}</span></div>
                  <i className="bi bi-arrow-up-right lp-hero-arrow" aria-hidden="true" />
                </Link>
              ))}
            </div>

            <div className="lp-promo-row">
              <div className="lp-promo lp-promo-price">
                <p className="lp-eyebrow mb-1">Pay per generation</p>
                <h2 className="lp-promo-title">Real prices. No credit maths.</h2>
                <p className="mb-2">Top up in ringgit, see the estimate before you generate, the exact charge after.</p>
                <div className="d-flex gap-2">
                  <Link to="/signup" className="btn btn-sm btn-light">Add your first RM 10</Link>
                  <Link to="/pricing" className="btn btn-sm btn-outline-light">See prices</Link>
                </div>
              </div>
              <div className="lp-tools" aria-label="Studios">
                {QUICK_TOOLS.map((t) => (
                  <Link to="/signup" className="lp-tool" key={t.label}>
                    <i className={`bi bi-${t.icon}`} aria-hidden="true" />
                    <span>{t.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Big banner: the platform pillar, like the suites lead with their flagship. */}
        <section className="lp-banner lp-banner-mcp" id="developers">
          <div className="lp-container">
            <p className="lp-eyebrow">RaisAI Create MCP</p>
            <h2 className="lp-banner-title">
              Generate from <span>Claude, Cursor or ChatGPT.</span>
            </h2>
            <p className="lp-banner-sub">
              Give an agent a scoped token and it can list models, estimate cost, run a template and fetch the result
              — through the same billing, the same budget caps and the same audit log as the web app.
            </p>
            <div className="d-flex flex-wrap gap-2">
              <Link to="/signup" className="btn lp-btn-lime">Get an MCP token</Link>
              <Link to="/developer/docs" className="btn btn-outline-light">Read the docs</Link>
            </div>
            <pre className="lp-code mt-4" aria-label="Node SDK example"><code>{`const run = await raisai.canvas.run("product-commercial", {
  product_image, brand_style: "warm, Kuala Lumpur morning light", duration: 15,
});
run.cost // charged in sen, never more than the estimate you approved`}</code></pre>
          </div>
        </section>

        {/* One gallery row per studio. */}
        {STUDIO_ROWS.map((row, i) => (
          <Fragment key={row.id}>
            <StudioSection row={row} live={showcase[row.id] ?? []} />
            {i === 0 && <CanvasBanner />}
            {i === 1 && <CharacterBanner />}
            {i === 2 && <TemplatesBanner />}
          </Fragment>
        ))}

        {/* Models: the catalog is real, per-model enablement is the admin's call. */}
        <section id="models" className="lp-section">
          <div className="lp-container">
            <div className="lp-row-head">
              <div>
                <p className="lp-eyebrow">Models</p>
                <h2 className="lp-h2">{CATALOG.total} models. One selector.</h2>
              </div>
              <Link to="/signup" className="lp-more">Compare models <i className="bi bi-arrow-right" aria-hidden="true" /></Link>
            </div>
            <p className="lp-sub">
              Cloudflare-hosted and third-party models in one catalog. Pick one, or let the studio choose the best
              enabled model for the task; the controls change to match what that model understands.
            </p>
            <div className="lp-catalog">
              {CATALOG.groups.map((g) => (
                <div className="lp-catalog-card" key={g.label}>
                  <i className={`bi bi-${g.icon}`} aria-hidden="true" />
                  <div className="lp-catalog-n">{g.count}</div>
                  <div className="text-secondary small">{g.label}</div>
                </div>
              ))}
            </div>
            <p className="lp-fine">Counts are the catalog as synced from Cloudflare. Each model is enabled for customers only after it has a price and a passed test run.</p>
          </div>
        </section>

        {/* Tag cloud. */}
        <section className="lp-section lp-section-tags">
          <div className="lp-container text-center">
            <h2 className="lp-h2 mx-auto">Explore more AI features</h2>
            <div className="lp-tags">
              {CAPABILITY_TAGS.map((t) => (
                <Link to="/signup" className="lp-tag" key={t}>{t}</Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-container">
          <div className="lp-footer-grid">
            <div className="lp-footer-brand">
              <div className="lp-footer-title">AI-native<br />creative suite</div>
              <p className="mb-3">Images, video, voice, music and whole films — from one canvas, one balance, one API.</p>
              <Link to="/signup" className="btn btn-dark">Start creating</Link>
            </div>
            {FOOTER_COLUMNS.map((col) => (
              <div key={col.heading}>
                <div className="lp-footer-heading">{col.heading}</div>
                <ul className="list-unstyled mb-0">
                  {col.links.map((l) => (
                    <li key={l.label}><Link to={l.to}>{l.label}</Link></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="lp-footer-bottom d-flex flex-wrap justify-content-between gap-2">
            <span>© {new Date().getFullYear()} RaisAI Create · Built on Cloudflare Workers AI</span>
            <span>Prices in MYR. Estimated from current provider pricing; you are charged the actual amount.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function StudioSection({ row, live }: { row: (typeof STUDIO_ROWS)[number]; live: Tile[] }) {
  // Real featured generations lead the row; the prompt posters fill the rest
  // so a half-populated showcase still reads as a full gallery.
  const tiles = [...live, ...row.tiles].slice(0, Math.max(row.tiles.length, live.length));
  return (
    <section id={row.id} className="lp-section">
      <div className="lp-container">
        <div className="lp-row-head">
          <div>
            <p className="lp-eyebrow">{row.eyebrow}</p>
            <h2 className="lp-h2">{row.title}</h2>
          </div>
          <Link to="/signup" className="lp-more">Open studio <i className="bi bi-arrow-right" aria-hidden="true" /></Link>
        </div>
        <p className="lp-sub">{row.text}</p>
        <div className="lp-gallery">
          {tiles.map((t, i) => <Poster tile={t} key={t.src ?? `${t.title}-${i}`} />)}
        </div>
      </div>
    </section>
  );
}

/**
 * A gallery tile. With `src` it shows the media; without it, the prompt
 * becomes the artwork — big type on a two-tone gradient — so the page can
 * demonstrate a studio without pretending a stock image came out of it.
 */
function Poster({ tile }: { tile: Tile }) {
  const style = { "--h": tile.hue } as CSSProperties;
  return (
    <figure className={`lp-poster lp-poster-${tile.shape ?? "square"}`} style={style}>
      {tile.src && tile.mime?.startsWith("video/") ? (
        <video src={tile.src} muted autoPlay loop playsInline preload="metadata" aria-label={tile.prompt} />
      ) : tile.src && tile.mime?.startsWith("audio/") ? (
        <div className="lp-poster-art" aria-hidden="true"><span className="lp-poster-word"><i className="bi bi-soundwave" /></span></div>
      ) : tile.src ? (
        <img src={tile.src} alt={tile.prompt} loading="lazy" />
      ) : (
        <div className="lp-poster-art" aria-hidden="true">
          <span className="lp-poster-word">{tile.title}</span>
        </div>
      )}
      <figcaption>
        <span className="lp-poster-label">{tile.title}</span>
        <span className="lp-poster-prompt">{tile.prompt}</span>
      </figcaption>
    </figure>
  );
}

function CanvasBanner() {
  return (
    <section id="canvas" className="lp-banner lp-banner-cyan">
      <div className="lp-container">
        <p className="lp-eyebrow">Node canvas</p>
        <h2 className="lp-banner-title">One canvas.<br />Every idea.</h2>
        <p className="lp-banner-sub">
          Chain any studio into the next — image → animate → voice → reframe → export. Branch, loop, call an HTTP
          endpoint or an MCP tool, cap the budget, and re-run a single node without paying for the rest.
        </p>
        <div className="lp-canvas" role="img" aria-label="Example canvas: prompt to image to animate to voice to reframe to export">
          {["Prompt", "Image", "Animate", "Voice", "Reframe 9:16", "Export"].map((step, i, all) => (
            <div className="lp-canvas-step" key={step}>
              <div className={`lp-node ${i === 1 || i === 2 || i === 3 ? "lp-node-ai" : ""}`}><span className="lp-node-dot" />{step}</div>
              {i < all.length - 1 && <span className="lp-edge" aria-hidden="true" />}
            </div>
          ))}
        </div>
        <Link to="/signup" className="btn btn-dark mt-3">Open the canvas</Link>
      </div>
    </section>
  );
}

function CharacterBanner() {
  return (
    <section className="lp-banner lp-banner-dark">
      <div className="lp-container lp-banner-split">
        <div>
          <p className="lp-eyebrow">Reference images</p>
          <h2 className="lp-banner-title">Different scenes.<br />Same star.</h2>
          <p className="lp-banner-sub">
            Attach reference images to any image or video node and the studio passes them to every model that can
            use them. Characters in Movie mode keep their references, so scene 9 matches scene 1.
          </p>
          <Link to="/signup" className="btn lp-btn-lime">Try it</Link>
        </div>
        <div className="lp-refs" aria-hidden="true">
          {[262, 200, 40, 330, 150, 20].map((h, i) => (
            <div className="lp-ref" style={{ "--h": h } as CSSProperties} key={h}><span>Scene {i + 1}</span></div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TemplatesBanner() {
  return (
    <section className="lp-banner lp-banner-lime">
      <div className="lp-container">
        <p className="lp-eyebrow">Templates</p>
        <h2 className="lp-banner-title">Build it once. Run it forever.</h2>
        <p className="lp-banner-sub">
          Save any canvas as a template with typed inputs — product image, brand style, duration — and run it from
          the web, the API or an agent. Publish it public or unlisted; every run pins the version it used.
        </p>
        <Link to="/templates?scope=public" className="btn btn-dark">Browse templates</Link>
      </div>
    </section>
  );
}
