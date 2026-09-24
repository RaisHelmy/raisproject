import type { ReactNode } from "react";

/**
 * Success state: explains what happened AND what comes next — never a bare
 * "Success!".
 */
export function SuccessState({
  title,
  body,
  nextLabel,
  nextBody,
  actions,
}: {
  title: string;
  body: ReactNode;
  nextLabel?: string;
  nextBody?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="result-state">
      <div className="rs-icon ok" aria-hidden>
        ✓
      </div>
      <h2 className="rs-title">{title}</h2>
      <p className="rs-body">{body}</p>
      {nextBody && (
        <div className="rs-next">
          <div className="label">{nextLabel ?? "Next recommended step"}</div>
          {nextBody}
        </div>
      )}
      {actions && <div className="rs-cta">{actions}</div>}
    </div>
  );
}

/**
 * Actionable error state: what happened, whether data is safe, what to do,
 * and whether retrying is appropriate.
 */
export function ErrorState({
  title,
  dataSafety,
  reason,
  lastSuccess,
  actions,
}: {
  title: string;
  dataSafety: ReactNode;
  reason: ReactNode;
  lastSuccess?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="result-state">
      <div className="rs-icon err" aria-hidden>
        !
      </div>
      <h2 className="rs-title">{title}</h2>
      <p className="rs-body">{dataSafety}</p>
      <dl className="err-detail">
        <dt>Possible reason</dt>
        <dd>{reason}</dd>
        {lastSuccess && (
          <>
            <dt>Last successful sync</dt>
            <dd>{lastSuccess}</dd>
          </>
        )}
      </dl>
      {actions && <div className="rs-cta">{actions}</div>}
    </div>
  );
}
