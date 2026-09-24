import { Link, useSearchParams } from "react-router-dom";
import { AssetsPage } from "../assets/AssetsPage";
import { HistoryPage } from "../history/HistoryPage";

const TABS = [
  { key: "assets", label: "Assets", icon: "images" },
  { key: "history", label: "History", icon: "clock-history" },
] as const;

/**
 * One place for everything made or uploaded, the way the creative suites
 * present it: the asset grid and the generation history side by side under
 * a single "Library" entry. The two underlying pages are unchanged; this is
 * navigation, not a new data model.
 */
export function LibraryPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "history" ? "history" : "assets";

  return (
    <section className="workspace-page">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div><p className="lp-eyebrow mb-2">Your creative memory</p><h1 className="display-6 fw-bold mb-0">Library</h1></div>
        <nav className="nav nav-pills nav-sm" aria-label="Library sections">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`nav-link btn ${tab === t.key ? "active" : ""}`}
              aria-current={tab === t.key ? "page" : undefined}
              onClick={() => setParams({ tab: t.key }, { replace: true })}
            >
              <i className={`bi bi-${t.icon} me-1`} aria-hidden="true" />{t.label}
            </button>
          ))}
          <Link to="/projects" className="nav-link"><i className="bi bi-folder2 me-1" aria-hidden="true" />Projects</Link>
        </nav>
      </div>
      <div className="rais-embed">
        {tab === "assets" ? <AssetsPage /> : <HistoryPage />}
      </div>
    </section>
  );
}
