import type { ReactNode } from "react";

/**
 * Guided empty state — never just "No data". Explains why the page is
 * empty, what belongs here, and exactly how to fill it.
 */
export function EmptyState({
  icon,
  title,
  body,
  steps,
  action,
}: {
  icon: string;
  title: string;
  body: ReactNode;
  steps?: string[];
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="es-icon" aria-hidden>
        {icon}
      </div>
      <h2 className="es-title">{title}</h2>
      <p className="es-body">{body}</p>
      {steps && steps.length > 0 && (
        <ol className="es-steps">
          {steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      )}
      {action && <div className="es-cta">{action}</div>}
    </div>
  );
}
