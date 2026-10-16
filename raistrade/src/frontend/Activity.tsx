import { useEffect, useState } from "react";
import { api } from "./api";
import { AuditTable, TradeTable } from "./AutoTrade";
import { StatementButtons } from "./Statement";
import { useSessions } from "./Sessions";

export function Activity() {
  const [tab, setTab] = useState<"trades" | "audit">("trades");
  const [trades, setTrades] = useState<any[]>([]);
  const [log, setLog] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const { activeId: sid } = useSessions();
  useEffect(() => {
    const load = () => {
      api("/api/trades/all").then((r) => setTrades(r.data)).catch(() => {});
      api("/api/audit").then((r) => setLog(r.data)).catch(() => {});
    };
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, []);
  const match = (o: any) => !q || JSON.stringify(o).toLowerCase().includes(q.toLowerCase());
  return (
    <div className="panel p-2">
      <div className="d-flex flex-wrap align-items-center gap-2 px-2 pt-1 mb-2">
        <ul className="nav nav-pills">
          <li className="nav-item"><button className={`nav-link py-1 ${tab === "trades" ? "active" : ""}`} onClick={() => setTab("trades")}>Bot trade history</button></li>
          <li className="nav-item"><button className={`nav-link py-1 ${tab === "audit" ? "active" : ""}`} onClick={() => setTab("audit")}>Audit trail</button></li>
        </ul>
        {sid && <StatementButtons sessionId={sid} />}
        <input className="form-control form-control-sm ms-auto" style={{ maxWidth: 260 }} placeholder="Filter…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {tab === "trades" ? <TradeTable rows={trades.filter(match)} showRule /> : <AuditTable rows={log.filter(match)} showRule />}
      <div className="text-secondary small px-2 py-2">The audit trail records every manual order, bot signal, open/close, win/loss, auto-stop and rule change (append-only).</div>
    </div>
  );
}
