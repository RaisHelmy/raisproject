export type BadgeTone = "green" | "gold" | "red" | "blue" | "gray";

export function StatusBadge({ tone, children }: { tone: BadgeTone; children: React.ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
