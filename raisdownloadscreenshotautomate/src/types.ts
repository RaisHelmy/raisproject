export type LinkSource =
  | "main-nav"
  | "sub-nav"
  | "sidebar"
  | "hero-cta"
  | "footer"
  | "body";

export interface DiscoveredLink {
  url: string;          // absolute, normalized (no hash, sorted query)
  text: string;         // visible label
  source: LinkSource;
  parent?: string;      // label of the top-level menu it was found under
  depth: number;        // path depth
  order: number;        // discovery order (lower = earlier in DOM)
}

export interface ScanResult {
  site: string;
  startUrl: string;
  scannedAt: string;
  durationMs: number;
  links: DiscoveredLink[];
  notes: string[];
}

export interface PlannedPage {
  id: string;           // slug used as folder name
  url: string;
  text: string;
  source: LinkSource;
  parent?: string;
  template: string;     // URL pattern used for similarity grouping
  score: number;        // higher = capture first
  priority: "high" | "medium" | "low" | "skip";
  similarTo?: string;   // id of the page that already represents this template
  reasons: string[];
}

export interface Plan {
  site: string;
  startUrl: string;
  plannedAt: string;
  pages: PlannedPage[];
  stats: { total: number; high: number; medium: number; low: number; skip: number };
}

export interface CaptureMeta {
  id: string;
  url: string;
  finalUrl: string;
  title: string;
  status: number | null;
  ok: boolean;
  error?: string;
  timings: { navMs: number; settleMs: number; totalMs: number };
  files: { html: string; screenshot: string; fullPage: string; assets: string };
  assetCount: number;
  assetBytes: number;
  links: number;
  capturedAt: string;
}

export interface Manifest {
  site: string;
  startUrl: string;
  outDir: string;
  startedAt: string;
  finishedAt: string;
  pages: CaptureMeta[];
  stats: { ok: number; failed: number; assets: number; bytes: number; durationMs: number };
}

export interface Options {
  out: string;
  headed: boolean;
  storageState?: string;
  chromeProfile?: string;  // Chrome profile name to clone (e.g. "Default") -> real Chrome with your logins
  profileDir: string;      // where the profile copy lives
  liveProfile: boolean;    // use the real Chrome profile in place (Chrome must be quit) instead of a copy
  freshProfile: boolean;   // re-copy the profile instead of reusing the existing copy
  cdp?: string;          // attach to a running Chrome (e.g. http://localhost:9222) and reuse its logged-in session
  concurrency: number;
  maxPages: number;
  minPriority: "high" | "medium" | "low";
  settleMs: number;      // max wait for network idle after load
  timeoutMs: number;     // navigation timeout
  assets: boolean;
  assetTypes: Set<string>;   // playwright resourceTypes to save
  assetBudgetMb: number;     // max new bytes per page
  assetWaitMs: number;       // max wait for asset bodies after the screenshot
  fullPage: boolean;
  lazy: boolean;             // scroll the page to trigger lazy-loaded images before shooting
  shotTimeoutMs: number;     // per-screenshot timeout
  lazyMs: number;            // budget for that pass

  viewport: { width: number; height: number };
  perTemplate: number;   // how many pages of the same template to keep at full priority
  include?: RegExp;
  exclude?: RegExp;
  scanDepth: number;     // 0 = only start page menus; 1 = also scan menus of main-nav pages
  hover: boolean;        // hover nav items to reveal submenus
}
