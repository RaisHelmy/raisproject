/**
 * Progress rail for multi-step workflows (legacy plan, connection wizard,
 * robo trading setup). Shows position, step count and current step title.
 */
export function WorkflowStepper({
  steps,
  current,
}: {
  steps: string[];
  current: number; // 0-based
}) {
  return (
    <div className="stepper">
      <div className="stepper-rail" aria-hidden>
        {steps.map((_, i) => (
          <span key={i} style={{ display: "contents" }}>
            <span
              className={`stepper-dot ${i < current ? "done" : i === current ? "current" : ""}`}
            >
              {i < current ? "✓" : i + 1}
            </span>
            {i < steps.length - 1 && <span className={`stepper-line ${i < current ? "done" : ""}`} />}
          </span>
        ))}
      </div>
      <div className="stepper-meta">
        <div className="st-step">
          Step {current + 1} of {steps.length}
        </div>
        <h2 className="st-title">{steps[current]}</h2>
      </div>
    </div>
  );
}
