/**
 * Content for the public landing page.
 *
 * Every entry describes something the product really does: the studio rows
 * are the canvas node presets in `engine/nodes/ai-presets.ts`, the routes are
 * the ones in `App.tsx`, the numbers are the live catalog. Tiles carry an
 * example *prompt*, not a fake result: with no `src` they render as a
 * typographic poster, and when a real generation is worth showing off, add
 * its asset URL as `src` and the same tile shows the media instead.
 */

export interface Tile {
  /** Short caption shown on the tile. */
  title: string;
  /** The example prompt a visitor could paste into the studio. */
  prompt: string;
  /** Optional real media. Without it the tile is a typographic poster. */
  src?: string;
  /** Media type of `src`; images by default. */
  mime?: string;
  /** Aspect of the tile in the grid. */
  shape?: "square" | "portrait" | "wide" | "tall";
  /** Palette seed, 0–360. Picked by hand so neighbours contrast. */
  hue: number;
}

export interface StudioRow {
  id: string;
  eyebrow: string;
  title: string;
  text: string;
  /** Where "Open studio" goes for a signed-in user (signup for visitors). */
  to: string;
  tiles: Tile[];
}

export const HERO_TILES: { title: string; sub: string; icon: string; hue: number; to: string }[] = [
  { title: "Image studio", sub: "Prompt to picture, references for consistent characters.", icon: "image", hue: 262, to: "/create/image" },
  { title: "Video studio", sub: "Text to video, animate a still, motion transfer.", icon: "film", hue: 190, to: "/create/video" },
  { title: "Voice & music", sub: "Natural speech, transcripts, music from a description.", icon: "mic", hue: 330, to: "/create/audio" },
  { title: "Movie mode", sub: "Story → characters → storyboard → shots → timeline.", icon: "camera-reels", hue: 40, to: "/movies" },
];

/** The studio presets, in the order they appear in the node library. */
export const QUICK_TOOLS: { label: string; icon: string }[] = [
  { label: "Image", icon: "image" },
  { label: "Edit image", icon: "pencil-square" },
  { label: "Inpaint", icon: "brush" },
  { label: "Upscale image", icon: "arrows-angle-expand" },
  { label: "Video", icon: "film" },
  { label: "Animate image", icon: "play-btn" },
  { label: "Upscale video", icon: "badge-hd" },
  { label: "Motion transfer", icon: "person-video3" },
  { label: "Speech", icon: "chat-quote" },
  { label: "Transcribe", icon: "badge-cc" },
  { label: "Describe image", icon: "eye" },
  { label: "Music", icon: "music-note-beamed" },
  { label: "Write", icon: "pencil" },
];

export const STUDIO_ROWS: StudioRow[] = [
  {
    id: "image",
    eyebrow: "Image studio",
    title: "Every picture starts with a sentence.",
    text: "Text to image, image to image, inpainting and upscaling — with reference images so the same face survives every shot.",
    to: "/create/image",
    tiles: [
      { title: "Editorial", prompt: "Sculptural silver fashion, dramatic architectural shadows", src: "/showcase/editorial-portrait.webp", mime: "image/webp", hue: 48, shape: "portrait" },
      { title: "Product shot", prompt: "Translucent lime fragrance on wet black stone", src: "/showcase/lime-product.webp", mime: "image/webp", hue: 200, shape: "square" },
      { title: "Campaign", prompt: "Chrome performance shoe suspended in liquid motion", src: "/showcase/chrome-shoe.webp", mime: "image/webp", hue: 280, shape: "portrait" },
      { title: "Cinematic world", prompt: "Future Kuala Lumpur after rain, film still", src: "/showcase/kl-night.webp", mime: "image/webp", hue: 260, shape: "wide" },
      { title: "Upscale", prompt: "2K → 4K, keep material detail and controlled reflections", src: "/showcase/lime-product.webp", mime: "image/webp", hue: 160, shape: "square" },
      { title: "Editorial", prompt: "Campaign portrait, sculptural styling and hard flash", src: "/showcase/editorial-portrait.webp", mime: "image/webp", hue: 5, shape: "portrait" },
    ],
  },
  {
    id: "video",
    eyebrow: "Video studio",
    title: "From still to shot in one node.",
    text: "Text to video, image to video with start and end frames, video upscaling and motion transfer from a reference clip.",
    to: "/create/video",
    tiles: [
      { title: "Animate", prompt: "Slow push through a rain-lit future Kuala Lumpur", src: "/showcase/kl-night.webp", mime: "image/webp", hue: 195, shape: "wide" },
      { title: "Motion transfer", prompt: "Drive an editorial character with reference movement", src: "/showcase/editorial-portrait.webp", mime: "image/webp", hue: 320, shape: "portrait" },
      { title: "Establishing", prompt: "Wide Kuala Lumpur night sequence, camera drifting left, 5 s", src: "/showcase/kl-night.webp", mime: "image/webp", hue: 220, shape: "wide" },
      { title: "Loop", prompt: "Seamless product light loop, 3 s, 1:1", src: "/showcase/lime-product.webp", mime: "image/webp", hue: 30, shape: "square" },
      { title: "Upscale", prompt: "1080p → 4K, preserve liquid detail", src: "/showcase/chrome-shoe.webp", mime: "image/webp", hue: 140, shape: "square" },
      { title: "Start → end", prompt: "Editorial still into cinematic movement", src: "/showcase/editorial-portrait.webp", mime: "image/webp", hue: 275, shape: "portrait" },
    ],
  },
  {
    id: "audio",
    eyebrow: "Voice & music",
    title: "Say it. Score it. Subtitle it.",
    text: "Text to speech for dialogue, speech to text with timings for SRT and VTT, and music composed from a description.",
    to: "/create/audio",
    tiles: [
      { title: "Dialogue", prompt: "\"We were never supposed to find this.\" — low, tired, close-mic", hue: 340, shape: "wide" },
      { title: "Score", prompt: "Slow synth pulse, distant piano, 60 s, tension that never resolves", hue: 250, shape: "square" },
      { title: "Subtitles", prompt: "Transcribe scene 4, export SRT", hue: 175, shape: "square" },
      { title: "Ambience", prompt: "Night market: sizzling woks, motorbikes, a far-off call to prayer", hue: 25, shape: "wide" },
    ],
  },
  {
    id: "movie",
    eyebrow: "Movie mode",
    title: "A whole film, one scene at a time.",
    text: "Type the idea. Get a story, characters, locations, scenes and shots you can edit — then generate the storyboard, the clips, the voices and the timeline without leaving the project.",
    to: "/movies",
    tiles: [
      { title: "Idea", prompt: "A cinematic future-Kuala-Lumpur campaign film", src: "/showcase/kl-night.webp", mime: "image/webp", hue: 285, shape: "wide" },
      { title: "Scene 4 · Shot 2", prompt: "Editorial lead under architectural light, 4 s", src: "/showcase/editorial-portrait.webp", mime: "image/webp", hue: 40, shape: "portrait" },
      { title: "Scene 7 · Shot 1", prompt: "Future Kuala Lumpur, rain and reflections, 3 s", src: "/showcase/kl-night.webp", mime: "image/webp", hue: 205, shape: "square" },
      { title: "Timeline", prompt: "Product film · Voice · Music · SFX · Subtitles", src: "/showcase/chrome-shoe.webp", mime: "image/webp", hue: 150, shape: "wide" },
    ],
  },
];

/** Real capabilities from the catalog, as the "explore" tag cloud. */
export const CAPABILITY_TAGS = [
  "Text to image", "Image to image", "Inpainting", "Image upscale", "Reference images", "Seed & steps",
  "Text to video", "Image to video", "Start & end frames", "Video to video", "Video upscale", "Motion transfer", "Reference audio",
  "Text to speech", "Speech to text", "Music", "Vision Q&A", "Chat & reasoning", "Tool calling", "Embeddings", "Translation",
  "Reframe & crop", "Format conversion", "Node canvas", "Loops & branches", "HTTP node", "MCP node", "Agent node", "Budget caps",
  "Templates", "Versioned runs", "Webhooks", "REST API", "Node SDK", "MCP server",
];

export const CATALOG = {
  total: 226,
  groups: [
    { label: "Text & vision", count: 98, icon: "chat-square-text" },
    { label: "Image", count: 55, icon: "image" },
    { label: "Video", count: 35, icon: "film" },
    { label: "Audio", count: 38, icon: "soundwave" },
  ],
};

export const FOOTER_COLUMNS: { heading: string; links: { label: string; to: string }[] }[] = [
  {
    heading: "Studios",
    links: [
      { label: "Image", to: "/create/image" },
      { label: "Video", to: "/create/video" },
      { label: "Voice & music", to: "/create/audio" },
      { label: "Text", to: "/create/text" },
      { label: "Movie mode", to: "/movies" },
      { label: "Compare models", to: "/create/compare" },
    ],
  },
  {
    heading: "Build",
    links: [
      { label: "Canvas", to: "/canvas" },
      { label: "Templates", to: "/templates" },
      { label: "Projects", to: "/projects" },
      { label: "Assets", to: "/assets" },
      { label: "History", to: "/history" },
    ],
  },
  {
    heading: "Developers",
    links: [
      { label: "API keys", to: "/developer/api-keys" },
      { label: "MCP tokens", to: "/developer/mcp" },
      { label: "Webhooks", to: "/developer/webhooks" },
      { label: "Connectors", to: "/developer/connectors" },
      { label: "Docs", to: "/developer/docs" },
    ],
  },
  {
    heading: "Account",
    links: [
      { label: "Pricing", to: "/pricing" },
      { label: "Balance", to: "/balance" },
      { label: "Usage", to: "/usage" },
      { label: "Log in", to: "/login" },
      { label: "Sign up", to: "/signup" },
    ],
  },
];
