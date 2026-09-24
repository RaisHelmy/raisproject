import { useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { useMutation } from "@tanstack/react-query";
import { getStripe } from "../lib/stripe";
import { api, ApiClientError } from "../lib/api";

interface DepositModalProps {
  outletId: string;
  reservationId: string;
  currency: string;
  onClose: () => void;
  onSuccess: () => void;
}

function PaymentForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);
    const result = await stripe.confirmPayment({ elements, redirect: "if_required" });
    setSubmitting(false);
    if (result.error) {
      setError(result.error.message ?? "Payment failed");
      return;
    }
    onSuccess();
  }

  return (
    <div>
      <PaymentElement />
      {error && <div className="alert alert-danger py-2 mt-2 mb-0">{error}</div>}
      <div className="d-flex gap-2 mt-3">
        <button className="btn btn-primary btn-sm" onClick={() => void onSubmit()} disabled={submitting || !stripe}>
          {submitting ? "Processing…" : "Charge card"}
        </button>
        <button className="btn btn-outline-secondary btn-sm" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export function DepositModal({ outletId, reservationId, currency, onClose, onSuccess }: DepositModalProps) {
  const [amount, setAmount] = useState("20.00");
  const [type, setType] = useState<"deposit" | "preauth" | "prepaid" | "cancellation_fee">("deposit");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);

  const createIntent = useMutation({
    mutationFn: () =>
      api.post<{ clientSecret: string }>(`/api/reservations/${outletId}/${reservationId}/deposit`, {
        amountMinor: Math.round(Number(amount) * 100),
        currency,
        type,
      }),
    onSuccess: (data) => setClientSecret(data.clientSecret),
    onError: (err) => {
      if (err instanceof ApiClientError && err.code === "PAYMENTS_NOT_CONFIGURED") {
        setNotConfigured(true);
      } else {
        setError(err instanceof ApiClientError ? err.message : "Failed to start payment");
      }
    },
  });

  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
      style={{ background: "rgba(0,0,0,0.4)", zIndex: 1050 }}
    >
      <div className="card p-4" style={{ width: 420 }}>
        <h2 className="h6 mb-3">Take payment</h2>

        {notConfigured && (
          <div className="alert alert-warning py-2 small mb-3">
            Stripe isn't configured for this restaurant yet. Set <code>STRIPE_SECRET_KEY</code> (server) and{" "}
            <code>VITE_STRIPE_PUBLISHABLE_KEY</code> (build) to accept card payments.
          </div>
        )}
        {error && <div className="alert alert-danger py-2 small">{error}</div>}

        {!clientSecret && !notConfigured && (
          <>
            <div className="mb-2">
              <label className="form-label small">Type</label>
              <select className="form-select form-select-sm" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
                <option value="deposit">Deposit</option>
                <option value="preauth">Card pre-authorization</option>
                <option value="prepaid">Prepaid</option>
                <option value="cancellation_fee">Cancellation fee</option>
              </select>
            </div>
            <div className="mb-3">
              <label className="form-label small">Amount ({currency})</label>
              <input
                type="number"
                min={0.5}
                step={0.01}
                className="form-control form-control-sm"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="d-flex gap-2">
              <button className="btn btn-primary btn-sm" onClick={() => createIntent.mutate()} disabled={createIntent.isPending}>
                {createIntent.isPending ? "Starting…" : "Continue"}
              </button>
              <button className="btn btn-outline-secondary btn-sm" onClick={onClose}>
                Cancel
              </button>
            </div>
          </>
        )}

        {clientSecret && (
          <Elements stripe={getStripe()} options={{ clientSecret }}>
            <PaymentForm onClose={onClose} onSuccess={onSuccess} />
          </Elements>
        )}

        {notConfigured && (
          <button className="btn btn-outline-secondary btn-sm mt-2" onClick={onClose}>
            Close
          </button>
        )}
      </div>
    </div>
  );
}
