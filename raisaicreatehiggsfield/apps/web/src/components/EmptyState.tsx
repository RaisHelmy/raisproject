import type { ReactNode } from "react";

export function EmptyState(props: { icon: string; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="text-center py-5 border rounded-3 bg-body-tertiary" role="status">
      <i className={`bi bi-${props.icon} fs-1 text-secondary`} aria-hidden="true" />
      <h2 className="h5 mt-3">{props.title}</h2>
      {props.description && <p className="text-secondary mb-3">{props.description}</p>}
      {props.action}
    </div>
  );
}
