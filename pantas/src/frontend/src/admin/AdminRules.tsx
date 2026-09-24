import { useState, type FormEvent } from "react";
import { api, ApiError } from "../api";

const JOB_TYPES = ["food_order", "item_order", "fetch", "delivery", "ride", "vehicle_rental"];

export default function AdminRules() {
  const [commissionJobType, setCommissionJobType] = useState(JOB_TYPES[0]);
  const [commissionRinggit, setCommissionRinggit] = useState("2.00");
  const [commissionMsg, setCommissionMsg] = useState<string | null>(null);

  const [perkName, setPerkName] = useState("Verified priority window");
  const [perkTier, setPerkTier] = useState<"unverified" | "verified">("verified");
  const [perkType, setPerkType] = useState("priority_window");
  const [perkMsg, setPerkMsg] = useState<string | null>(null);

  async function onCommission(e: FormEvent) {
    e.preventDefault();
    setCommissionMsg(null);
    try {
      await api.post("/admin/commission-rules", {
        jobType: commissionJobType,
        amountMinor: Math.round(parseFloat(commissionRinggit) * 100),
      });
      setCommissionMsg("Created.");
    } catch (err) {
      setCommissionMsg(err instanceof ApiError ? err.message : "Failed");
    }
  }

  async function onPerk(e: FormEvent) {
    e.preventDefault();
    setPerkMsg(null);
    try {
      await api.post("/admin/perk-rules", { name: perkName, verificationTier: perkTier, perkType });
      setPerkMsg("Created.");
    } catch (err) {
      setPerkMsg(err instanceof ApiError ? err.message : "Failed");
    }
  }

  return (
    <div className="row g-4">
      <div className="col-md-6">
        <h4>Commission rules</h4>
        <p className="text-muted small">Flat fee per job type — never a percentage (CLAUDE.md "Money").</p>
        <form onSubmit={onCommission} className="card card-body">
          <div className="mb-2">
            <label className="form-label">Job type</label>
            <select className="form-select" value={commissionJobType} onChange={(e) => setCommissionJobType(e.target.value)}>
              {JOB_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="mb-2">
            <label className="form-label">Flat fee (RM)</label>
            <input
              type="number"
              step="0.01"
              className="form-control"
              value={commissionRinggit}
              onChange={(e) => setCommissionRinggit(e.target.value)}
            />
          </div>
          {commissionMsg && <div className="alert alert-info py-2">{commissionMsg}</div>}
          <button className="btn btn-primary">Create rule</button>
        </form>
      </div>

      <div className="col-md-6">
        <h4>Perk rules</h4>
        <p className="text-muted small">
          Data-driven, not hardcoded — e.g. who gets the 60s FCFS priority window (CLAUDE.md).
        </p>
        <form onSubmit={onPerk} className="card card-body">
          <div className="mb-2">
            <label className="form-label">Name</label>
            <input className="form-control" value={perkName} onChange={(e) => setPerkName(e.target.value)} />
          </div>
          <div className="mb-2">
            <label className="form-label">Applies to verification tier</label>
            <select className="form-select" value={perkTier} onChange={(e) => setPerkTier(e.target.value as never)}>
              <option value="unverified">unverified</option>
              <option value="verified">verified</option>
            </select>
          </div>
          <div className="mb-2">
            <label className="form-label">Perk type</label>
            <select className="form-select" value={perkType} onChange={(e) => setPerkType(e.target.value)}>
              <option value="priority_window">priority_window</option>
              <option value="voucher">voucher</option>
              <option value="order_value_limit">order_value_limit</option>
              <option value="cod_eligible">cod_eligible</option>
            </select>
          </div>
          {perkMsg && <div className="alert alert-info py-2">{perkMsg}</div>}
          <button className="btn btn-primary">Create rule</button>
        </form>
      </div>
    </div>
  );
}
