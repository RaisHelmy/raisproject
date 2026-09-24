/**
 * Content for the Viral Presets, MCP & CLI and Canvas pages, taken from the
 * reference site. Media lives under public/pages.
 */
export interface PresetChip {
  label: string;
  isNew: boolean;
}
export interface McpTool {
  name: string;
  icon: string | null;
}

export const PRESET_CHIPS: PresetChip[] = [
  {
    label: "AGAMEMNON",
    isNew: true,
  },
  {
    label: "EARTH ZOOM",
    isNew: false,
  },
  {
    label: "INK RIOT",
    isNew: false,
  },
  {
    label: "FALLEN ANGEL",
    isNew: true,
  },
  {
    label: "BULLET TIME",
    isNew: true,
  },
  {
    label: "FAIRYTALE CASTLE",
    isNew: false,
  },
  {
    label: "COMIC",
    isNew: false,
  },
  {
    label: "COLD VISION",
    isNew: false,
  },
  {
    label: "CYCLOPE",
    isNew: true,
  },
  {
    label: "PARTICLES",
    isNew: false,
  },
  {
    label: "MIGHTY FIGHTER",
    isNew: false,
  },
  {
    label: "WINDOWS",
    isNew: false,
  },
  {
    label: "CANVAS",
    isNew: false,
  },
  {
    label: "PIGEONS",
    isNew: true,
  },
  {
    label: "TRACKING",
    isNew: false,
  },
  {
    label: "SUPERSTAR",
    isNew: false,
  },
  {
    label: "PEARL EARRING",
    isNew: true,
  },
  {
    label: "LSD",
    isNew: false,
  },
  {
    label: "BLUE DEPTH",
    isNew: false,
  },
  {
    label: "PALETTE",
    isNew: false,
  },
  {
    label: "MOONWALK",
    isNew: false,
  },
  {
    label: "KNIGHT'S DIARY",
    isNew: false,
  },
  {
    label: "ARGUS",
    isNew: true,
  },
  {
    label: "FRAGMENTS",
    isNew: false,
  },
  {
    label: "2000'S PAPARAZZI",
    isNew: false,
  },
  {
    label: "OVEREXPOSED",
    isNew: false,
  },
  {
    label: "DOLPHIN RIDE",
    isNew: true,
  },
  {
    label: "STICKER PEEL",
    isNew: false,
  },
  {
    label: "MULTIVERSE",
    isNew: false,
  },
  {
    label: "SKATEDOG",
    isNew: true,
  },
  {
    label: "NOIR",
    isNew: false,
  },
  {
    label: "CASUAL MONSTER SLAYER",
    isNew: false,
  },
  {
    label: "OCEAN",
    isNew: false,
  },
  {
    label: "SELFIE TWIN",
    isNew: false,
  },
  {
    label: "SKETCH",
    isNew: false,
  },
  {
    label: "MONET MUSE",
    isNew: true,
  },
  {
    label: "AKRILL",
    isNew: false,
  },
  {
    label: "MAGAZINE",
    isNew: false,
  },
  {
    label: "LOST IN A BOOK",
    isNew: true,
  },
  {
    label: "PENGUIN RIDE",
    isNew: true,
  },
  {
    label: "CANNABIS",
    isNew: false,
  },
  {
    label: "3D RENDER",
    isNew: false,
  },
  {
    label: "ACTION FIGURE",
    isNew: false,
  },
  {
    label: "BUBBLES",
    isNew: false,
  },
  {
    label: "ORBIT 360",
    isNew: false,
  },
  {
    label: "ORBITAL PRESENCE",
    isNew: false,
  },
  {
    label: "ACID",
    isNew: false,
  },
  {
    label: "RACE TRACK",
    isNew: false,
  },
  {
    label: "FLASH COMIC",
    isNew: false,
  },
  {
    label: "PAPER",
    isNew: false,
  },
  {
    label: "RANDOM GLOW",
    isNew: false,
  },
  {
    label: "TOXIC",
    isNew: false,
  },
  {
    label: "BROKEN MIRROR",
    isNew: false,
  },
  {
    label: "HAND PAINT",
    isNew: false,
  },
  {
    label: "LAVA",
    isNew: false,
  },
  {
    label: "MARBLE",
    isNew: false,
  },
  {
    label: "MODERN",
    isNew: false,
  },
  {
    label: "PUFFIN RIDE",
    isNew: true,
  },
  {
    label: "ORIGAMI",
    isNew: false,
  },
  {
    label: "TWO COLOR",
    isNew: false,
  },
  {
    label: "ULTRAVIOLET",
    isNew: false,
  },
  {
    label: "VINTAGE",
    isNew: false,
  },
];

export const PRESET_GALLERY: string[] = [
  "/pages/1ab4e018631a.webp",
  "/pages/4be2ea3e8450.webp",
  "/pages/2b65db9b4f06.webp",
  "/pages/b9c0af30d7f4.webp",
  "/pages/40a7c6390880.webp",
  "/pages/b700442d9472.webp",
  "/pages/fe727f887f54.webp",
  "/pages/52f894d3263f.webp",
  "/pages/7cdfc30cd3aa.webp",
  "/pages/cd0c92426dd2.webp",
  "/pages/509e9d072625.webp",
  "/pages/baae351b0df6.webp",
  "/pages/287923a55904.webp",
  "/pages/85638d9901e5.webp",
  "/pages/baef7048d8ca.webp",
  "/pages/a3d1b538098d.webp",
  "/pages/8854dbe660eb.webp",
  "/pages/4cd90065aa7b.webp",
  "/pages/d049676c0220.webp",
  "/pages/eaf5569fb392.webp",
  "/pages/27758eabca02.webp",
  "/pages/abefa78d5d75.webp",
  "/pages/3a5e58306f88.webp",
  "/pages/923ffb87ca46.webp",
  "/pages/e0af2f0049a6.webp",
  "/pages/bdb7e31762f0.webp",
  "/pages/87cd78853054.webp",
  "/pages/b53060f446bf.webp",
  "/pages/2210a4ed0968.webp",
  "/pages/4b105c1d6402.webp",
];
export const PRESET_VIDEOS: string[] = [
  "/pages/90cb5eb9459b.mp4",
  "/pages/b598b8006695.mp4",
  "/pages/ea6422c60019.mp4",
  "/pages/0c2333eb950c.mp4",
  "/pages/6d5667b10375.mp4",
  "/pages/0614fb3e86df.mp4",
];

export const MCP_TOOLS: McpTool[] = [
  {
    name: "ChatGPT",
    icon: "/pages/06208af8dedf.svg",
  },
  {
    name: "Claude",
    icon: "/pages/cc7f1b2c695e.webp",
  },
  {
    name: "Grok Bot",
    icon: null,
  },
  {
    name: "Cursor",
    icon: "/pages/546f5aeb9469.webp",
  },
  {
    name: "Claude Code",
    icon: "/pages/cc7f1b2c695e.webp",
  },
  {
    name: "OpenClaw",
    icon: "/pages/b2451c52d78e.webp",
  },
  {
    name: "Hermes",
    icon: "/pages/80af1606a9d7.webp",
  },
];
export const MCP_STACK: string[] = [
  "/pages/6c0033a3c959.webp",
  "/pages/cc7f1b2c695e.webp",
  "/pages/6566a9500894.webp",
  "/pages/ca1392d62dee.webp",
  "/pages/546f5aeb9469.webp",
  "/pages/b2451c52d78e.webp",
  "/pages/80af1606a9d7.webp",
];

export const CANVAS_IMAGES: string[] = [
  "/pages/c9e15202c048.webp",
  "/pages/e68bdb442004.webp",
  "/pages/aff0ddb4d201.webp",
  "/pages/eb67b1f62c99.webp",
  "/pages/c72a6545f4c6.webp",
  "/pages/4e6fa8381112.webp",
];
