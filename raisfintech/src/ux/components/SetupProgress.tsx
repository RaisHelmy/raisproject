import { useNavigate } from "react-router-dom";
import { useGuidance } from "../GuidanceContext";
import { SETUP_STEPS, setupPercent } from "../guidance";

/**
 * Persistent setup progress: bar + checklist. Clicking an incomplete item
 * takes the user straight to the relevant page. Used full-size on the
 * Setup page and compact on the dashboard.
 */
export function SetupProgress({ compact = false }: { compact?: boolean }) {
  const { state } = useGuidance();
  const navigate = useNavigate();
  const pct = setupPercent(state);

  return (
    <div className="card setup-progress">
      <div className="sp-head">
        <div>
          <div className="card-title">Your Rais Fintech setup</div>
          {!compact && (
            <p className="muted">Complete these steps to unlock your full workspace.</p>
          )}
        </div>
        <div className="sp-pct">{pct}%</div>
      </div>
      <div className="progress-track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <ul className="setup-list">
        {SETUP_STEPS.map((step) => {
          const done = step.done(state);
          return (
            <li key={step.id}>
              <button
                className={`setup-item ${done ? "done" : ""}`}
                onClick={() => !done && navigate(step.route)}
                disabled={done}
              >
                <span className={`si-mark ${done ? "done" : "todo"}`}>{done ? "✓" : "•"}</span>
                <span className="si-label">{step.label}</span>
                {!done && <span className="si-go">Set up →</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
