/**
 * Static scene and menus for the Canvas editor replica. Positions are in a
 * fixed 1440x820 scene so wires and ports share one coordinate space.
 */
export type NodeKind = "image" | "prompt" | "image-gen" | "video-gen";
export type PortKind = "text" | "image" | "video" | "audio";

export interface CanvasNode {
  id: string;
  kind: NodeKind;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Rendered image, if any. */
  img?: string;
  /** Prompt text for prompt nodes. */
  text?: string;
  /** Result chips shown inside generator nodes. */
  chips?: string[];
  model?: string;
  cost?: string;
  inputs: PortKind[];
  outputs: PortKind[];
}

export interface CanvasGroup { id: string; x: number; y: number; w: number; h: number; dashed?: boolean }
export interface Edge { from: string; to: string; toPort?: number }

const A = {
  input: "/canvas/a8a5b4c233ee.png",
  image: "/canvas/a3637742c0fa.png",
  video: "/canvas/6e7513963b30.png",
  product: "/canvas/fcd657143b44.png",
  sketch: "/canvas/4f194b4a3ef2.png",
  logo: "/canvas/94dcf2d7ad08.png",
};

export const GROUPS: CanvasGroup[] = [
  { id: "g1", x: 96, y: 150, w: 470, h: 210 },
  { id: "g2", x: 420, y: 420, w: 720, h: 200 },
  { id: "g3", x: 440, y: 640, w: 700, h: 170 },
];

export const NODES: CanvasNode[] = [
  { id: "img-a", kind: "image", x: 116, y: 178, w: 176, h: 150, img: A.product, inputs: [], outputs: ["image"] },
  { id: "img-b", kind: "image", x: 322, y: 178, w: 120, h: 168, img: A.input, inputs: [], outputs: ["image"] },
  { id: "prompt", kind: "prompt", x: 470, y: 214, w: 80, h: 96, inputs: [], outputs: ["text"],
    text: "Vertical 9:16 cinematic photo. Malaysian male, 29, neat beard, professional smart-casual shirt — sitting on his sofa in a modern apartment, staring shocked at an electricity bill in his hand." },
  { id: "gen-1", kind: "image-gen", x: 440, y: 448, w: 130, h: 150, img: A.image, inputs: ["text", "image"], outputs: ["image"] },
  { id: "gen-2", kind: "image-gen", x: 600, y: 448, w: 130, h: 150, img: A.video, inputs: ["text", "image"], outputs: ["image"] },
  { id: "gen-3", kind: "image-gen", x: 760, y: 448, w: 130, h: 150, img: A.sketch, inputs: ["text", "image"], outputs: ["image"] },
  { id: "gen-4", kind: "image-gen", x: 990, y: 448, w: 130, h: 150, inputs: ["text", "image"], outputs: ["image"] },
  { id: "gen-5", kind: "image-gen", x: 460, y: 664, w: 130, h: 130, inputs: ["text", "image"], outputs: ["image"] },
  { id: "gen-6", kind: "image-gen", x: 620, y: 664, w: 130, h: 130, inputs: ["text", "image"], outputs: ["image"], chips: ["2k", "1:1"], model: "GPT Image 2", cost: "6.5" },
  { id: "gen-7", kind: "image-gen", x: 780, y: 664, w: 130, h: 130, inputs: ["text", "image"], outputs: ["image"] },
  { id: "vid-1", kind: "video-gen", x: 1000, y: 664, w: 130, h: 130, inputs: ["text", "image", "video", "audio"], outputs: ["video"], chips: ["720p", "1:1", "15s"], model: "Seedance 2.0", cost: "68" },
];

/** Every input on the generator rows is fed from the three sources up top. */
export const EDGES: Edge[] = [
  ...["gen-1", "gen-2", "gen-3", "gen-4", "gen-5", "gen-6", "gen-7", "vid-1"].flatMap((to) => [
    { from: "prompt", to, toPort: 0 },
    { from: "img-a", to, toPort: 1 },
    { from: "img-b", to, toPort: 1 },
  ]),
];

export const ADD_NODE_ITEMS = {
  main: [
    { label: "Prompt", tone: "grey" },
    { label: "Image Generator", tone: "blue" },
    { label: "Video Generator", tone: "indigo" },
    { label: "Voice Generator", tone: "pink" },
    { label: "LLM Assistant", tone: "lime" },
    { label: "Page", tone: "green", badge: "New" },
  ],
  sections: [
    { heading: "References", items: [{ label: "Upload", tone: "green" }, { label: "Assets", tone: "green" }] },
    { heading: "Image", items: [{ label: "Image Generator", tone: "blue" }] },
    { heading: "Video", items: [{ label: "Video Generator", tone: "indigo" }] },
  ],
} as const;

export interface PickerModel { name: string; res: string; dur: string; top?: boolean; audio?: boolean; icon: "bars" | "wave" | "kling" | "flux" | "grok" }
export const VIDEO_PICKER: PickerModel[] = [
  { name: "Seedance 2.5", res: "1080p", dur: "4s-30s", top: true, icon: "bars" },
  { name: "Seedance 2.0", res: "4K", dur: "4s-15s", icon: "bars" },
  { name: "Seedance 2.0 Fast", res: "720p", dur: "4s-15s", icon: "bars" },
  { name: "Seedance 2.0 Mini", res: "720p", dur: "4s-15s", icon: "bars" },
  { name: "MiniMax H3", res: "2K", dur: "5s-15s", icon: "wave" },
  { name: "MiniMax H3 Max", res: "768p", dur: "5s-15s", icon: "wave" },
  { name: "Kling 3.0", res: "4K", dur: "3s-15s", audio: true, icon: "kling" },
  { name: "Kling 3.0 Motion Control", res: "1080p", dur: "3s-30s", icon: "kling" },
  { name: "FLUX.3 Video", res: "1080p", dur: "5s-20s", audio: true, icon: "flux" },
  { name: "Grok Imagine 1.5", res: "720p", dur: "1s-15s", icon: "grok" },
];
export const IMAGE_PICKER: PickerModel[] = [
  { name: "GPT Image 2", res: "2K", dur: "—", top: true, icon: "grok" },
  { name: "RaisAI Soul 2.0", res: "2K", dur: "—", icon: "bars" },
  { name: "Nano Banana Pro", res: "4K", dur: "—", icon: "wave" },
  { name: "Seedream 5.0 Pro", res: "2K", dur: "—", icon: "bars" },
  { name: "FLUX.2", res: "2K", dur: "—", icon: "flux" },
];

export const VERSIONS = [
  { when: "Sep 9, 2026, 7:19 AM", note: "Auto-saved" },
  { when: "Jul 19, 2026, 1:03 AM", note: "Auto-saved" },
  { when: "Jul 19, 2026, 12:29 AM", note: "Auto-saved" },
];

export const AGENT_SUGGESTIONS = ["Create a 2-week content plan", "Adapt copy for each platform", "Write the launch video script"];

export const ASSET_THUMBS = [A.input, A.video, A.image, A.product, A.product, A.sketch, A.logo];
