import { useState } from "react";
import { useGuidance } from "../GuidanceContext";

export interface TourStep {
  title: string;
  body: string;
}

/**
 * Optional, skippable product tour shown as a non-blocking card in the
 * corner. Completion (or dismissal) is remembered — the same tour is never
 * shown twice.
 */
export function FeatureTour({ tourId, steps }: { tourId: string; steps: TourStep[] }) {
  const { state, markTourDone } = useGuidance();
  const [i, setI] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || state.toursDone.includes(tourId) || steps.length === 0) return null;

  const finish = () => {
    markTourDone(tourId);
    setDismissed(true);
  };

  const step = steps[i];
  return (
    <aside className="tour-card" aria-label="Product tour">
      <div className="tc-step">
        {i + 1}/{steps.length}
      </div>
      <div className="tc-title">{step.title}</div>
      <p className="tc-body">{step.body}</p>
      <div className="tc-actions">
        {i > 0 && (
          <button className="btn btn-sm btn-secondary" onClick={() => setI(i - 1)}>
            Back
          </button>
        )}
        {i < steps.length - 1 ? (
          <button className="btn btn-sm btn-gold" onClick={() => setI(i + 1)}>
            Next
          </button>
        ) : (
          <button className="btn btn-sm btn-gold" onClick={finish}>
            Finish
          </button>
        )}
        <button className="tc-skip" onClick={finish}>
          Skip tour
        </button>
      </div>
    </aside>
  );
}
