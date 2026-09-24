import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MenuEntryIcon } from "../../app/header/NavigationMenu";
import type { MenuEntry } from "../../app/header/menuData";
import {
  ACADEMY_IMAGES, IMAGE_EMPTY_STATE, IMAGE_EMPTY_TITLE, STUDIOS, VIDEO_PRESET,
  type ChipIcon, type ChipOption, type HowItWorksStep, type StudioConfig, type StudioKind,
} from "./studioData";

/**
 * The creation studios, laid out like the reference: Video and Audio get a
 * left rail with the generation form and a canvas on the right; Image gets a
 * full-bleed canvas with a floating prompt bar. Everything here is UI —
 * nothing calls the generation API. The wired-up form lives at
 * /create/<kind>/classic.
 */
export function HfStudio({ kind }: { kind: StudioKind }) {
  const config = STUDIOS[kind];
  const [params] = useSearchParams();
  const requested = params.get("model");
  const model =
    config.models.find((m) => m.href.includes(`model=${requested}`)) ??
    (kind === "image" ? config.models.find((m) => m.title === "GPT Image 2") : undefined) ??
    config.models[0];

  if (kind === "image") return <ImageStudio config={config} model={model} />;
  return <RailStudio config={config} model={model} />;
}

/* ---- video / audio: rail + canvas -------------------------------------- */

function RailStudio({ config, model }: { config: StudioConfig; model: MenuEntry | undefined }) {
  const [tab, setTab] = useState(config.tabs[0]!);
  return (
    <div className={`st st-rail st-${config.kind}`}>
      <aside className="st-rail-col">
        <div className="st-panel">
          <nav className="st-tabs" aria-label={`${config.kind} mode`}>
            {config.tabs.map((t) => (
              <button key={t} type="button" className="st-tab" data-active={t === tab || undefined} onClick={() => setTab(t)}>{t}</button>
            ))}
          </nav>
          <form className="st-form" onSubmit={(e) => e.preventDefault()}>
            <div className="st-form-body">
              {config.kind === "video" ? <VideoRailFields model={model} config={config} /> : <AudioRailFields model={model} />}
            </div>
            <div className="st-form-foot">
              <GenerateButton price={config.price} />
            </div>
          </form>
        </div>
      </aside>
      <section className="st-canvas">
        <div className="st-canvas-inner">
          <CanvasHeader kind={config.kind} />
          <div className="st-canvas-body">
            <HowItWorks config={config} />
            {config.kind === "video" && <AcademyInvite />}
          </div>
        </div>
      </section>
    </div>
  );
}

function VideoRailFields({ model, config }: { model: MenuEntry | undefined; config: StudioConfig }) {
  const [mode, setMode] = useState<"References" | "Extend Video">("References");
  return (
    <>
      <figure className="st-preset">
        <video src={VIDEO_PRESET.video} autoPlay loop muted playsInline />
        <span className="st-preset-shade" />
        <figcaption>
          <p className="st-preset-name">{VIDEO_PRESET.name}</p>
          <p className="st-preset-model">{VIDEO_PRESET.model}</p>
        </figcaption>
        <div className="st-preset-actions">
          <button type="button" className="st-glass-btn">Mix<PlusIcon /></button>
          <button type="button" className="st-glass-btn"><PencilIcon />Change</button>
        </div>
      </figure>

      <div className="st-segmented" role="group">
        {(["References", "Extend Video"] as const).map((m) => (
          <button key={m} type="button" role="radio" aria-checked={mode === m} data-state={mode === m ? "on" : "off"} onClick={() => setMode(m)}>{m}</button>
        ))}
      </div>

      <DropZone title="Add references" sub="Image, Video or Audio" icons={["image", "video", "audio"]} />
      <PromptBox label="Prompt" placeholder="Describe the visual change you want — e.g., “Make it snow” or “Make it nighttime”. Add reference images or elements using @..." footer />
      <ModelRow model={model} models={config.models} />
      <div className="st-chips">
        {config.chips.map((c, i) => <Chip key={i} chip={c} />)}
      </div>
      <BitrateRow />
    </>
  );
}

function AudioRailFields({ model }: { model: MenuEntry | undefined }) {
  const [batch, setBatch] = useState(1);
  const [details, setDetails] = useState("");
  return (
    <>
      <DropZone title="Upload media" sub="Up to 3 Voices/Audios or Image" icons={["audio", "music", "image"]} optional />
      <PromptBox label="Script" placeholder="Write exactly what the voice will read out loud. Type @ to reference attachments" info tall />
      <ModelRow model={model} models={[]} tall />
      <div className="st-row">
        <span className="st-row-label">Batch size</span>
        <div className="st-stepper">
          <button type="button" aria-label="Decrease batch size" onClick={() => setBatch((b) => Math.max(1, b - 1))}><MinusIcon /></button>
          <span>{batch}/4</span>
          <button type="button" aria-label="Increase batch size" onClick={() => setBatch((b) => Math.min(4, b + 1))}><PlusIcon /></button>
        </div>
      </div>
      <section className="st-field">
        <span className="st-optional">Optional</span>
        <label className="st-field-label" htmlFor="st-voice-details">Voice details</label>
        <textarea
          id="st-voice-details"
          className="st-textarea"
          maxLength={500}
          placeholder="e.g. Young female voice with british accent, soft and loud. Excited, giggling"
          value={details}
          onChange={(e) => setDetails(e.target.value)}
        />
        <span className="st-counter">{details.length}/500</span>
      </section>
      <button type="button" className="st-advanced">
        <SlidersIcon />
        <span>Advanced settings</span>
        <ChevronIcon />
      </button>
    </>
  );
}

/* ---- image: canvas + floating prompt bar -------------------------------- */

function ImageStudio({ config, model }: { config: StudioConfig; model: MenuEntry | undefined }) {
  const [batch, setBatch] = useState(1);
  return (
    <div className="st st-image">
      <div className="st-image-canvas">
        <div className="st-empty">
          <div className="st-empty-stack" aria-hidden="true">
            <div className="st-empty-glow">{IMAGE_EMPTY_STATE.map((src, i) => <EmptyTile key={i} src={src} i={i} />)}</div>
            <div className="st-empty-row">{IMAGE_EMPTY_STATE.map((src, i) => <EmptyTile key={i} src={src} i={i} />)}</div>
          </div>
          <div className="st-empty-copy">
            <h1>
              <span className="st-empty-lead">{IMAGE_EMPTY_TITLE.lead}</span>
              <span className="st-empty-brand">{IMAGE_EMPTY_TITLE.brand}</span>
            </h1>
            <p>{IMAGE_EMPTY_TITLE.sub}</p>
          </div>
        </div>
      </div>
      <form className="st-imgbar" onSubmit={(e) => e.preventDefault()}>
        <div className="st-imgbar-top">
          <button type="button" className="st-imgbar-add" aria-label="Add reference"><PlusIcon /></button>
          <textarea className="st-imgbar-prompt" rows={1} placeholder="Describe the scene you imagine" />
        </div>
        <div className="st-imgbar-controls">
          <button type="button" className="st-imgbar-model">
            <span className="st-imgbar-model-icon">{model && <MenuEntryIcon icon={model.icon} />}</span>
            <span>{model?.title ?? "Model"}</span>
            <ChevronIcon />
          </button>
          <div className="st-imgbar-chips">
            {config.chips.map((c, i) => <Chip key={i} chip={c} compact />)}
            <div className="st-stepper st-stepper-inline">
              <button type="button" aria-label="Decrease batch size" onClick={() => setBatch((b) => Math.max(1, b - 1))}><MinusIcon /></button>
              <span>{batch}/4</span>
              <button type="button" aria-label="Increase batch size" onClick={() => setBatch((b) => Math.min(4, b + 1))}><PlusIcon /></button>
            </div>
          </div>
          <button type="submit" className="st-imgbar-go" aria-label="Generate"><ArrowUpIcon /></button>
        </div>
      </form>
    </div>
  );
}

function EmptyTile({ src, i }: { src: string; i: number }) {
  return (
    <div className="st-empty-tile" data-i={i}>
      <div className="st-empty-tile-inner"><img src={src} alt="" /></div>
    </div>
  );
}

/* ---- shared pieces ------------------------------------------------------- */

function CanvasHeader({ kind }: { kind: StudioKind }) {
  const [tab, setTab] = useState<"History" | "How it works">("How it works");
  return (
    <header className="st-canvas-head">
      <div className="st-pilltabs" role="tablist" aria-label="Page view">
        {(["History", "How it works"] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={t === tab} data-active={t === tab || undefined} onClick={() => setTab(t)}>
            {t === "History" ? <HistoryIcon /> : <BookIcon />}
            <span>{t}</span>
          </button>
        ))}
      </div>
      {kind === "audio" && (
        <button type="button" className="st-filters"><FilterIcon />Filters</button>
      )}
    </header>
  );
}

function HowItWorks({ config }: { config: StudioConfig }) {
  const { title, lead, steps } = config.howItWorks;
  const audio = config.kind === "audio";
  return (
    <section className={`st-hiw${audio ? " st-hiw-audio" : ""}`}>
      <header className="st-hiw-head">
        <h1>{title}</h1>
        <p>{lead}</p>
      </header>
      <div className="st-hiw-grid" data-count={steps.length}>
        {steps.map((s) => <StepCard key={s.title} step={s} audio={audio} />)}
      </div>
    </section>
  );
}

function StepCard({ step, audio }: { step: HowItWorksStep; audio: boolean }) {
  const body = (
    <figure className="st-step-media">
      {step.img && <img src={step.img} alt="" loading="lazy" />}
      {step.video && <video src={step.video} autoPlay loop muted playsInline aria-label={step.title} />}
    </figure>
  );
  if (audio) {
    return (
      <article className="st-step st-step-audio">
        <div className="st-step-copy">
          <h2>{step.title}</h2>
          <p>{step.desc}</p>
        </div>
        {body}
      </article>
    );
  }
  return (
    <article className="st-step">
      {body}
      <h2>{step.title}</h2>
      <p>{step.desc}</p>
    </article>
  );
}

function AcademyInvite() {
  return (
    <Link to="/academy" className="st-academy">
      <div className="st-academy-art" aria-hidden="true">
        {ACADEMY_IMAGES.map((src, i) => (
          <div key={src} className="st-academy-card" data-i={i}><img src={src} alt="" loading="lazy" /><span /></div>
        ))}
      </div>
      <span className="st-academy-copy">
        <span className="st-academy-title">Don’t know where to start?</span>
        <span className="st-academy-sub">Go to the Academy and start your journey</span>
      </span>
      <ChevronIcon />
    </Link>
  );
}

function DropZone({ title, sub, icons, optional }: { title: string; sub: string; icons: string[]; optional?: boolean }) {
  return (
    <div className="st-drop" role="button" tabIndex={0}>
      {optional && <span className="st-optional">Optional</span>}
      <div className="st-drop-icons" aria-hidden="true">
        {icons.map((n) => <span key={n} className="st-drop-icon">{DROP_ICON[n] ?? <ImageIcon />}</span>)}
      </div>
      <p className="st-drop-title">{title}</p>
      <p className="st-drop-sub">{sub}</p>
    </div>
  );
}

function PromptBox(props: { label: string; placeholder: string; footer?: boolean; info?: boolean; tall?: boolean }) {
  const [value, setValue] = useState("");
  const [sound, setSound] = useState(true);
  return (
    <section className={`st-prompt${props.tall ? " st-prompt-tall" : ""}`}>
      <div className="st-prompt-head">
        <span className="st-prompt-label">{props.label}</span>
        {props.info && <InfoIcon />}
      </div>
      <textarea className="st-prompt-input" placeholder={props.placeholder} value={value} onChange={(e) => setValue(e.target.value)} />
      {props.footer && (
        <div className="st-prompt-foot">
          <button type="button" className="st-mini"><AtIcon />Elements</button>
          <button type="button" className="st-mini" aria-pressed={sound} onClick={() => setSound((s) => !s)}>
            <SoundIcon />{sound ? "On" : "Off"}
          </button>
        </div>
      )}
    </section>
  );
}


/**
 * Dropdowns in the rail would be clipped by its scroll container, so the menu
 * is positioned in the viewport from the trigger's rect and flipped upward
 * when there is not enough room below.
 */
function useAnchor(open: boolean) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [style, setStyle] = useState<CSSProperties>();
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const el = trigger.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const below = window.innerHeight - r.bottom;
      const flip = below < 240 && r.top > below;
      setStyle({
        position: "fixed",
        left: r.left,
        minWidth: r.width,
        // Leave the 52px header clear when the menu flips above the trigger.
        maxHeight: Math.max(160, (flip ? r.top - 52 : below) - 16),
        ...(flip ? { bottom: window.innerHeight - r.top + 6 } : { top: r.bottom + 6 }),
      });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => { window.removeEventListener("scroll", place, true); window.removeEventListener("resize", place); };
  }, [open]);
  return { trigger, style };
}

function ModelRow({ model, models, tall }: { model: MenuEntry | undefined; models: MenuEntry[]; tall?: boolean }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState(model);
  const box = useRef<HTMLDivElement>(null);
  const { trigger, style } = useAnchor(open);
  useEffect(() => { setPicked(model); }, [model]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [open]);
  return (
    <div className={`st-model${tall ? " st-model-tall" : ""}`} ref={box}>
      <button ref={trigger} type="button" className="st-model-btn" aria-label="Model" aria-expanded={open} onClick={() => models.length > 0 && setOpen((o) => !o)}>
        <span className="st-model-text">
          <span className="st-model-label">Model</span>
          <span className="st-model-name">
            <span className="st-model-title">{picked?.title ?? "Auto"}</span>
            {picked && <span className="st-model-icon"><MenuEntryIcon icon={picked.icon} /></span>}
          </span>
        </span>
        <ChevronIcon />
      </button>
      {open && (
        <div className="st-model-menu" role="listbox" style={style}>
          {models.map((m) => (
            <button key={m.id} type="button" role="option" aria-selected={m.id === picked?.id} className="st-model-opt" onClick={() => { setPicked(m); setOpen(false); }}>
              <span className="st-model-opt-icon"><MenuEntryIcon icon={m.icon} /></span>
              <span className="st-model-opt-text">
                <span className="st-model-opt-title">{m.title}</span>
                <span className="st-model-opt-sub">{m.subtitle}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({ chip, compact }: { chip: ChipOption; compact?: boolean }) {
  const [value, setValue] = useState(chip.options[0] ?? chip.label);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const { trigger, style } = useAnchor(open);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [open]);
  return (
    <div className={`st-chip-wrap${compact ? " st-chip-compact" : ""}`} ref={box}>
      <button ref={trigger} type="button" className="st-chip" aria-label={chip.icon} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {CHIP_ICON[chip.icon]}
        <span>{value}</span>
      </button>
      {open && (
        <div className="st-chip-menu" role="listbox" style={style}>
          {chip.options.map((o) => (
            <button key={o} type="button" role="option" aria-selected={o === value} onClick={() => { setValue(o); setOpen(false); }}>{o}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function BitrateRow() {
  return (
    <button type="button" className="st-bitrate" aria-label="Bitrate">
      <BitrateIcon />
      <span className="st-bitrate-label">Bitrate</span>
      <span className="st-bitrate-value"><SparkIcon />High</span>
      <ChevronIcon />
    </button>
  );
}

function GenerateButton({ price }: { price: { now: number; was?: number } }) {
  return (
    <button type="submit" className="st-generate">
      <span>Generate</span>
      <span className="st-generate-price">
        {price.now}
        <SparkIcon />
        {price.was !== undefined && <span className="st-generate-was">{price.was}</span>}
      </span>
    </button>
  );
}

/* ---- icons ---------------------------------------------------------------- */

const s = { stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
const ImageIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" {...s} /><path d="M3 16l5-5 4 4 3-3 6 6" {...s} /><circle cx="15.5" cy="9" r="1.5" fill="currentColor" /></svg>;
const VideoIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="2" {...s} /><path d="M16 10l5-3v10l-5-3" {...s} /></svg>;
const AudioIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2" {...s} /></svg>;
const MusicIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V6l10-2v12" {...s} /><circle cx="7" cy="18" r="2" {...s} /><circle cx="17" cy="16" r="2" {...s} /></svg>;
const DROP_ICON: Record<string, JSX.Element> = { image: <ImageIcon />, video: <VideoIcon />, audio: <AudioIcon />, music: <MusicIcon /> };

const ClockIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" {...s} /><path d="M12 7.5V12l3 2" {...s} /></svg>;
const RatioIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="6" width="16" height="12" rx="2" {...s} /></svg>;
const ResolutionIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l8.5 4.9v8.2L12 21l-8.5-4.9V7.9L12 3Z" {...s} /></svg>;
const QualityIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4l2.4 5.2 5.6.7-4.2 3.9 1.1 5.6L12 16.7 7.1 19.4l1.1-5.6L4 9.9l5.6-.7L12 4Z" {...s} /></svg>;
const BatchIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" rx="1.5" {...s} /><rect x="13" y="3" width="8" height="8" rx="1.5" {...s} /><rect x="3" y="13" width="8" height="8" rx="1.5" {...s} /><rect x="13" y="13" width="8" height="8" rx="1.5" {...s} /></svg>;
const BitrateIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 16V9M8.5 19V5M13 16v-7M17.5 19V5M21 14v-4" {...s} /></svg>;
const CHIP_ICON: Record<ChipIcon, JSX.Element> = { clock: <ClockIcon />, ratio: <RatioIcon />, resolution: <ResolutionIcon />, bitrate: <BitrateIcon />, quality: <QualityIcon />, batch: <BatchIcon /> };

const ChevronIcon = () => <svg viewBox="0 0 24 24" className="st-chevron" aria-hidden="true"><path d="M9 5l7 7-7 7" {...s} /></svg>;
const PlusIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" {...s} /></svg>;
const MinusIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" {...s} /></svg>;
const PencilIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l4.5-1 10-10-3.5-3.5-10 10L4 20Z" {...s} /></svg>;
const HistoryIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8V4m0 4h4M4 8a8.5 8.5 0 1 1-.5 5" {...s} /><path d="M12 8v4.5l3 1.8" {...s} /></svg>;
const BookIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6.5C10.5 5.3 8.4 4.75 4 4.75v13.5c4.4 0 6.5.55 8 1.75 1.5-1.2 3.6-1.75 8-1.75V4.75c-4.4 0-6.5.55-8 1.75Zm0 0V20" {...s} /></svg>;
const FilterIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M7 12h10M10 17h4" {...s} /></svg>;
const InfoIcon = () => <svg viewBox="0 0 24 24" className="st-info" aria-hidden="true"><circle cx="12" cy="12" r="8.5" {...s} /><path d="M12 11v5M12 8h.01" {...s} /></svg>;
const AtIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" {...s} /><path d="M16 8v5a3 3 0 0 0 5 2 9 9 0 1 0-3 5" {...s} /></svg>;
const SoundIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9v6h3l4 3.5v-13L8 9H5Z" {...s} /><path d="M16 9.5a4 4 0 0 1 0 5" {...s} /></svg>;
const SlidersIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h10M18 8h2M4 16h4M12 16h8" {...s} /><circle cx="16" cy="8" r="2" {...s} /><circle cx="10" cy="16" r="2" {...s} /></svg>;
const ArrowUpIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V6M6 12l6-6 6 6" {...s} /></svg>;
const SparkIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z" fill="currentColor" /></svg>;
