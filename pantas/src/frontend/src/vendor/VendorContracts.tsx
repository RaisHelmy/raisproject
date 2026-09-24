import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../api";

interface Contract {
  id: string;
  pricePerMealMinor: number;
  status: string;
  mealTime: string;
}

interface Offer {
  id: string;
  proposedPricePerMealMinor: number;
  proposedByRole: string;
  status: string;
}

export default function VendorContracts() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [counterRinggit, setCounterRinggit] = useState("8.00");
  const [error, setError] = useState<string | null>(null);

  async function loadContracts() {
    try {
      setContracts(await api.get<Contract[]>("/vendor-contracts"));
    } catch (err) {
      console.error(err);
    }
  }

  async function loadOffers(contractId: string) {
    setSelected(contractId);
    try {
      setOffers(await api.get<Offer[]>(`/vendor-contracts/${contractId}/offers`));
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    loadContracts();
  }, []);

  async function submitCounter(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setError(null);
    try {
      await api.post(`/vendor-contracts/${selected}/offers`, {
        proposedPricePerMealMinor: Math.round(parseFloat(counterRinggit) * 100),
      });
      await loadOffers(selected);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not submit counter-offer");
    }
  }

  async function accept(offerId: string) {
    try {
      await api.post(`/vendor-contracts/offers/${offerId}/accept`);
      if (selected) await loadOffers(selected);
      await loadContracts();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not accept offer");
    }
  }

  return (
    <div className="row g-4">
      <div className="col-md-5">
        <h4>Catering contracts</h4>
        <ul className="list-group">
          {contracts.map((c) => (
            <li
              key={c.id}
              className={`list-group-item list-group-item-action ${selected === c.id ? "active" : ""}`}
              role="button"
              onClick={() => loadOffers(c.id)}
            >
              RM {(c.pricePerMealMinor / 100).toFixed(2)}/meal @ {c.mealTime} ·{" "}
              <span className="badge text-bg-secondary">{c.status}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="col-md-7">
        {selected ? (
          <>
            <h4>Negotiation</h4>
            {error && <div className="alert alert-danger py-2">{error}</div>}
            <ul className="list-group mb-3">
              {offers.map((o) => (
                <li key={o.id} className="list-group-item d-flex justify-content-between align-items-center">
                  <span>
                    RM {(o.proposedPricePerMealMinor / 100).toFixed(2)} from {o.proposedByRole} ·{" "}
                    <span className="badge text-bg-secondary">{o.status}</span>
                  </span>
                  {o.status === "pending" && (
                    <button className="btn btn-sm btn-success" onClick={() => accept(o.id)}>
                      Accept
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <form onSubmit={submitCounter} className="d-flex gap-2">
              <input
                type="number"
                step="0.01"
                className="form-control"
                value={counterRinggit}
                onChange={(e) => setCounterRinggit(e.target.value)}
              />
              <button className="btn btn-outline-primary">Counter-offer</button>
            </form>
          </>
        ) : (
          <p className="text-muted">Select a contract to negotiate.</p>
        )}
      </div>
    </div>
  );
}
