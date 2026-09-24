import { Link } from "react-router-dom";
export function Brand({ to = "/", size = "md", tagline }: { to?: string; size?: "md" | "lg"; tagline?: boolean }) {
  return (
    <Link to={to} className="xz-brand">
      <span className={`xz-seal ${size === "lg" ? "lg" : ""}`}>玄</span>
      <span className="d-flex flex-column lh-sm">
        <span className="zh">玄知 AI</span>
        {tagline && <span className="en">XuanZhi AI</span>}
      </span>
    </Link>
  );
}
export function Mountains() {
  return (
    <svg className="xz-mountains" viewBox="0 0 1200 180" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 180 L0 120 C120 100 180 40 300 60 C380 75 420 130 520 110 C600 95 650 30 760 50 C860 70 900 140 1000 120 C1080 105 1120 60 1200 80 L1200 180 Z" fill="var(--xz-paper-3)" />
      <path d="M0 180 L0 150 C140 130 220 90 340 105 C450 118 500 160 620 145 C720 132 780 95 900 110 C1000 122 1080 160 1200 140 L1200 180 Z" fill="var(--xz-line)" />
    </svg>
  );
}
