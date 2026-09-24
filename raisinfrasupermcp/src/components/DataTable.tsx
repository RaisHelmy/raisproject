import type { ReactNode } from "react";
import { EmptyState } from "./Panels";

export interface Column<T> { key: string; header: ReactNode; render: (row: T) => ReactNode; width?: string; align?: "left" | "right" | "center" }

export function DataTable<T>({ rows, columns, rowKey, onRowClick, empty, dense }: { rows: T[]; columns: Column<T>[]; rowKey: (r: T) => string; onRowClick?: (r: T) => void; empty?: ReactNode; dense?: boolean }) {
  if (!rows.length) return <>{empty ?? <EmptyState title="Nothing here yet" />}</>;
  return <div className="table-wrap"><table className={`table-smcp${dense ? " dense" : ""}`}><thead><tr>{columns.map((c) => <th key={c.key} style={{ width: c.width, textAlign: c.align }}>{c.header}</th>)}</tr></thead>
    <tbody>{rows.map((r) => <tr key={rowKey(r)} className={onRowClick ? "clickable" : ""} onClick={onRowClick ? () => onRowClick(r) : undefined} tabIndex={onRowClick ? 0 : undefined} onKeyDown={onRowClick ? (e) => { if (e.key === "Enter") onRowClick(r); } : undefined}>{columns.map((c) => <td key={c.key} style={{ textAlign: c.align }}>{c.render(r)}</td>)}</tr>)}</tbody></table></div>;
}

export function FilterBar({ children }: { children: ReactNode }) { return <div className="filter-bar">{children}</div>; }
