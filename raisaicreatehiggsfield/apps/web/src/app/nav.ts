export interface NavItem {
  to: string;
  label: string;
  icon: string;
  /** Shown only once advanced mode is on. */
  advanced?: boolean;
  /** Shown only to admins; the server checks again on every route (§109). */
  admin?: boolean;
  /** Nested entries rendered under the parent when it, or one of them, is active. */
  children?: NavItem[];
}

/**
 * The sidebar mirrors the layout our target users already know from the
 * big creative suites: a short list of media types up top (Image, Video,
 * Audio), the app-style tools below them (Apps, Canvas), then the social
 * and library surfaces (Community, Library), then money and self
 * (Pricing, Profile). Familiar shape, our own destinations.
 *
 * Every link here goes to a real screen: each studio sub-item is its own
 * one-form page (`/create/studio/<preset>`), Library is the assets grid and
 * history under one roof, Community is the public template gallery.
 */
export const NAV: NavItem[] = [
  { to: "/", label: "Home", icon: "house-door" },
  {
    to: "/create/image", label: "Image", icon: "image",
    children: [
      { to: "/create/image", label: "Generate", icon: "image" },
      { to: "/create/studio/ai.image.edit", label: "Edit", icon: "pencil-square" },
      { to: "/create/studio/ai.inpaint", label: "Inpaint", icon: "brush" },
      { to: "/create/studio/ai.upscale", label: "Upscale", icon: "arrows-angle-expand" },
      { to: "/create/compare", label: "Compare models", icon: "columns-gap" },
    ],
  },
  {
    to: "/create/video", label: "Video", icon: "film",
    children: [
      { to: "/create/video", label: "Generate", icon: "film" },
      { to: "/create/studio/ai.video.from-image", label: "Animate image", icon: "play-btn" },
      { to: "/create/studio/ai.motion", label: "Motion transfer", icon: "person-video3" },
      { to: "/create/studio/ai.video.upscale", label: "Upscale video", icon: "badge-hd" },
    ],
  },
  {
    to: "/create/audio", label: "Audio", icon: "mic",
    children: [
      { to: "/create/audio", label: "Speech", icon: "chat-quote" },
      { to: "/create/studio/ai.transcribe", label: "Transcribe", icon: "badge-cc" },
      { to: "/create/studio/ai.music", label: "Music", icon: "music-note-beamed" },
    ],
  },
  {
    to: "/create/text", label: "Text", icon: "fonts",
    children: [
      { to: "/create/text", label: "Generate", icon: "fonts" },
      { to: "/create/studio/ai.text", label: "Write (auto model)", icon: "pencil" },
      { to: "/create/studio/ai.describe", label: "Describe image", icon: "eye" },
    ],
  },
  {
    to: "/templates", label: "Apps", icon: "grid-1x2",
    children: [
      { to: "/templates", label: "Templates", icon: "grid-1x2" },
      { to: "/movies", label: "Movie mode", icon: "camera-reels" },
    ],
  },
  { to: "/canvas", label: "Canvas", icon: "diagram-3" },
  { to: "/templates?scope=public", label: "Community", icon: "people" },
  {
    to: "/library", label: "Library", icon: "collection",
    children: [
      { to: "/library?tab=assets", label: "Assets", icon: "images" },
      { to: "/library?tab=history", label: "History", icon: "clock-history" },
      { to: "/projects", label: "Projects", icon: "folder2" },
    ],
  },
  {
    to: "/balance", label: "Pricing", icon: "wallet2",
    children: [
      { to: "/balance", label: "Balance", icon: "wallet2" },
      { to: "/usage", label: "Usage", icon: "bar-chart" },
    ],
  },
  {
    to: "/account", label: "Profile", icon: "person-circle",
    children: [
      { to: "/account", label: "Account", icon: "person-circle" },
      { to: "/developer/docs", label: "Docs", icon: "book", advanced: true },
      { to: "/developer/api-keys", label: "API keys", icon: "key", advanced: true },
      { to: "/developer/mcp", label: "MCP", icon: "plugin", advanced: true },
      { to: "/developer/webhooks", label: "Webhooks", icon: "broadcast", advanced: true },
      { to: "/developer/connectors", label: "Connectors", icon: "plug", advanced: true },
      { to: "/admin/models", label: "Models (admin)", icon: "cpu", admin: true },
    ],
  },
];

/** The four that fit a phone's bottom bar. */
export const MOBILE_NAV: NavItem[] = [
  NAV[0]!,
  { to: "/create/image", label: "Image", icon: "image" },
  { to: "/create/video", label: "Video", icon: "film" },
  { to: "/library", label: "Library", icon: "collection" },
];

/** Path-only comparison so `/templates?scope=public` and `/templates` are distinct links but share a section. */
export function pathOf(to: string): string {
  return to.split("?")[0] ?? to;
}

export function visibleItems(items: NavItem[], opts: { advanced: boolean; admin: boolean }): NavItem[] {
  return items
    .filter((n) => (n.admin ? opts.admin : opts.advanced || !n.advanced))
    .map((n) => (n.children ? { ...n, children: visibleItems(n.children, opts) } : n));
}
