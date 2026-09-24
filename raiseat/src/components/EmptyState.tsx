import type { ReactNode } from 'react';

export default function EmptyState({
  icon, title, children,
}: { icon: string; title: string; children?: ReactNode }) {
  return (
    <div className="empty-state text-center py-5">
      <div className="empty-icon" aria-hidden>{icon}</div>
      <h3 className="h5 mt-3">{title}</h3>
      {children && <div className="text-muted mt-2">{children}</div>}
    </div>
  );
}
