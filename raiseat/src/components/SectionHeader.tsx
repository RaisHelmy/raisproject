import type { ReactNode } from 'react';

export default function SectionHeader({
  title, subtitle, action,
}: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="d-flex justify-content-between align-items-end mb-3 mt-4">
      <div>
        <h2 className="h5 mb-0">{title}</h2>
        {subtitle && <div className="small text-muted">{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}
