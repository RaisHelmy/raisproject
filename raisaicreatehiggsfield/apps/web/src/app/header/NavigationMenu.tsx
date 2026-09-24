import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { Link, useLocation } from "react-router-dom";
import { HEADER_ITEMS, matchesPath, type MenuEntry, type MenuItem, type MenuSection } from "./menuData";
import { MENU_ICONS } from "./menuIcons";

/* Timings mirror the reference's Radix NavigationMenu configuration. */
const OPEN_DELAY = 150;
const CLOSE_DELAY = 150;
const SKIP_DELAY = 300;

type DropdownItem = Extract<MenuItem, { kind: "dropdown" }>;

function slug(id: string): string {
  return id.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

/**
 * The header's primary navigation: a horizontally scrollable list of links,
 * separators and dropdown triggers, plus one shared viewport under the bar
 * that shows the open trigger's panel. Hover opens after a short delay,
 * leaving both trigger and panel closes after a short delay, and a panel
 * switch inside the skip window is immediate, the way the reference behaves.
 */
export function NavigationMenu({ items = HEADER_ITEMS }: { items?: MenuItem[] }) {
  const navRef = useRef<HTMLElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipUntil = useRef(0);

  const [value, setValue] = useState<string | null>(null);
  const [vpLeft, setVpLeft] = useState(0);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const location = useLocation();

  const dropdowns = items.filter((i): i is DropdownItem => i.kind === "dropdown");
  const active = value ? dropdowns.find((d) => d.id === value) ?? null : null;

  const clearOpen = () => { if (openTimer.current) { clearTimeout(openTimer.current); openTimer.current = null; } };
  const clearClose = () => { if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; } };

  const open = useCallback((id: string) => {
    clearClose();
    clearOpen();
    if (value !== null || Date.now() < skipUntil.current) {
      setValue(id);
      return;
    }
    openTimer.current = setTimeout(() => setValue(id), OPEN_DELAY);
  }, [value]);

  const close = useCallback(() => {
    clearOpen();
    clearClose();
    closeTimer.current = setTimeout(() => {
      setValue(null);
      skipUntil.current = Date.now() + SKIP_DELAY;
    }, CLOSE_DELAY);
  }, []);

  const closeNow = useCallback(() => {
    clearOpen();
    clearClose();
    setValue(null);
  }, []);

  // Navigating anywhere closes the panel.
  useEffect(() => { closeNow(); }, [location.pathname, location.search, closeNow]);

  // Escape closes; clicking outside closes.
  useEffect(() => {
    if (!value) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeNow(); };
    const onDown = (e: PointerEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) closeNow();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [value, closeNow]);

  useEffect(() => () => { clearOpen(); clearClose(); }, []);

  // Measure the open panel so the viewport can size (and animate) to it.
  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!value || !el) { setSize(null); return; }
    const measure = () => setSize({ w: el.offsetWidth, h: el.offsetHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [value]);

  // Position the viewport: panels align with the container's left padding,
  // except those flagged to sit under their own trigger (clamped to the window).
  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!value || !nav) return;
    const r = nav.getBoundingClientRect();
    const item = dropdowns.find((d) => d.id === value);
    if (!item?.alignToTrigger) {
      const container = nav.closest<HTMLElement>(".hf-container");
      if (!container) { setVpLeft(0); return; }
      const pad = Number.parseFloat(getComputedStyle(container).paddingLeft) || 0;
      setVpLeft(container.getBoundingClientRect().left + pad - r.left);
      return;
    }
    const trigger = nav.querySelector<HTMLElement>(`[data-nav-trigger="${CSS.escape(value)}"]`);
    if (!trigger) return;
    const width = (size?.w ?? 0) + 2; // + border
    const max = Math.max(0, window.innerWidth - 8 - r.left - width);
    setVpLeft(Math.max(0, Math.min(trigger.getBoundingClientRect().left - r.left, max)));
  }, [value, size, dropdowns]);

  // Fade the list edges only when there is something scrolled out of view.
  const updateScroll = useCallback(() => {
    const host = hostRef.current;
    const list = listRef.current;
    if (!host || !list) return;
    host.toggleAttribute("data-scroll-start", list.scrollLeft <= 1);
    host.toggleAttribute("data-scroll-end", list.scrollLeft + list.clientWidth >= list.scrollWidth - 1);
  }, []);
  useEffect(() => {
    updateScroll();
    const list = listRef.current;
    if (!list) return;
    const ro = new ResizeObserver(updateScroll);
    ro.observe(list);
    return () => ro.disconnect();
  }, [updateScroll]);

  const viewportStyle = {
    "--hfnav-vp-left": `${vpLeft}px`,
  } as CSSProperties;
  const panelStyle = size
    ? ({ "--hfnav-vp-w": `${size.w}px`, "--hfnav-vp-h": `${size.h}px` } as CSSProperties)
    : undefined;

  return (
    <nav ref={navRef} aria-label="Main" className="hfnav-main">
      <div ref={hostRef} className="hfnav-scroll-host" data-scroll-start="" data-scroll-end="">
        <div style={{ position: "relative" }}>
          <ul ref={listRef} className="hfnav-list hide-scrollbar" onScroll={updateScroll}>
            {items.map((item) => (
              <NavItemView
                key={item.id}
                item={item}
                openId={value}
                pathname={location.pathname}
                onEnter={open}
                onLeave={close}
                onSelect={closeNow}
              />
            ))}
          </ul>
        </div>
      </div>
      <div className="hfnav-viewport-position" style={viewportStyle}>
        {active && (
          <div
            className="hfnav-viewport"
            data-state="open"
            style={panelStyle}
            onMouseEnter={clearClose}
            onMouseLeave={close}
          >
            <div
              ref={contentRef}
              id={`hfnav-content-${slug(active.id)}`}
              aria-labelledby={`hfnav-trigger-${slug(active.id)}`}
              className="hfnav-content"
              role="group"
            >
              <DropdownPanel item={active} onSelect={closeNow} />
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

function isActive(activeOn: string[], pathname: string): boolean {
  return activeOn.some((p) => matchesPath(p, pathname));
}

function NavItemView(props: {
  item: MenuItem;
  openId: string | null;
  pathname: string;
  onEnter: (id: string) => void;
  onLeave: () => void;
  onSelect: () => void;
}) {
  const { item, openId, pathname } = props;
  if (item.kind === "separator") {
    return <li role="separator" aria-orientation="vertical" className="hfnav-separator" />;
  }
  const active = isActive(item.activeOn, pathname);
  if (item.kind === "link") {
    const cls = `hfnav-item${item.accent ? " hfnav-item-accent" : ""}`;
    const body = (
      <>
        {item.accent && <SupercomputerDots />}
        <span>{item.label}</span>
        {item.badge && <span className="hfnav-bar-badge">{item.badge}</span>}
      </>
    );
    return (
      <li>
        {item.external ? (
          <a href={item.href} target="_blank" rel="noopener noreferrer" className={cls} data-active={active || undefined}>
            {body}
          </a>
        ) : (
          <Link to={item.href} className={cls} data-active={active || undefined} aria-current={active ? "page" : undefined} onClick={props.onSelect}>
            {body}
          </Link>
        )}
      </li>
    );
  }
  const open = openId === item.id;
  const id = slug(item.id);
  return (
    <li>
      <Link
        to={item.href}
        id={`hfnav-trigger-${id}`}
        className="hfnav-item"
        data-nav-trigger={item.id}
        data-state={open ? "open" : "closed"}
        data-active={active || undefined}
        aria-expanded={open}
        aria-controls={`hfnav-content-${id}`}
        aria-haspopup="true"
        onMouseEnter={() => props.onEnter(item.id)}
        onMouseLeave={props.onLeave}
        onFocus={() => props.onEnter(item.id)}
        onClick={props.onSelect}
      >
        {item.label}
      </Link>
    </li>
  );
}

function SupercomputerDots() {
  return (
    <span aria-hidden="true" className="hf-sc-dots">
      <span>
        <i style={{ left: 0, top: 0, animationDelay: "0ms" }} />
        <i style={{ left: 5, top: 0, animationDelay: "160ms" }} />
        <i style={{ left: 0, top: 5, animationDelay: "320ms" }} />
        <i style={{ left: 5, top: 5, animationDelay: "480ms" }} />
      </span>
    </span>
  );
}

function DropdownPanel({ item, onSelect }: { item: DropdownItem; onSelect: () => void }) {
  return (
    <div className="hfnav-panel">
      {item.sections.map((s) => <PanelSection key={s.id} section={s} onSelect={onSelect} />)}
    </div>
  );
}

function PanelSection({ section, onSelect }: { section: MenuSection; onSelect: () => void }) {
  if (section.items.length === 0) return null;
  return (
    <div className="hfnav-section">
      <p className="hfnav-section-heading">{section.heading}</p>
      {section.items.map((e) => <PanelEntry key={e.id} entry={e} onSelect={onSelect} />)}
    </div>
  );
}

export function PanelEntry({ entry, onSelect }: { entry: MenuEntry; onSelect?: () => void }) {
  const badge = entry.badge ?? null;
  return (
    <Link to={entry.href} className="hfnav-entry" data-nav-entry={entry.id} onClick={onSelect}>
      <div className="hfnav-entry-icon" data-badge={badge?.color}>
        <MenuEntryIcon icon={entry.icon} />
        {badge && (
          <span className="hfnav-entry-badge">
            <span data-color={badge.color}>{badge.label}</span>
          </span>
        )}
      </div>
      <div className="hfnav-entry-text">
        <p className="hfnav-entry-title">{entry.title}</p>
        <p className="hfnav-entry-subtitle">{entry.subtitle}</p>
      </div>
    </Link>
  );
}

/** Static, first-party SVG markup from menuIcons.ts; nothing user-supplied reaches here. */
export function MenuEntryIcon({ icon }: { icon: string }) {
  const svg = MENU_ICONS[icon];
  if (!svg) return <span className="hfnav-entry-glyph">·</span>;
  return <span className="hfnav-entry-svg" aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />;
}
