import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { INSTRUMENTS } from "../shared/market";
import { MOOMOO, MOOMOO_MATRIX, moomooProduct, moomooSupported } from "../shared/moomoo";
import type { RuleMode } from "../shared/strategies";

// "moomoo API only" view (default on): hides what moomoo OpenAPI can't trade — binary options and
// instruments without a moomoo product. Turn it off to see the simulator-only extras again.

const KEY = "rt.moomooOnly";
let on = (() => { try { return localStorage.getItem(KEY) !== "0"; } catch { return true; } })();

export const moomooOnly = () => on;
export function setMoomooOnly(v: boolean) {
  on = v;
  try { localStorage.setItem(KEY, v ? "1" : "0"); } catch { /* ignore */ }
  window.dispatchEvent(new Event("rt:scope"));
}
export function useScope(): boolean {
  const [v, setV] = useState(on);
  useEffect(() => { const f = () => setV(on); window.addEventListener("rt:scope", f); return () => window.removeEventListener("rt:scope", f); }, []);
  return v;
}

export const shownInstruments = () => (on ? INSTRUMENTS.filter((i) => moomooSupported(i.code)) : INSTRUMENTS);
export const codeShown = (code: string) => !on || moomooSupported(code);
export const modeShown = (m: RuleMode) => !on || m === "STOCK";

export function MoomooBadge({ code }: { code: string }) {
  const m = moomooProduct(code);
  if (!m) return <span className="badge text-bg-secondary" title="No moomoo product — simulator only">sim only</span>;
  return m.via === "futures" ? <span className="badge text-bg-info" title={`On moomoo: ${m.product}`}>futures {m.contract}</span> : null;
}

export function ScopeButton() {
  const v = useScope();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={`icon-btn px-2 fw-semibold ${v ? "scope-on" : ""}`} style={{ width: "auto", fontSize: ".78rem" }} onClick={() => setOpen(true)}
        title="What moomoo OpenAPI can trade">{v ? "moomoo API" : "All markets"}</button>
      {/* Portal: the sticky top bar's backdrop-filter would otherwise trap this fixed dialog inside it. */}
      {open && createPortal(
        <div className="modal d-block rt-modal" onClick={() => setOpen(false)}>
          <div className="modal-dialog modal-lg modal-dialog-scrollable" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content panel">
              <div className="modal-header">
                <div><h5 className="modal-title mb-0">What moomoo OpenAPI can trade</h5>
                  <div className="small text-secondary">Live trading via <code>place_order</code> for a <b>moomoo Malaysia</b> account</div></div>
                <button className="btn-close ms-auto" onClick={() => setOpen(false)} />
              </div>
              <div className="modal-body">
                <label className="d-flex align-items-center gap-2 mb-3 p-2 rounded" style={{ background: "var(--muted)" }}>
                  <input type="checkbox" className="form-check-input m-0" checked={v} onChange={(e) => setMoomooOnly(e.target.checked)} />
                  <span><b>Show only what moomoo API can trade</b><br /><span className="small text-secondary">Hides binary options and USD/MYR across the app. Turn off to use the simulator-only extras.</span></span>
                </label>
                <table className="table table-sm small-table mb-3">
                  <thead><tr><th>Market</th><th>Products</th><th>moomoo MY</th><th>Note</th></tr></thead>
                  <tbody>{MOOMOO_MATRIX.map((r) => (
                    <tr key={r.market + r.products}><td>{r.market}</td><td style={{ whiteSpace: "normal" }}>{r.products}</td>
                      <td>{r.my === true ? <span className="text-up">✓ yes</span> : r.my === "futures" ? <span className="text-up">✓ yes</span> : <span className="text-down">✗ no</span>}</td>
                      <td className="text-secondary" style={{ whiteSpace: "normal" }}>{r.note ?? ""}</td></tr>
                  ))}</tbody>
                </table>
                <div className="step-title">This app's instruments on moomoo</div>
                <table className="table table-sm small-table mb-2">
                  <thead><tr><th>Instrument</th><th>Trade it on moomoo as</th></tr></thead>
                  <tbody>{INSTRUMENTS.map((i) => { const m = MOOMOO[i.code]; return (
                    <tr key={i.code}><td><b>{i.code}</b> <span className="text-secondary">{i.name}</span></td>
                      <td>{m ? <>{m.product}{m.contract && <span className="text-secondary"> · {m.contract}</span>}</> : <span className="text-down">Not tradable on moomoo</span>}</td></tr>); })}</tbody>
                </table>
                <div className="small text-secondary">Options, warrants and futures contract specs (multipliers, margin, expiry) aren't simulated here — futures-mapped instruments trade as the underlying price. Source: moomoo OpenAPI docs, trading support table; confirm your account permissions with moomoo before trading live.</div>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
