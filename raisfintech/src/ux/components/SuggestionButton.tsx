import { useState, type FormEvent } from "react";
import { api } from "../../lib/api";

/**
 * "Suggest an idea" — attached to every predefined-content area (theories,
 * strategies, markets, providers…). Users describe what they'd like to see;
 * admins review it in System → Admin and approve, reject or mark it
 * implemented. Approved suggestions earn the contributor +150 points.
 */
export function SuggestionButton({ context, label = "Suggest an idea" }: { context: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const close = () => {
    setOpen(false);
    setSent(false);
    setError(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/suggestions", { context, title, description });
      setSent(true);
      setTitle("");
      setDescription("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sending failed — your text is still here.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button className="btn btn-secondary" onClick={() => setOpen(true)}>
        💡 {label}
      </button>
      {open && (
        <div className="overlay" onClick={close} role="dialog" aria-modal="true" aria-label="Suggest an idea">
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            {sent ? (
              <>
                <h2 className="modal-title">✓ Suggestion received</h2>
                <div className="modal-body">
                  <p>
                    Thank you — an administrator will review it. You can follow its status under{" "}
                    <strong>System → Settings → My Suggestions</strong>. If it's approved, you
                    earn <strong>+150 points</strong>, and it may become a new feature or entry.
                  </p>
                </div>
                <div className="modal-actions">
                  <button className="btn btn-primary" onClick={close}>Done</button>
                </div>
              </>
            ) : (
              <form onSubmit={submit}>
                <h2 className="modal-title">Suggest an idea</h2>
                <div className="modal-body">
                  <p style={{ marginBottom: 16 }}>
                    What's missing here? Describe it — an administrator reads every suggestion
                    and decides whether to add it.
                  </p>
                  {error && (
                    <div className="alert alert-warn" style={{ marginBottom: 14 }}>
                      <span aria-hidden>⚠️</span>
                      <span>{error}</span>
                    </div>
                  )}
                  <div className="field">
                    <label>Title</label>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Add a Wyckoff method theory"
                      required
                      autoFocus
                    />
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label>Describe your idea</label>
                    <textarea
                      rows={4}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="What should it cover, and why would it help your decisions?"
                      required
                    />
                    <div className="hint">Suggested from: {context}</div>
                  </div>
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn btn-secondary" onClick={close}>Cancel</button>
                  <button className="btn btn-primary" disabled={busy}>
                    {busy ? "Sending…" : "Send Suggestion"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export function SuggestionStatusBadgeTone(status: string): "green" | "gold" | "red" | "blue" | "gray" {
  switch (status) {
    case "approved":
      return "green";
    case "implemented":
      return "blue";
    case "rejected":
      return "red";
    default:
      return "gold";
  }
}
