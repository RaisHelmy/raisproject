import { useEffect, useState } from "react";
import { formatMYR } from "@raisai/shared";
import { api } from "../../lib/api";
import { EmptyState } from "../../components/EmptyState";
import { useBalance } from "./useBalance";

interface TransactionDTO {
  id: string;
  type: "deposit" | "reservation" | "charge" | "refund" | "adjustment";
  amountSen: number;
  balanceAfterSen: number;
  referenceType: string | null;
  note: string | null;
  createdAt: string;
}

const TYPE_LABEL: Record<TransactionDTO["type"], string> = {
  deposit: "Added balance",
  reservation: "Held for a generation",
  charge: "Charged",
  refund: "Returned unused hold",
  adjustment: "Adjustment",
};

export function BalancePage() {
  const { balance } = useBalance(true);
  const [items, setItems] = useState<TransactionDTO[] | null>(null);

  useEffect(() => {
    api<{ items: TransactionDTO[] }>("/balance/transactions")
      .then((r) => setItems(r.items))
      .catch(() => setItems([]));
  }, []);

  return (
    <section className="workspace-page">
      <div className="workspace-page-head"><div><p className="lp-eyebrow mb-2">Usage & billing</p><h1 className="display-6 fw-bold mb-2">Balance</h1><p className="text-secondary mb-0">Transparent MYR billing, estimates before runs, and an audit-friendly ledger.</p></div><span className="badge rounded-pill text-bg-warning"><i className="bi bi-building me-1" />Enterprise controls · coming soon</span></div>
      <div className="row g-3 mb-4">
        <div className="col-sm-6 col-lg-4">
          <div className="card h-100">
            <div className="card-body">
              <p className="text-secondary small mb-1">Available</p>
              <p className="h3 mb-0">{balance ? formatMYR(balance.availableSen) : "—"}</p>
            </div>
          </div>
        </div>
        <div className="col-sm-6 col-lg-4">
          <div className="card h-100">
            <div className="card-body">
              <p className="text-secondary small mb-1">Held for running work</p>
              <p className="h3 mb-0">{balance ? formatMYR(balance.reservedSen) : "—"}</p>
              <p className="text-secondary small mb-0">Returned automatically if unused.</p>
            </div>
          </div>
        </div>
      </div>

      <h2 className="h5 mb-2">Activity</h2>
      {items === null && <p className="text-secondary">Loading…</p>}
      {items !== null && items.length === 0 && (
        <EmptyState icon="receipt" title="No activity yet." description="Deposits and charges will appear here." />
      )}
      {items !== null && items.length > 0 && (
        <div className="table-responsive">
          <table className="table align-middle">
            <caption className="visually-hidden">Balance activity, newest first</caption>
            <thead>
              <tr>
                <th scope="col">What</th>
                <th scope="col" className="text-end">Amount</th>
                <th scope="col" className="text-end">Balance after</th>
                <th scope="col">When</th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id}>
                  <td>
                    {TYPE_LABEL[t.type]}
                    {t.note && <div className="text-secondary small">{t.note}</div>}
                  </td>
                  <td className={`text-end ${t.amountSen < 0 ? "" : "text-success"}`}>{formatMYR(t.amountSen)}</td>
                  <td className="text-end">{formatMYR(t.balanceAfterSen)}</td>
                  <td className="text-secondary small">{new Date(t.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
