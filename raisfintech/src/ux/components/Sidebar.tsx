import { NavLink } from "react-router-dom";
import { useGuidance } from "../GuidanceContext";
import { isFeatureVisible } from "../guidance";

interface NavItem {
  label: string;
  icon: string;
  route: string;
  /** feature-discovery key; hidden until unlocked */
  feature?: string;
  /** show a "New" badge once the item first becomes visible */
  newWhenUnlocked?: boolean;
}

interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

const GROUPS: NavGroup[] = [
  {
    id: "OVERVIEW",
    label: "Overview",
    items: [{ label: "Dashboard", icon: "🏠", route: "/" }],
  },
  {
    id: "MONEY",
    label: "Money",
    items: [
      { label: "Wealth", icon: "💠", route: "/money/wealth" },
      { label: "Cash Flow", icon: "💸", route: "/money/cashflow" },
      { label: "Goals", icon: "🎯", route: "/money/goals" },
    ],
  },
  {
    id: "INVEST",
    label: "Invest",
    items: [
      { label: "Portfolio", icon: "📊", route: "/invest/portfolio" },
      { label: "Holdings", icon: "📑", route: "/invest/holdings" },
      { label: "Activity", icon: "🧾", route: "/invest/activity" },
      { label: "Markets", icon: "🌐", route: "/invest/markets" },
      { label: "Robo Trading", icon: "🤖", route: "/invest/robo", feature: "robo", newWhenUnlocked: true },
      { label: "Strategies", icon: "🧭", route: "/invest/strategies", feature: "strategies" },
      { label: "Theory Gallery", icon: "📚", route: "/invest/theories" },
      { label: "Queue", icon: "🧵", route: "/invest/queue", feature: "robo" },
    ],
  },
  {
    id: "ISLAMIC",
    label: "Islamic Wealth",
    items: [
      { label: "Zakat", icon: "🕌", route: "/islamic/zakat" },
      { label: "Shariah", icon: "☪️", route: "/islamic/shariah" },
      { label: "Estate Planning", icon: "📜", route: "/islamic/estate" },
    ],
  },
  {
    id: "FAMILY",
    label: "Family",
    items: [
      { label: "Family", icon: "👪", route: "/family" },
      { label: "Legacy", icon: "🕊️", route: "/family/legacy", feature: "legacy", newWhenUnlocked: true },
      { label: "Documents", icon: "📁", route: "/family/documents", feature: "documents" },
    ],
  },
  {
    id: "GROW",
    label: "Grow",
    items: [
      { label: "Affiliate", icon: "🤝", route: "/grow/affiliate" },
      { label: "Achievements", icon: "🏆", route: "/grow/achievements" },
    ],
  },
  {
    id: "ANALYTICS",
    label: "Analytics",
    items: [
      { label: "Performance", icon: "📈", route: "/analytics/performance" },
      { label: "Risk", icon: "🧮", route: "/analytics/risk" },
    ],
  },
  {
    id: "AUTOMATION",
    label: "Automation",
    items: [
      { label: "Rules", icon: "⚙️", route: "/automation/rules", feature: "automation" },
      { label: "Alerts", icon: "🔔", route: "/automation/alerts", feature: "automation" },
    ],
  },
  {
    id: "CONNECTIONS",
    label: "Connections",
    items: [{ label: "Connected Accounts", icon: "🔗", route: "/connections" }],
  },
  {
    id: "SYSTEM",
    label: "System",
    items: [
      { label: "Setup", icon: "✅", route: "/system/setup" },
      { label: "Security", icon: "🛡️", route: "/system/security" },
      { label: "Settings", icon: "🛠️", route: "/system/settings" },
    ],
  },
];

/**
 * Grouped, collapsible sidebar. Remembers expanded sections, highlights the
 * current page (border + weight + background, not color alone), and reveals
 * advanced features progressively as the user unlocks them.
 */
export function Sidebar({ isAdmin = false }: { isAdmin?: boolean }) {
  const { state, toggleGroup } = useGuidance();

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="word">
          Rais <em>Fintech</em>
        </span>
      </div>
      <nav className="sidebar-nav" aria-label="Main navigation">
        {GROUPS.map((group) => {
          let items = group.items.filter(
            (it) => !it.feature || isFeatureVisible(it.feature, state)
          );
          if (group.id === "SYSTEM" && isAdmin) {
            items = [...items, { label: "Admin", icon: "🗝️", route: "/system/admin" }];
          }
          if (items.length === 0) return null;
          const open = state.expandedGroups.includes(group.id);
          return (
            <div className="nav-group" key={group.id}>
              <button
                className="nav-group-label"
                onClick={() => toggleGroup(group.id)}
                aria-expanded={open}
              >
                <span>{group.label}</span>
                <span className={`chev ${open ? "open" : ""}`}>▶</span>
              </button>
              {open &&
                items.map((it) => (
                  <NavLink
                    key={it.route}
                    to={it.route}
                    end={it.route === "/"}
                    className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
                  >
                    <span className="nav-icon" aria-hidden>
                      {it.icon}
                    </span>
                    <span>{it.label}</span>
                    {it.newWhenUnlocked && <span className="nav-badge">NEW</span>}
                  </NavLink>
                ))}
            </div>
          );
        })}
      </nav>
      <div className="sidebar-foot">
        <div className="kbd-hint">
          <kbd>⌘K</kbd> <span>Quick navigation</span>
        </div>
      </div>
    </aside>
  );
}
