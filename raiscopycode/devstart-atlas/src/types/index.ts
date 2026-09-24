// Core content data model for DevStart Atlas.
// All content (technologies, templates, patterns, recipes, cheat sheets)
// is structured data conforming to these types — the UI renders it generically,
// so adding a new technology or template never requires touching components.

export type TechnologyCategory =
  | "language"
  | "runtime"
  | "framework"
  | "library"
  | "database"
  | "cloud"
  | "devops"
  | "mobile"
  | "desktop"
  | "ai-ml"
  | "build-tool"
  | "testing";

export type Technology = {
  id: string;
  name: string;
  category: TechnologyCategory;
  /** Language this tech belongs to, when applicable (framework/runtime). */
  language?: string;
  description: string;
  tags: string[];
  aliases?: string[];
  /** 0–100, used only for "Popular" sorting. */
  popularity?: number;
  /** Pinned in the sidebar Top-10 languages list. */
  pinned?: boolean;
  relatedTechnologies?: string[];
  icon?: string; // bootstrap-icons class name
  website?: string;
};

export type Shell = "bash" | "powershell" | "cmd" | "zsh";
export type Platform = "windows" | "macos" | "linux" | "all";

/** How authoritative a command/snippet is. */
export type Provenance = "official" | "recommended" | "example" | "convention";

export type Command = {
  shell?: Shell;
  platform?: Platform;
  code: string;
  description?: string;
  warning?: string;
  provenance?: Provenance;
};

export type TemplateFile = {
  path: string;
  language?: string;
  content: string;
  description?: string;
};

export type TemplateStep = {
  id: string;
  title: string;
  description: string;
  commands?: Command[];
  files?: TemplateFile[];
  notes?: string[];
  warnings?: string[];
};

export type Difficulty = "beginner" | "intermediate" | "advanced";

export type CompletenessItem = { label: string; done: boolean };

export type Template = {
  id: string;
  title: string;
  description: string;
  technologies: string[]; // technology ids
  projectTypes: string[];
  architectures: string[]; // architecture ids
  databases?: string[];
  difficulty: Difficulty;
  productionReady: boolean;
  prerequisites: string[];
  estimatedSetupMinutes?: number;
  versions?: { name: string; version: string }[];
  lastReviewed?: string;
  /** Ordered "Zero → Running" happy path (subset of step titles). */
  zeroToRunning: string[];
  steps: TemplateStep[];
  files: TemplateFile[];
  completeness: CompletenessItem[];
  nextSteps?: { label: string; recipeId?: string }[];
  patterns?: string[];
  recipes?: string[];
  relatedTemplates?: string[];
  tags: string[];
};

export type Architecture = {
  id: string;
  name: string;
  summary: string;
  whatIsIt: string;
  whyUse: string[];
  whenToUse: string[];
  whenNotToUse: string[];
  folderStructure: string;
  /** mkdir-friendly folder list, relative paths. */
  folders: string[];
  dependencyDirection: string;
  example?: string;
  advantages: string[];
  disadvantages: string[];
  commonMistakes: string[];
  relatedPatterns: string[];
  comparison: {
    complexity: 1 | 2 | 3 | 4 | 5;
    boilerplate: 1 | 2 | 3 | 4 | 5;
    scalability: 1 | 2 | 3 | 4 | 5;
    bestFor: string;
  };
};

export type Pattern = {
  id: string;
  name: string;
  category: "pattern" | "anti-pattern";
  summary: string;
  problem: string;
  solution: string;
  whenToUse?: string[];
  whenNotToUse?: string[];
  example?: { language: string; code: string; title?: string };
  badExample?: { language: string; code: string; title?: string };
  betterExample?: { language: string; code: string; title?: string };
  tradeoffs?: string[];
  whySimpleIsOk?: string;
  relatedPatterns?: string[];
  tags: string[];
};

export type RecipeCategory =
  | "api"
  | "authentication"
  | "database"
  | "docker"
  | "ci-cd"
  | "testing"
  | "security"
  | "observability"
  | "frontend"
  | "mobile";

export type Recipe = {
  id: string;
  title: string;
  category: RecipeCategory;
  description: string;
  technologies?: string[];
  steps: TemplateStep[];
  tags: string[];
};

export type CheatEntry = {
  code: string;
  description: string;
  warning?: string;
  shell?: Shell;
};

export type CheatGroup = {
  title: string;
  entries: CheatEntry[];
};

export type CheatSheet = {
  id: string;
  title: string;
  icon?: string;
  description: string;
  groups: CheatGroup[];
  tags: string[];
};

// ----- Wizard / blueprint -----

export type Blueprint = {
  projectName: string;
  projectType: string;
  language: string;
  framework: string;
  architecture: string;
  database: string;
  auth: string;
  deployment: string;
  testing: string;
};

// ----- Personal (LocalStorage) -----

export type FavoriteKind = "template" | "pattern" | "recipe" | "cheatsheet" | "technology" | "architecture";

export type FavoriteItem = { kind: FavoriteKind; id: string; title: string; addedAt: number };

export type RecentItem = { kind: string; id: string; title: string; path: string; at: number };

export type CopiedItem = { label: string; code: string; at: number };

export type MyTemplate = {
  id: string;
  name: string;
  blueprint: Blueprint;
  createdAt: number;
};

// ----- Search -----

export type SearchResultKind =
  | "template"
  | "technology"
  | "pattern"
  | "anti-pattern"
  | "architecture"
  | "recipe"
  | "command"
  | "cheatsheet"
  | "database";

export type SearchDoc = {
  kind: SearchResultKind;
  id: string;
  title: string;
  subtitle?: string;
  path: string;
  haystack: string; // lowercased concatenation of searchable text incl. aliases
  badges?: string[];
  popularity?: number;
};
