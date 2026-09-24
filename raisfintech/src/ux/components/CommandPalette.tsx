import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGuidance } from "../GuidanceContext";
import { isFeatureVisible } from "../guidance";

interface Command {
  label: string;
  icon: string;
  group: string;
  route: string;
  feature?: string;
}

const COMMANDS: Command[] = [
  { label: "Dashboard", icon: "🏠", group: "Overview", route: "/" },
  { label: "Portfolio", icon: "📊", group: "Invest", route: "/invest/portfolio" },
  { label: "Holdings", icon: "📑", group: "Invest", route: "/invest/holdings" },
  { label: "Activity — Transactions & Dividends", icon: "🧾", group: "Invest", route: "/invest/activity" },
  { label: "Markets", icon: "🌐", group: "Invest", route: "/invest/markets" },
  { label: "Investment Queue", icon: "🧵", group: "Invest", route: "/invest/queue", feature: "robo" },
  { label: "Connect Moomoo", icon: "🔐", group: "Connections", route: "/connections/moomoo" },
  { label: "Connected Accounts", icon: "🔗", group: "Connections", route: "/connections" },
  { label: "Robo Trading", icon: "🤖", group: "Invest", route: "/invest/robo", feature: "robo" },
  { label: "Strategies", icon: "🧭", group: "Invest", route: "/invest/strategies", feature: "strategies" },
  { label: "Theory Gallery", icon: "📚", group: "Invest", route: "/invest/theories" },
  { label: "Wealth", icon: "💠", group: "Money", route: "/money/wealth" },
  { label: "Cash Flow", icon: "💸", group: "Money", route: "/money/cashflow" },
  { label: "Goals", icon: "🎯", group: "Money", route: "/money/goals" },
  { label: "Zakat", icon: "🕌", group: "Islamic Wealth", route: "/islamic/zakat" },
  { label: "Shariah Screening", icon: "☪️", group: "Islamic Wealth", route: "/islamic/shariah" },
  { label: "Estate Planning", icon: "📜", group: "Islamic Wealth", route: "/islamic/estate" },
  { label: "Family", icon: "👪", group: "Family", route: "/family" },
  { label: "Legacy Plan", icon: "🕊️", group: "Family", route: "/family/legacy", feature: "legacy" },
  { label: "Documents", icon: "📁", group: "Family", route: "/family/documents", feature: "documents" },
  { label: "Affiliate — Share Rais Fintech", icon: "🤝", group: "Grow", route: "/grow/affiliate" },
  { label: "Achievements", icon: "🏆", group: "Grow", route: "/grow/achievements" },
  { label: "Performance", icon: "📈", group: "Analytics", route: "/analytics/performance" },
  { label: "Risk", icon: "🧮", group: "Analytics", route: "/analytics/risk" },
  { label: "Rules", icon: "⚙️", group: "Automation", route: "/automation/rules", feature: "automation" },
  { label: "Alerts", icon: "🔔", group: "Automation", route: "/automation/alerts", feature: "automation" },
  { label: "Setup Progress", icon: "✅", group: "System", route: "/system/setup" },
  { label: "Security Settings", icon: "🛡️", group: "System", route: "/system/security" },
  { label: "Settings", icon: "🛠️", group: "System", route: "/system/settings" },
];

/**
 * Cmd/Ctrl+K quick navigation for power users — fast paths without
 * sacrificing beginner-friendly UX. Respects feature discovery: locked
 * features don't appear until unlocked.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { state } = useGuidance();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        setQ("");
        setSel(0);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const results = useMemo(() => {
    const visible = COMMANDS.filter((c) => !c.feature || isFeatureVisible(c.feature, state));
    if (!q.trim()) return visible;
    const needle = q.toLowerCase();
    return visible.filter(
      (c) => c.label.toLowerCase().includes(needle) || c.group.toLowerCase().includes(needle)
    );
  }, [q, state]);

  const go = (c: Command) => {
    setOpen(false);
    navigate(c.route);
  };

  if (!open) return null;

  return (
    <div className="overlay" onClick={() => setOpen(false)}>
      <div className="palette" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Quick navigation">
        <input
          ref={inputRef}
          value={q}
          placeholder="Search Rais Fintech…"
          onChange={(e) => {
            setQ(e.target.value);
            setSel(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setSel((s) => Math.min(s + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setSel((s) => Math.max(s - 1, 0));
            } else if (e.key === "Enter" && results[sel]) {
              go(results[sel]);
            }
          }}
        />
        <div className="palette-list">
          {results.length === 0 && <div style={{ padding: "14px 12px" }} className="muted">No matches. Try “portfolio” or “family”.</div>}
          {results.map((c, i) => (
            <button
              key={c.route + c.label}
              className={`palette-item ${i === sel ? "selected" : ""}`}
              onMouseEnter={() => setSel(i)}
              onClick={() => go(c)}
            >
              <span className="pi-icon" aria-hidden>{c.icon}</span>
              <span>{c.label}</span>
              <span className="pi-group">{c.group}</span>
            </button>
          ))}
        </div>
        <div className="palette-foot">
          <span><kbd>↑</kbd> <kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> open</span>
          <span><kbd>esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
