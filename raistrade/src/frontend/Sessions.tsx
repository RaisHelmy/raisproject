import { useEffect, useMemo, useState } from "react";
import { TEMPLATE_BY_ID } from "../shared/strategies";
import { BY_CODE } from "../shared/market";
import { api, money } from "./api";
import { AssetIcon } from "./Watchlist";
import { EquityChart, RuleDetail, type Rule } from "./AutoTrade";
import { fromUSD, symbol, toUSD } from "./currency";
import { toast } from "./toast";
import { StatementButtons } from "./Statement";
import { Cleansing } from "./Cleansing";

export interface SessionSummary {
  id: number; name: string; status: "ACTIVE" | "STOPPED"; parent_id: number | null; notes: string | null; created_at: number; stopped_at: number | null;
  start_stock: number; start_binary: number; end_stock: number; end_binary: number; start_total: number; end_total: number;
  pnl: number; change_pct: number; trades: number; wins: number; win_rate: number | null; costs: number; duration_ms: number;
  rules: number; active_rules: number; stopped_rules: number; bin_trades: number; bin_wins: number; bin_losses: number; bin_pnl: number;
  bin_volume: number; bin_payout: number; bin_open: number; fills: number; stock_net: number; stock_gross: number; fees: number;
}

const dur = (ms: number) => { const m = Math.floor(ms / 60000); return m < 60 ? `${m}m` : m < 1440 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h`; };
const pctS = (x: number | null) => (x == null ? "—" : `${(x * 100).toFixed(1)}%`);
const signed = (v: number) => `${v >= 0 ? "+" : ""}${money(v)}`;

/** Re-fetches the session list; components listen to "rt:session" to refresh after start/stop. */
export function useSessions() {
  const [list, setList] = useState<SessionSummary[] | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  useEffect(() => {
    const load = () => api("/api/sessions").then((r) => { setList(r.data); setActiveId(r.active_id); }).catch(() => {});
    load();
    const t = setInterval(load, 10_000);
    window.addEventListener("rt:session", load);
    return () => { clearInterval(t); window.removeEventListener("rt:session", load); };
  }, []);
  return { list, activeId };
}

export function SessionChip({ onOpen }: { onOpen: () => void }) {
  const { list, activeId } = useSessions();
  const s = list?.find((x) => x.id === activeId);
  return (
    <button className={`icon-btn px-2 ${s ? "" : "text-down"}`} style={{ width: "auto", fontSize: ".78rem" }} onClick={onOpen} title="Sessions">
      {s ? <><span className="live-dot me-1" style={{ width: 7, height: 7 }} />{s.name} <span className={s.pnl >= 0 ? "text-up" : "text-down"}>{signed(s.pnl)}</span></> : "⏸ No session"}
    </button>
  );
}

function Kpi({ l, v, sub, cls }: { l: string; v: React.ReactNode; sub?: React.ReactNode; cls?: string }) {
  return <div className="col-6 col-md-4 col-xl-2"><div className="kpi h-100"><div className="kpi-l">{l}</div><div className={`kpi-v ${cls ?? ""}`} style={{ fontSize: "1.15rem" }}>{v}</div>{sub && <div className="text-secondary" style={{ fontSize: ".7rem" }}>{sub}</div>}</div></div>;
}

function Summary({ s, parent }: { s: SessionSummary; parent?: SessionSummary | null }) {
  const be = s.bin_payout ? 1 / (1 + s.bin_payout) : null;
  const d = (a: number, b: number | undefined, f: (x: number) => string) => (b == null ? null : <span className={a - b >= 0 ? "text-up" : "text-down"}>{a - b >= 0 ? "▲" : "▼"} {f(Math.abs(a - b))} vs #{parent!.id}</span>);
  return (
    <div className="row g-2">
      <Kpi l="Practice (binary)" v={money(s.end_binary)} sub={<>started {money(s.start_binary)}</>} cls={s.end_binary >= s.start_binary ? "" : "text-down"} />
      <Kpi l="Stock account" v={money(s.end_stock)} sub={<>started {money(s.start_stock)}</>} />
      <Kpi l="Net P/L" v={signed(s.pnl)} cls={s.pnl >= 0 ? "text-up" : "text-down"} sub={parent ? d(s.pnl, parent.pnl, money) : "realized, after costs"} />
      <Kpi l="Win rate" v={pctS(s.win_rate)} cls={s.win_rate != null && be != null ? (s.win_rate >= be ? "text-up" : "text-down") : ""} sub={be ? `break-even ${pctS(be)} (binary)` : `${s.wins}W / ${s.trades - s.wins}L`} />
      <Kpi l="Trades" v={s.trades} sub={`${s.bin_trades} binary · ${s.fills} stock fills${s.bin_open ? ` · ${s.bin_open} open` : ""}`} />
      <Kpi l="Robots" v={`${s.active_rules}/${s.rules}`} sub={`running · ${s.stopped_rules} auto-stopped · costs ${money(s.costs)}`} />
      
    </div>
  );
}

function NewSession({ list, onClose }: { list: SessionSummary[]; onClose: () => void }) {
  const [name, setName] = useState(`Session ${list.length + 1}`);
  const [refId, setRefId] = useState<number | "">(list[0]?.id ?? "");
  const [rules, setRules] = useState<Rule[]>([]);
  const [pick, setPick] = useState<Set<number>>(new Set());
  const [fresh, setFresh] = useState(true);
  const [deposit, setDeposit] = useState(() => Math.round(fromUSD(46.6)));
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!refId) { setRules([]); setPick(new Set()); return; }
    api(`/api/sessions/${refId}`).then((r) => { setRules(r.data.rules); setPick(new Set(r.data.rules.filter((x: Rule) => x.pnl > 0).map((x: Rule) => x.id))); }).catch(() => {});
  }, [refId]);
  const create = async () => {
    setBusy(true);
    try {
      const r = await api("/api/sessions", { body: { name, ref_id: refId || null, copy_rule_ids: [...pick], deposit_usd: fresh ? toUSD(deposit) : null, notes } });
      toast.ok(`${name} started${r.data.copied ? ` with ${r.data.copied} robots` : ""}`);
      window.dispatchEvent(new Event("rt:session"));
      onClose();
    } catch (e) { toast.err((e as Error).message); } finally { setBusy(false); }
  };
  const ref = list.find((x) => x.id === refId);
  return (
    <div className="modal d-block rt-modal" onClick={onClose}>
      <div className="modal-dialog modal-lg modal-dialog-scrollable" onClick={(e) => e.stopPropagation()}>
        <div className="modal-content panel">
          <div className="modal-header"><h5 className="modal-title">New session</h5><button className="btn-close ms-auto" onClick={onClose} /></div>
          <div className="modal-body">
            <div className="row g-2 mb-3">
              <div className="col-md-6"><label className="form-label small text-secondary mb-1">Name</label><input className="form-control form-control-sm" value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div className="col-md-6"><label className="form-label small text-secondary mb-1">Based on (reference session)</label>
                <select className="form-select form-select-sm" value={refId} onChange={(e) => setRefId(e.target.value ? Number(e.target.value) : "")}>
                  <option value="">— start empty —</option>
                  {list.map((s) => <option key={s.id} value={s.id}>#{s.id} {s.name} · {signed(s.pnl)} · {pctS(s.win_rate)} wins</option>)}
                </select></div>
            </div>
            <div className="step-title">Money</div>
            <div className="d-flex flex-wrap gap-3 align-items-center mb-3 small">
              <label className="d-flex align-items-center gap-2"><input type="radio" className="form-check-input m-0" checked={fresh} onChange={() => setFresh(true)} /> Fresh deposit
                <span className="input-group input-group-sm" style={{ width: 150 }}><span className="input-group-text">{symbol()}</span><input className="form-control" type="number" value={deposit} disabled={!fresh} onChange={(e) => setDeposit(Number(e.target.value))} /></span></label>
              <label className="d-flex align-items-center gap-2"><input type="radio" className="form-check-input m-0" checked={!fresh} onChange={() => setFresh(false)} /> Carry over current balance</label>
            </div>
            {fresh && <div className="fee-check mid mb-3">A fresh deposit resets both accounts to {symbol()}{deposit.toLocaleString()} and clears open stock positions from the books. The previous session's history is kept.</div>}
            {ref && <>
              <div className="d-flex align-items-center gap-2 mb-1">
                <div className="step-title mb-0">Copy robots from #{ref.id} {ref.name}</div>
                <div className="ms-auto d-flex gap-1">
                  <button className="chip" onClick={() => setPick(new Set(rules.map((r) => r.id)))}>All</button>
                  <button className="chip" onClick={() => setPick(new Set(rules.filter((r) => r.pnl > 0).map((r) => r.id)))}>Profitable</button>
                  <button className="chip" onClick={() => setPick(new Set(rules.filter((r) => r.wins + r.losses > 0 && r.wins / (r.wins + r.losses) >= 1 / (1 + BY_CODE[r.code]!.payout)).map((r) => r.id)))}>Above break-even</button>
                  <button className="chip" onClick={() => setPick(new Set())}>None</button>
                </div>
              </div>
              <div className="table-responsive mb-2" style={{ maxHeight: 300 }}>
                <table className="table table-sm small-table tabular mb-0">
                  <thead className="sticky-top"><tr><th /><th>Robot</th><th className="text-end">W/L</th><th className="text-end">Win</th><th className="text-end">P/L</th><th>Status</th></tr></thead>
                  <tbody>{rules.map((r) => { const n = r.wins + r.losses; return (
                    <tr key={r.id} role="button" onClick={() => setPick((s) => { const x = new Set(s); x.has(r.id) ? x.delete(r.id) : x.add(r.id); return x; })}>
                      <td><input type="checkbox" className="form-check-input m-0" readOnly checked={pick.has(r.id)} /></td>
                      <td><AssetIcon code={r.code} size={18} /> {r.name}</td>
                      <td className="text-end">{r.wins}/{r.losses}</td><td className="text-end">{n ? pctS(r.wins / n) : "—"}</td>
                      <td className={`text-end ${r.pnl >= 0 ? "text-up" : "text-down"}`}>{money(r.pnl)}</td><td className="text-secondary">{r.status}</td>
                    </tr>); })}</tbody>
                </table>
              </div>
              <div className="small text-secondary">{pick.size} robot{pick.size === 1 ? "" : "s"} will be copied with fresh stats (same strategy, asset and stake).</div>
            </>}
            <label className="form-label small text-secondary mb-1 mt-3">Notes (optional)</label>
            <input className="form-control form-control-sm" placeholder="e.g. only robots above break-even, smaller stakes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="modal-footer">
            <span className="small text-secondary me-auto">Starting this session stops the current one — its open trades still settle.</span>
            <button className="btn btn-outline-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-accent px-4" disabled={busy} onClick={create}>{busy ? "Starting…" : "▶ Start session"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SessionDetail({ id }: { id: number }) {
  const [d, setD] = useState<any>(null);
  const [rule, setRule] = useState<Rule | null>(null);
  useEffect(() => {
    const load = () => api(`/api/sessions/${id}`).then((r) => setD(r.data)).catch(() => {});
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [id]);
  if (!d) return <div className="panel p-4 text-center text-secondary">Loading…</div>;
  const s: SessionSummary = d.summary;
  return (
    <div className="panel p-3">
      <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
        <h5 className="mb-0 fw-bold">#{s.id} {s.name}</h5>
        <span className={`badge ${s.status === "ACTIVE" ? "text-bg-success" : "text-bg-secondary"}`}>{s.status === "ACTIVE" ? "● RUNNING" : "STOPPED"}</span>
        <span className="small text-secondary">{new Date(s.created_at).toLocaleString()} · {dur(s.duration_ms)}{s.parent_id ? ` · based on #${s.parent_id}` : ""}</span>
        <span className="ms-auto"><StatementButtons sessionId={s.id} /></span>
      </div>
      {s.notes && <div className="small text-secondary mb-2">📝 {s.notes}</div>}
      <Summary s={s} parent={d.parent} />
      <div className="row g-3 mt-1">
        <div className="col-lg-7">
          <div className="step-title mt-2">Equity (net P/L over time)</div>
          {d.equity.length ? <EquityChart data={d.equity} /> : <div className="text-secondary small py-4 text-center">No settled trades yet</div>}
        </div>
        <div className="col-lg-5">
          <div className="step-title mt-2">Breakdown</div>
          <div className="small">
            {[["Binary P/L", signed(s.bin_pnl)], ["Binary staked", money(s.bin_volume)], ["Binary record", `${s.bin_wins}W / ${s.bin_losses}L`],
              ["Stock P/L before costs", signed(s.stock_gross)], ["Stock fees & taxes", `−${money(s.fees)}`], ["Stock P/L after costs", signed(s.stock_net)],
              ["Binary balance", `${money(s.start_binary)} → ${money(s.end_binary)}`], ["Stock balance", `${money(s.start_stock)} → ${money(s.end_stock)}`]].map(([l, v]) => (
              <div key={l} className="d-flex justify-content-between border-bottom py-1"><span className="text-secondary">{l}</span><span className="tabular">{v}</span></div>
            ))}
            {d.parent && <div className="mt-2 text-secondary">vs #{d.parent.id} {d.parent.name}: P/L {signed(d.parent.pnl)}, win rate {pctS(d.parent.win_rate)}, {d.parent.trades} trades.</div>}
          </div>
        </div>
      </div>
      <div className="step-title mt-3">Robots in this session ({d.rules.length})</div>
      <div className="table-responsive">
        <table className="table table-sm table-hover small-table tabular mb-0">
          <thead><tr><th>Robot</th><th>Strategy</th><th className="text-end">W/L</th><th className="text-end">Win</th><th className="text-end">Needs</th><th className="text-end">P/L</th><th>Status</th></tr></thead>
          <tbody>{d.rules.map((r: Rule) => { const n = r.wins + r.losses, be = r.mode === "BINARY" ? 1 / (1 + BY_CODE[r.code]!.payout) : null; return (
            <tr key={r.id} role="button" onClick={() => setRule(r)}>
              <td><AssetIcon code={r.code} size={18} /> {r.name}</td>
              <td className="text-secondary">{TEMPLATE_BY_ID[r.template]?.name}</td>
              <td className="text-end">{r.wins}/{r.losses}</td>
              <td className={`text-end ${n && be ? (r.wins / n >= be ? "text-up" : "text-down") : ""}`}>{n ? pctS(r.wins / n) : "—"}</td>
              <td className="text-end text-secondary">{be ? pctS(be) : "—"}</td>
              <td className={`text-end ${r.pnl >= 0 ? "text-up" : "text-down"}`}>{money(r.pnl)}</td>
              <td className="text-secondary" title={r.stop_reason ?? ""}>{r.status}</td>
            </tr>); })}</tbody>
        </table>
      </div>
      {rule && <RuleDetail rule={rule} onClose={() => setRule(null)} />}
    </div>
  );
}

function ShareReport() {
  const [st, setSt] = useState<{ enabled: boolean; key: string | null } | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => { api("/api/share").then(setSt).catch(() => {}); }, []);
  const set = async (enable: boolean, rotate = false) => {
    try { setSt(await api("/api/share", { body: { enable, rotate } })); toast.ok(enable ? (rotate ? "New link created — the old one no longer works" : "Report sharing on") : "Report link revoked"); }
    catch (e) { toast.err((e as Error).message); }
  };
  const base = `${location.origin}/mcp/r/${st?.key ?? ""}`;
  const copy = (t: string) => { navigator.clipboard?.writeText(t); toast.ok("Copied"); };
  return (
    <>
      <button className="btn btn-outline-secondary" onClick={() => setOpen(true)}>🔗 Share report{st?.enabled ? " · on" : ""}</button>
      {open && (
        <div className="modal d-block rt-modal" onClick={() => setOpen(false)}>
          <div className="modal-dialog modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content panel">
              <div className="modal-header"><h5 className="modal-title">Share a read-only performance report</h5><button className="btn-close ms-auto" onClick={() => setOpen(false)} /></div>
              <div className="modal-body small">
                <p className="text-secondary">A secret link that lets an AI assistant (ChatGPT, Claude, Gemini) or a person read your bot's results: session summary, every robot vs break-even, equity curve, drawdown, an engine replay check and methodology. It contains <b>no password, cookies or account identifiers</b> and <b>cannot place trades</b>. Anyone with the link can read it — revoke it any time.</p>
                {st?.enabled && st.key ? (
                  <>
                    {[["MCP server (ChatGPT / Claude / Gemini connector)", base], ["Readable report (markdown)", base], ["Full data (JSON)", `${base}/report.json`]].map(([l, u]) => (
                      <div key={l} className="mb-2"><div className="text-secondary mb-1">{l}</div>
                        <div className="input-group input-group-sm"><input className="form-control" readOnly value={u} onFocus={(e) => e.target.select()} /><button className="btn btn-outline-secondary" onClick={() => copy(u!)}>Copy</button></div></div>
                    ))}
                    <div className="d-flex gap-2 mt-3">
                      <button className="btn btn-outline-warning" onClick={() => set(true, true)}>🔄 New link</button>
                      <button className="btn btn-outline-danger" onClick={() => set(false)}>Revoke</button>
                    </div>
                  </>
                ) : <button className="btn btn-accent" onClick={() => set(true)}>Create share link</button>}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function Sessions() {
  const { list, activeId } = useSessions();
  const [sel, setSel] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const shown = sel ?? activeId ?? list?.[0]?.id ?? null;
  const total = useMemo(() => (list ?? []).reduce((t, s) => t + s.pnl, 0), [list]);
  const stop = async (id: number) => {
    if (!confirm("Stop this session? Its robots stop opening new trades; trades already open will still settle.")) return;
    try { await api(`/api/sessions/${id}/stop`, { method: "POST" }); toast.ok("Session stopped"); window.dispatchEvent(new Event("rt:session")); }
    catch (e) { toast.err((e as Error).message); }
  };
  if (!list) return <div className="panel p-4 text-center text-secondary">Loading sessions…</div>;
  return (
    <div>
      <div className="d-flex flex-wrap align-items-end gap-2 mb-3">
        <div><h2 className="h4 fw-bold mb-1">🗂 Sessions</h2>
          <div className="small text-secondary">Each session is one trading run with its own robots and history. {list.length} session{list.length === 1 ? "" : "s"} · all-time net {signed(total)}</div></div>
        <div className="ms-auto d-flex gap-2">
          <ShareReport />
          {activeId && <button className="btn btn-outline-danger" onClick={() => stop(activeId)}>⏹ Stop current session</button>}
          <button className="btn btn-accent" onClick={() => setCreating(true)}>+ New session</button>
        </div>
      </div>
      {!activeId && <div className="fee-check bad mb-3"><b>No session is running.</b> Robots and manual trading are paused until you start a new session.</div>}
      <div className="row g-3">
        <div className="col-lg-3">
          <div className="d-flex flex-column gap-2">
            {list.map((s) => (
              <button key={s.id} className={`goal-card text-start ${shown === s.id ? "active" : ""}`} onClick={() => setSel(s.id)}>
                <div className="d-flex align-items-center gap-2"><b>#{s.id} {s.name}</b>
                  <span className={`badge ms-auto ${s.status === "ACTIVE" ? "text-bg-success" : "text-bg-secondary"}`}>{s.status === "ACTIVE" ? "RUNNING" : "STOPPED"}</span></div>
                <div className="small text-secondary">{new Date(s.created_at).toLocaleDateString()} · {dur(s.duration_ms)} · {s.rules} robots</div>
                <div className="d-flex justify-content-between small mt-1"><span className={s.pnl >= 0 ? "text-up" : "text-down"}>{signed(s.pnl)} ({s.change_pct >= 0 ? "+" : ""}{s.change_pct.toFixed(1)}%)</span><span className="text-secondary">{pctS(s.win_rate)} wins · {s.trades} trades</span></div>
              </button>
            ))}
          </div>
        </div>
        <div className="col-lg-9">{shown && <SessionDetail id={shown} />}</div>
      </div>
      {creating && <NewSession list={list} onClose={() => setCreating(false)} />}
    </div>
  );
}
