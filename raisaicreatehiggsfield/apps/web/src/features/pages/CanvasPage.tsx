import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
  ADD_NODE_ITEMS, AGENT_SUGGESTIONS, ASSET_THUMBS, EDGES, GROUPS, IMAGE_PICKER, NODES, VERSIONS, VIDEO_PICKER,
  type CanvasGroup, type CanvasNode, type PickerModel, type PortKind,
} from "./canvasData";

/**
 * The Canvas editor, following the reference editor: floating title and
 * account pills over a dot grid, grouped nodes with icon ports joined by thin
 * wires, blue selection handles with a floating action pill, the bottom tool
 * bar, zoom and minimap controls, the title menu with version history, the
 * add-node popover, the node inspector with its model picker, the assets
 * picker and the Agent panel. UI only — nothing runs a graph.
 */
type Tool = "select" | "hand" | "pen" | "sticky" | "shape" | "text" | "react" | "comment" | "table" | "frame" | "search" | "add";
type Panel = null | "agent" | "assets" | "add";

const SCENE_W = 1440;
const DRAG_THRESHOLD = 3;

/** What a pointer press is doing until it is released. */
type Drag =
  | { kind: "node"; id: string; startX: number; startY: number; orig: Map<string, { x: number; y: number }>; moved: boolean }
  | { kind: "group"; id: string; startX: number; startY: number; orig: Map<string, { x: number; y: number }>; group: { x: number; y: number }; moved: boolean }
  | { kind: "pan"; startX: number; startY: number; orig: { x: number; y: number }; moved: boolean };

export function CanvasPage() {
  const { user } = useAuth();
  const [tool, setTool] = useState<Tool>("select");
  const [zoom, setZoom] = useState(28);
  const [title, setTitle] = useState("Untitled");
  const [selected, setSelected] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [minimap, setMinimap] = useState(false);
  const [titleMenu, setTitleMenu] = useState(false);
  const [nodes, setNodes] = useState<CanvasNode[]>(NODES);
  const [groups, setGroups] = useState<CanvasGroup[]>(GROUPS);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);

  const node = nodes.find((n) => n.id === selected) ?? null;

  /** Screen pixels per scene unit, including the responsive scale and zoom. */
  const sceneScale = () => (sceneRef.current?.getBoundingClientRect().width ?? SCENE_W) / SCENE_W;

  const beginDrag = (e: ReactPointerEvent, drag: Drag) => {
    dragRef.current = drag;
    boardRef.current?.setPointerCapture(e.pointerId);
    setDragging(true);
  };

  const startNodeDrag = (e: ReactPointerEvent, id: string) => {
    if (e.button !== 0 || tool !== "select") return;
    e.stopPropagation();
    const n = nodes.find((x) => x.id === id);
    if (!n) return;
    beginDrag(e, { kind: "node", id, startX: e.clientX, startY: e.clientY, orig: new Map([[id, { x: n.x, y: n.y }]]), moved: false });
  };

  const startGroupDrag = (e: ReactPointerEvent, id: string) => {
    if (e.button !== 0 || tool !== "select") return;
    e.stopPropagation();
    const g = groups.find((x) => x.id === id);
    if (!g) return;
    // A group carries every node whose centre sits inside its frame.
    const members = nodes.filter((n) => n.x + n.w / 2 > g.x && n.x + n.w / 2 < g.x + g.w && n.y + n.h / 2 > g.y && n.y + n.h / 2 < g.y + g.h);
    beginDrag(e, { kind: "group", id, startX: e.clientX, startY: e.clientY, orig: new Map(members.map((n) => [n.id, { x: n.x, y: n.y }])), group: { x: g.x, y: g.y }, moved: false });
  };

  const onBoardPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    // Controls floating over the board (zoom pill, Ask Agent, minimap) keep their clicks.
    if ((e.target as HTMLElement).closest(".cv-zoom, .cv-ask, .cv-minimap, .cv-seltools")) return;
    const wantsPan = tool === "hand" || e.button === 1;
    if (wantsPan) {
      e.preventDefault();
      beginDrag(e, { kind: "pan", startX: e.clientX, startY: e.clientY, orig: { ...pan }, moved: false });
      return;
    }
    if (e.target === e.currentTarget) { setSelected(null); if (panel !== "agent") setPanel(null); }
  };

  const onBoardPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const dxScreen = e.clientX - d.startX; const dyScreen = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dxScreen, dyScreen) < DRAG_THRESHOLD) return;
    d.moved = true;
    if (d.kind === "pan") { setPan({ x: d.orig.x + dxScreen, y: d.orig.y + dyScreen }); return; }
    const k = sceneScale(); const dx = dxScreen / k; const dy = dyScreen / k;
    setNodes((prev) => prev.map((n) => { const o = d.orig.get(n.id); return o ? { ...n, x: Math.round(o.x + dx), y: Math.round(o.y + dy) } : n; }));
    if (d.kind === "group") setGroups((prev) => prev.map((g) => (g.id === d.id ? { ...g, x: Math.round(d.group.x + dx), y: Math.round(d.group.y + dy) } : g)));
  };

  const onBoardPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    dragRef.current = null;
    setDragging(false);
    if (boardRef.current?.hasPointerCapture(e.pointerId)) boardRef.current.releasePointerCapture(e.pointerId);
    if (d && d.kind === "node" && !d.moved) { setSelected(d.id); setPanel((p) => (p === "agent" ? p : null)); }
  };

  // Wheel pans the board; with ctrl/cmd it zooms. Registered natively so the
  // browser's own pinch-zoom can be prevented (React's onWheel is passive).
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) setZoom((z) => Math.min(400, Math.max(10, Math.round(z - e.deltaY * 0.1))));
      else setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const fitToScreen = useCallback(() => { setZoom(28); setPan({ x: 0, y: 0 }); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setSelected(null); setPanel(null); setTitleMenu(false); if (tool === "add") setTool("select"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tool]);

  const pickTool = (t: Tool) => {
    setTool(t);
    setPanel(t === "add" ? "add" : panel === "add" ? null : panel);
  };

  return (
    <div className="cv" data-tool={tool}>
      {/* top-left: logo + title pills */}
      <div className="cv-tl">
        <Link to="/" className="cv-pill cv-logo-pill" aria-label="Home">
          <span className="cv-logo"><LogoGlyph /></span>
          <ChevronDown />
        </Link>
        <div className="cv-title-wrap">
          <button type="button" className="cv-pill cv-title-pill" aria-haspopup="menu" aria-expanded={titleMenu} onClick={() => setTitleMenu((v) => !v)}>
            <span>{title}</span>
            <ChevronDown flip={titleMenu} />
          </button>
          {titleMenu && <TitleMenu onRename={() => { const n = window.prompt("Rename canvas", title); if (n) setTitle(n); setTitleMenu(false); }} onClose={() => setTitleMenu(false)} />}
        </div>
      </div>

      {/* top-right: account + actions */}
      <div className="cv-tr cv-pill">
        <button type="button" className="cv-account" aria-label="Account">
          <span className="cv-avatar">{user ? "R" : <UserIcon />}</span>
          <ChevronDown />
        </button>
        <button type="button" className="cv-iconbtn" aria-label="Notifications"><BellIcon /></button>
        <button type="button" className="cv-chat"><ChatIcon />Chat</button>
        <button type="button" className="cv-share"><ShareIcon />Share</button>
      </div>

      {/* board */}
      <div
        ref={boardRef}
        className="cv-board"
        data-dragging={dragging || undefined}
        onPointerDown={onBoardPointerDown}
        onPointerMove={onBoardPointerMove}
        onPointerUp={onBoardPointerUp}
        onPointerCancel={onBoardPointerUp}
      >
        <div ref={sceneRef} className="cv-scene" style={{ "--z": zoom / 28, "--px": `${pan.x}px`, "--py": `${pan.y}px` } as CSSProperties}>
          <Wires nodes={nodes} />
          {groups.map((g) => (
            <div
              key={g.id}
              className="cv-group"
              data-dashed={g.dashed || undefined}
              style={{ left: g.x, top: g.y, width: g.w, height: g.h }}
              onPointerDown={(e) => startGroupDrag(e, g.id)}
            >
              <span className="cv-group-tag">Group</span>
            </div>
          ))}
          {nodes.map((n) => (
            <NodeView
              key={n.id}
              node={n}
              selected={n.id === selected}
              onSelect={() => { setSelected(n.id); setPanel((p) => (p === "agent" ? p : null)); }}
              onAddPort={() => setPanel("assets")}
              onPointerDown={(e) => startNodeDrag(e, n.id)}
            />
          ))}
          {node && <SelectionToolbar node={node} onDelete={() => setSelected(null)} />}
        </div>

        {minimap && <Minimap nodes={nodes} />}

        <div className="cv-zoom cv-pill">
          <button type="button" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(10, z - 5))}>−</button>
          <span>{zoom}%</span>
          <button type="button" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(400, z + 5))}>+</button>
          <span className="cv-sep" />
          <button type="button" aria-label="Fit to screen" onClick={fitToScreen}><FitIcon /></button>
          <button type="button" aria-label="Toggle minimap" aria-pressed={minimap} data-active={minimap || undefined} onClick={() => setMinimap((v) => !v)}><MapIcon /></button>
        </div>

        <button type="button" className="cv-ask cv-pill" onClick={() => setPanel(panel === "agent" ? null : "agent")}>
          <span className="cv-ask-mark"><LogoGlyph /></span>Ask Agent
        </button>
      </div>

      {/* bottom tool bar */}
      <div className="cv-tools" role="toolbar" aria-label="Canvas tools">
        {TOOLS.map((t) =>
          t.sep ? <span key={t.id} className="cv-tools-sep" /> : (
            <button key={t.id} type="button" aria-label={t.label} aria-pressed={tool === t.id} data-active={tool === t.id || undefined} data-kind={t.id} onClick={() => pickTool(t.id as Tool)}>
              {t.icon}
              {t.badge && <span className="cv-new">{t.badge}</span>}
            </button>
          ),
        )}
      </div>

      {panel === "add" && <AddNodePopover onPick={(label) => { if (label === "Upload" || label === "Assets") setPanel("assets"); else { setPanel(null); setTool("select"); } }} />}
      {node && panel !== "agent" && <Inspector node={node} onClose={() => setSelected(null)} />}
      {panel === "assets" && <AssetsPicker onClose={() => setPanel(null)} />}
      {panel === "agent" && <AgentPanel onClose={() => setPanel(null)} />}
    </div>
  );
}

/* ---- scene pieces ------------------------------------------------------- */

function portPos(n: CanvasNode, side: "in" | "out", index: number) {
  const count = side === "in" ? n.inputs.length : n.outputs.length;
  const gap = 44;
  const y = n.y + n.h / 2 + (index - (count - 1) / 2) * gap;
  return { x: side === "in" ? n.x - 22 : n.x + n.w + 22, y };
}

function Wires({ nodes }: { nodes: CanvasNode[] }) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return (
    <svg className="cv-wires" viewBox="0 0 1440 820" aria-hidden="true">
      {EDGES.map((e, i) => {
        const a = byId.get(e.from); const b = byId.get(e.to);
        if (!a || !b) return null;
        const p1 = portPos(a, "out", 0); const p2 = portPos(b, "in", e.toPort ?? 0);
        const dx = Math.max(60, Math.abs(p2.x - p1.x) * 0.45);
        return <path key={i} data-kind={a.kind === "prompt" ? "text" : "image"} d={`M${p1.x} ${p1.y} C ${p1.x + dx} ${p1.y}, ${p2.x - dx} ${p2.y}, ${p2.x} ${p2.y}`} />;
      })}
    </svg>
  );
}

function NodeView({ node, selected, onSelect, onAddPort, onPointerDown }: {
  node: CanvasNode; selected: boolean; onSelect: () => void; onAddPort: () => void; onPointerDown: (e: ReactPointerEvent) => void;
}) {
  const label = { image: "Image", prompt: "Prompt", "image-gen": "Image Generation", "video-gen": "Video Generation" }[node.kind];
  return (
    <div
      className="cv-node"
      data-kind={node.kind}
      data-selected={selected || undefined}
      style={{ left: node.x, top: node.y, width: node.w, height: node.h }}
      onPointerDown={onPointerDown}
    >
      <span className="cv-node-label">{label}</span>
      <button type="button" className="cv-node-body" onClick={(e) => { e.stopPropagation(); onSelect(); }} aria-label={`Select ${label}`}>
        {node.kind === "prompt" && <p className="cv-node-text">{node.text}</p>}
        {node.img && <img src={node.img} alt="" draggable={false} />}
        {!node.img && node.kind !== "prompt" && <span className="cv-watermark"><LogoGlyph /></span>}
        {node.chips && (
          <div className="cv-node-chips">
            {node.chips.map((c) => <span key={c}>{c}</span>)}
            {node.kind === "image-gen" && <span className="cv-node-collapse"><CollapseIcon /></span>}
          </div>
        )}
        {node.model && (
          <div className="cv-node-prompt">
            <span className="cv-node-describe">Describe...</span>
            <span className="cv-node-model"><ModelGlyph kind={node.kind} />{node.model}<ChevronDown /></span>
            <span className="cv-node-cost"><SparkIcon />{node.cost}</span>
          </div>
        )}
      </button>
      {node.inputs.map((p, i) => <Port key={`in-${i}`} kind={p} pos={portPos(node, "in", i)} node={node} />)}
      {node.outputs.map((p, i) => <Port key={`out-${i}`} kind={p} pos={portPos(node, "out", i)} node={node} />)}
      {node.kind === "prompt" && (
        <button type="button" className="cv-port cv-port-add" style={{ left: node.w / 2 - 14, top: node.h + 8 }} aria-label="Add input" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onAddPort(); }}>+</button>
      )}
      {selected && <><span className="cv-handle" data-corner="tl" /><span className="cv-handle" data-corner="tr" /><span className="cv-handle" data-corner="bl" /><span className="cv-handle" data-corner="br" /></>}
    </div>
  );
}

function Port({ kind, pos, node }: { kind: PortKind; pos: { x: number; y: number }; node: CanvasNode }) {
  return (
    <span className="cv-port" data-kind={kind} style={{ left: pos.x - node.x - 14, top: pos.y - node.y - 14 }} aria-hidden="true">
      {kind === "text" ? <TextGlyph /> : kind === "image" ? <ImageGlyph /> : kind === "video" ? <VideoGlyph /> : <AudioGlyph />}
    </span>
  );
}

function SelectionToolbar({ node, onDelete }: { node: CanvasNode; onDelete: () => void }) {
  return (
    <div className="cv-seltools cv-pill" style={{ left: node.x + node.w / 2, top: node.y - 64 }}>
      <span className="cv-swatch" aria-label="Colour" />
      <button type="button" aria-label="Download"><DownloadIcon /></button>
      <button type="button" aria-label="Delete" onClick={onDelete}><TrashIcon /></button>
    </div>
  );
}

function Minimap({ nodes }: { nodes: CanvasNode[] }) {
  return (
    <div className="cv-minimap">
      <svg viewBox="0 0 1440 820" aria-hidden="true">
        {nodes.map((n) => <rect key={n.id} x={n.x} y={n.y} width={n.w} height={n.h} rx="10" />)}
        <rect className="cv-minimap-view" x="80" y="120" width="540" height="300" rx="14" />
      </svg>
    </div>
  );
}

/* ---- overlays ------------------------------------------------------------ */

function TitleMenu({ onRename, onClose }: { onRename: () => void; onClose: () => void }) {
  const [history, setHistory] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: PointerEvent) => { if (box.current && !box.current.contains(e.target as Node)) onClose(); };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [onClose]);
  return (
    <div className="cv-menu-wrap" ref={box}>
      <div className="cv-menu" role="menu">
        <button type="button" role="menuitem" data-active={history || undefined} onMouseEnter={() => setHistory(true)} onClick={() => setHistory((v) => !v)}>
          <HistoryIcon />Version history<ChevronRight />
        </button>
        <button type="button" role="menuitem" onClick={onRename}><PencilIcon />Rename</button>
        <button type="button" role="menuitem"><DuplicateIcon />Duplicate</button>
        <span className="cv-menu-sep" />
        <button type="button" role="menuitem"><TrashIcon />Delete</button>
      </div>
      {history && (
        <div className="cv-menu cv-history" role="menu">
          <button type="button" role="menuitem" data-active><span className="cv-live-dot" /><span><b>Current canvas</b><small>Live</small></span></button>
          {VERSIONS.map((v) => (
            <button key={v.when} type="button" role="menuitem"><span className="cv-hist-ico"><HistoryIcon /></span><span><b>{v.when}</b><small>{v.note}</small></span></button>
          ))}
        </div>
      )}
    </div>
  );
}

function AddNodePopover({ onPick }: { onPick: (label: string) => void }) {
  const [q, setQ] = useState("");
  const match = (l: string) => l.toLowerCase().includes(q.toLowerCase());
  return (
    <div className="cv-addnode" role="dialog" aria-label="Add node">
      <label className="cv-search">
        <SearchIcon />
        <input autoFocus placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      <div className="cv-addlist">
        {ADD_NODE_ITEMS.main.filter((i) => match(i.label)).map((i) => (
          <button key={i.label} type="button" onClick={() => onPick(i.label)}>
            <span className="cv-addicon" data-tone={i.tone}><AddGlyph label={i.label} /></span>{i.label}
            {"badge" in i && i.badge && <span className="cv-new cv-new-inline">{i.badge}</span>}
          </button>
        ))}
        {ADD_NODE_ITEMS.sections.map((s) => {
          const items = s.items.filter((i) => match(i.label));
          if (!items.length) return null;
          return (
            <div key={s.heading} className="cv-addsection">
              <p>{s.heading}</p>
              {items.map((i) => (
                <button key={i.label} type="button" onClick={() => onPick(i.label)}>
                  <span className="cv-addicon" data-tone={i.tone}><AddGlyph label={i.label} /></span>{i.label}
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Inspector({ node, onClose }: { node: CanvasNode; onClose: () => void }) {
  const isVideo = node.kind === "video-gen";
  const isGen = isVideo || node.kind === "image-gen";
  const [picker, setPicker] = useState(false);
  const [model, setModel] = useState(node.model ?? (isVideo ? "Seedance 2.0" : "GPT Image 2"));
  const [batch, setBatch] = useState(1);
  const [audio, setAudio] = useState(false);
  const [duration, setDuration] = useState(15);
  const title = { image: "Image", prompt: "Prompt", "image-gen": "Image Generation", "video-gen": "Video Generation" }[node.kind];
  useEffect(() => { setModel(node.model ?? (isVideo ? "Seedance 2.0" : "GPT Image 2")); setPicker(false); }, [node.id, node.model, isVideo]);

  return (
    <aside className="cv-inspector" aria-label={`${title} settings`}>
      <header>
        <span className="cv-insp-title">{isVideo ? <VideoGlyph /> : node.kind === "prompt" ? <TextGlyph /> : <ImageGlyph />}{title}</span>
        <button type="button" className="cv-iconbtn" aria-label="Close" onClick={onClose}><CloseIcon /></button>
      </header>

      <div className="cv-insp-body">
        {node.kind === "prompt" && (
          <div className="cv-insp-card cv-insp-textarea">
            <textarea defaultValue={node.text} rows={8} />
          </div>
        )}
        {node.kind === "image" && (
          <div className="cv-insp-card cv-insp-image">
            {node.img && <img src={node.img} alt="" />}
            <div className="cv-insp-actions"><button type="button" className="cv-btn-grey">Replace</button><button type="button" className="cv-btn-grey"><DownloadIcon />Download</button></div>
          </div>
        )}

        {isGen && (
          <>
            <div className="cv-insp-card cv-insp-prompt">
              <button type="button" className="cv-insp-add" aria-label="Add reference">+</button>
              <textarea placeholder="Describe what you want to create..." rows={5} />
            </div>

            <button type="button" className="cv-insp-row cv-insp-model" onClick={() => setPicker((v) => !v)} aria-expanded={picker}>
              <span><small>Model</small><b><ModelGlyph kind={node.kind} inline />{model}</b></span>
              <ChevronRight />
            </button>

            {isVideo && (
              <label className="cv-insp-row cv-insp-slider">
                <span>Duration</span>
                <span className="cv-insp-val"><input type="range" min={4} max={30} value={duration} onChange={(e) => setDuration(Number(e.target.value))} aria-label="Duration" />{duration}</span>
              </label>
            )}

            <div className="cv-insp-grid">
              <button type="button" className="cv-insp-row"><span><small>Resolution</small><b>{isVideo ? "720p" : "2K"}</b></span><ChevronRight /></button>
              <button type="button" className="cv-insp-row"><span><small>Aspect ratio</small><b>1:1</b></span><ChevronRight /></button>
            </div>

            <div className="cv-insp-row cv-insp-batch">
              <span>Batch size</span>
              <span className="cv-stepper">
                <button type="button" aria-label="Decrease" onClick={() => setBatch((b) => Math.max(1, b - 1))}>−</button>
                <b>{batch}/4</b>
                <button type="button" aria-label="Increase" onClick={() => setBatch((b) => Math.min(4, b + 1))}>+</button>
              </span>
            </div>

            {isVideo && (
              <div className="cv-insp-row">
                <span>Generate Audio</span>
                <button type="button" role="switch" aria-checked={audio} className="cv-switch" data-on={audio || undefined} onClick={() => setAudio((v) => !v)}><i /></button>
              </div>
            )}
          </>
        )}
      </div>

      {isGen && <button type="button" className="cv-generate">Generate<SparkIcon />{node.cost ?? (isVideo ? "68" : "6.5")}</button>}
      {isGen && picker && <ModelPicker models={isVideo ? VIDEO_PICKER : IMAGE_PICKER} current={model} onPick={(m) => { setModel(m); setPicker(false); }} />}
    </aside>
  );
}

function ModelPicker({ models, current, onPick }: { models: PickerModel[]; current: string; onPick: (m: string) => void }) {
  const [q, setQ] = useState("");
  return (
    <div className="cv-picker" role="listbox">
      <label className="cv-search"><SearchIcon /><input autoFocus placeholder="Search..." value={q} onChange={(e) => setQ(e.target.value)} /></label>
      <p className="cv-picker-head"><SparkIcon />Featured models</p>
      {models.filter((m) => m.name.toLowerCase().includes(q.toLowerCase())).map((m) => (
        <button key={m.name} type="button" role="option" aria-selected={m.name === current} data-active={m.name === current || undefined} onClick={() => onPick(m.name)}>
          <span className="cv-picker-ico" data-icon={m.icon}><PickerGlyph icon={m.icon} /></span>
          <span className="cv-picker-text">
            <b>{m.name}{m.audio && <AudioGlyph />}{m.top && <span className="cv-top">TOP</span>}</b>
            <small><span><DiamondIcon />{m.res}</span><span><ClockIcon />{m.dur}</span></small>
          </span>
          {m.name === current && <CheckIcon />}
        </button>
      ))}
    </div>
  );
}

function AssetsPicker({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState("Uploads");
  const [filter, setFilter] = useState("Recent");
  return (
    <div className="cv-assets" role="dialog" aria-label="Assets">
      <header>
        <div className="cv-tabs">{["Uploads", "Generations", "Liked"].map((t) => <button key={t} type="button" data-active={t === tab || undefined} onClick={() => setTab(t)}>{t}</button>)}</div>
        <button type="button" className="cv-iconbtn" aria-label="Close" onClick={onClose}><CloseIcon /></button>
      </header>
      <div className="cv-assets-filters">
        <div className="cv-tabs cv-tabs-sm">{["Recent", "All", "Images", "Videos"].map((f) => <button key={f} type="button" data-active={f === filter || undefined} onClick={() => setFilter(f)}>{f}</button>)}</div>
        <button type="button" className="cv-sort"><SortIcon />Sort by</button>
      </div>
      <div className="cv-assets-grid">
        <button type="button" className="cv-upload-tile"><span><UploadIcon /></span>Upload media</button>
        {ASSET_THUMBS.map((t, i) => <button key={i} type="button" className="cv-asset"><img src={t} alt="" /></button>)}
        <span className="cv-asset cv-asset-skel" /><span className="cv-asset cv-asset-skel" />
      </div>
    </div>
  );
}

function AgentPanel({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  return (
    <aside className="cv-agent" aria-label="Agent">
      <header>
        <span className="cv-agent-title"><span className="cv-agent-ico"><LogoGlyph /></span>Agent</span>
        <span className="cv-agent-actions">
          <button type="button" className="cv-iconbtn" aria-label="Expand"><ExpandIcon /></button>
          <button type="button" className="cv-iconbtn" aria-label="Close" onClick={onClose}><CloseIcon /></button>
        </span>
      </header>
      <div className="cv-agent-hero">
        <span className="cv-agent-mark"><LogoGlyph /></span>
        <h2>Rais, let&rsquo;s build an amazing workflow</h2>
      </div>
      <ul className="cv-agent-suggest">
        {AGENT_SUGGESTIONS.map((s) => <li key={s}><button type="button" onClick={() => setQ(s)}><ArrowTurnIcon />{s}</button></li>)}
      </ul>
      <form className="cv-agent-input" onSubmit={(e) => e.preventDefault()}>
        <textarea rows={1} placeholder="Ask Agent" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="cv-agent-foot">
          <button type="button" className="cv-agent-plus" aria-label="Attach">+</button>
          <button type="submit" className="cv-agent-send" aria-label="Send"><ArrowUpIcon /></button>
        </div>
      </form>
    </aside>
  );
}

/* ---- icons ----------------------------------------------------------------- */

const s = { stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
const LogoGlyph = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 15c3-6 5-6 7 0s4 6 7 0" {...s} strokeWidth={2.4} /></svg>;
const ChevronDown = ({ flip }: { flip?: boolean }) => <svg viewBox="0 0 24 24" className="cv-chev" aria-hidden="true" style={flip ? { transform: "rotate(180deg)" } : undefined}><path d="M6 9l6 6 6-6" {...s} /></svg>;
const ChevronRight = () => <svg viewBox="0 0 24 24" className="cv-chev" aria-hidden="true"><path d="M9 6l6 6-6 6" {...s} /></svg>;
const UserIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" {...s} /><path d="M4.5 20c.9-3.6 3.9-5.5 7.5-5.5s6.6 1.9 7.5 5.5" {...s} /></svg>;
const BellIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16ZM10 20a2 2 0 0 0 4 0" {...s} /></svg>;
const ChatIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 1 3.3 6.5L4 20l1.3-3.4A8 8 0 0 1 4 12Z" {...s} /><path d="M9 11h6M9 14h4" {...s} /></svg>;
const ShareIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19c1-5 4-8 10-8V7l6 5-6 5v-4c-4 0-7 1.5-10 6Z" {...s} /></svg>;
const SearchIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6" {...s} /><path d="M16 16l4 4" {...s} /></svg>;
const CloseIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" {...s} /></svg>;
const ExpandIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" {...s} /></svg>;
const DownloadIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v10m0 0l-4-4m4 4l4-4M5 18h14" {...s} /></svg>;
const TrashIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M9 7V5h6v2M8 7l1 12h6l1-12" {...s} /></svg>;
const HistoryIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8V4m0 4h4M4 8a8.5 8.5 0 1 1-.5 5" {...s} /><path d="M12 8v4.5l3 1.8" {...s} /></svg>;
const PencilIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l4-1 10-10-3-3L5 16l-1 4Z" {...s} /></svg>;
const DuplicateIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" {...s} /><path d="M5 15V6a2 2 0 0 1 2-2h9" {...s} /></svg>;
const FitIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" {...s} /></svg>;
const MapIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2V6ZM9 4v14M15 6v14" {...s} /></svg>;
const SparkIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z" fill="currentColor" /></svg>;
const CheckIcon = () => <svg viewBox="0 0 24 24" className="cv-check" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" {...s} strokeWidth={2} /></svg>;
const DiamondIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l9 8-9 10-9-10 9-8Z" {...s} /></svg>;
const ClockIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" {...s} /><path d="M12 7.5V12l3 2" {...s} /></svg>;
const SortIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h10M5 12h7M5 17h4M17 8v9m0 0l-2.5-2.5M17 17l2.5-2.5" {...s} /></svg>;
const UploadIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V8m0 0l-3.5 3.5M12 8l3.5 3.5M7 18a4 4 0 0 1-.7-7.9A6 6 0 0 1 18 9a4 4 0 0 1-1 8.9" {...s} /></svg>;
const ArrowTurnIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5v8a3 3 0 0 0 3 3h9m0 0l-4-4m4 4l-4 4" {...s} /></svg>;
const ArrowUpIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V6M6 12l6-6 6 6" {...s} strokeWidth={2} /></svg>;
const CollapseIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14H4v6M14 10h6V4M4 20l6-6M20 4l-6 6" {...s} /></svg>;
const TextGlyph = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6h12M12 6v13M9 19h6" {...s} /></svg>;
const ImageGlyph = () => <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2" fill="currentColor" opacity=".9" /><path d="M6 17l4-4 3 3 2-2 3 3" stroke="#0f1113" strokeWidth="1.6" fill="none" strokeLinejoin="round" /><circle cx="15.5" cy="9.5" r="1.4" fill="#0f1113" /></svg>;
const VideoGlyph = () => <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="12" height="12" rx="2" fill="currentColor" /><path d="M15 10l5-3v10l-5-3Z" fill="currentColor" /></svg>;
const AudioGlyph = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2" {...s} strokeWidth={2} /></svg>;
const ModelGlyph = ({ kind, inline }: { kind: string; inline?: boolean }) => (
  <span className={`cv-model-glyph${inline ? " inline" : ""}`} aria-hidden="true">
    {kind === "video-gen" ? <svg viewBox="0 0 24 24"><path d="M5 18V10M10 18V6M15 18v-5M20 18V8" {...s} strokeWidth={2.4} /></svg> : <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" {...s} /><path d="M12 4c2.5 2.5 2.5 13.5 0 16M4 12h16" {...s} /></svg>}
  </span>
);
const PickerGlyph = ({ icon }: { icon: PickerModel["icon"] }) => {
  if (icon === "bars") return <svg viewBox="0 0 24 24"><path d="M5 18V10M10 18V6M15 18v-5M20 18V8" {...s} strokeWidth={2.4} /></svg>;
  if (icon === "wave") return <svg viewBox="0 0 24 24"><path d="M3 12c2-6 4-6 6 0s4 6 6 0 4-6 6 0" {...s} /></svg>;
  if (icon === "kling") return <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7" {...s} /><path d="M7 9l10 6M7 15l10-6" {...s} /></svg>;
  if (icon === "flux") return <svg viewBox="0 0 24 24"><path d="M12 4l8 14H4l8-14Zm0 6l3 5H9l3-5Z" {...s} /></svg>;
  return <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7" {...s} /><path d="M6 17L18 7" {...s} /></svg>;
};
const AddGlyph = ({ label }: { label: string }) => {
  if (label.startsWith("Prompt")) return <TextGlyph />;
  if (label.startsWith("Image")) return <ImageGlyph />;
  if (label.startsWith("Video")) return <VideoGlyph />;
  if (label.startsWith("Voice")) return <AudioGlyph />;
  if (label.startsWith("LLM")) return <SparkIcon />;
  if (label === "Upload") return <UploadIcon />;
  if (label === "Assets") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h6l2 2h10v10H3V7Z" fill="currentColor" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2" fill="currentColor" /></svg>;
};

const TOOLS: { id: string; label: string; icon?: JSX.Element; sep?: boolean; badge?: string }[] = [
  { id: "select", label: "Select", icon: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3l14 8-6 1.5L10 19 5 3Z" fill="currentColor" /></svg> },
  { id: "hand", label: "Pan", icon: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 12V6.5a1.5 1.5 0 0 1 3 0V12m0-1.5V5a1.5 1.5 0 0 1 3 0v6m0-.5V6.5a1.5 1.5 0 0 1 3 0V14a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7L5 15a1.5 1.5 0 0 1 2.5-1.6L8 14" {...s} /></svg> },
  { id: "s1", label: "", sep: true },
  { id: "pen", label: "Pen", icon: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l3 7-3 13-3-13 3-7Z" fill="#e8e8ea" /><path d="M9 9h6" stroke="#8a8a8e" strokeWidth="1.2" /></svg> },
  { id: "sticky", label: "Sticky note", icon: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h8l2 2h8v11H3V6Z" fill="#f4d36b" /><path d="M3 10h18v9H3z" fill="#f7e29a" /></svg> },
  { id: "shape", label: "Shapes", icon: <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="10" height="10" rx="2" fill="#7fb2ff" /><circle cx="15.5" cy="15.5" r="5.5" fill="#4a8ff7" /></svg> },
  { id: "s2", label: "", sep: true },
  { id: "text", label: "Text", icon: <TextGlyph /> },
  { id: "react", label: "React", icon: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" {...s} /></svg> },
  { id: "comment", label: "Comment", icon: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 15a3 3 0 0 1-3 3H9l-4 3v-3.5A3 3 0 0 1 4 15V7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v8Z" {...s} /></svg> },
  { id: "table", label: "Table", icon: <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2" {...s} /><path d="M4 10h16M4 15h16M10 4v16" {...s} /></svg> },
  { id: "frame", label: "Frame", badge: "New", icon: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h11v10H4V5Zm11 10h5v5H9v-5" {...s} /></svg> },
  { id: "s3", label: "", sep: true },
  { id: "search", label: "Search", icon: <SearchIcon /> },
  { id: "add", label: "Add node", icon: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" {...s} strokeWidth={2} /></svg> },
];
