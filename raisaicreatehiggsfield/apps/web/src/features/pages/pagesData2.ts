/**
 * Content for the 3D Jutsu, Academy and Originals pages, taken from the
 * reference site. Media lives under public/pages.
 */
export interface Course {
  title: string;
  desc: string;
  chips: string[];
  img: string;
}
export interface OriginalRow {
  title: string;
  posters: string[];
}
export interface Scene {
  video: string;
  poster: string | null;
}

export const JUTSU_SCENES: Scene[] = [
  {
    video: "/pages/dcc8e6d7bc71.mp4",
    poster: "/pages/267c35f94536.webp",
  },
  {
    video: "/pages/ecec33b14476.mp4",
    poster: "/pages/11832902b57a.webp",
  },
  {
    video: "/pages/cb598358e4a5.mp4",
    poster: "/pages/0722a4c18000.webp",
  },
  {
    video: "/pages/a2ae508dec2a.mp4",
    poster: "/pages/b1a768ac08c6.webp",
  },
  {
    video: "/pages/13b5f752394b.mp4",
    poster: "/pages/02f4873f95ee.webp",
  },
  {
    video: "/pages/3ab03969c36d.mp4",
    poster: "/pages/0f1a6439906d.webp",
  },
];
export const JUTSU_GRID: string | null = "/pages/e3068952d4e4.png";
export const JUTSU_STEPS = [
  {
    n: "1",
    title: "Build the set",
    body: "Describe the space and RaisAI blocks it out in 3D — walls, props, lighting and camera.",
  },
  {
    n: "2",
    title: "Stage it",
    body: "Move props, reframe the camera and lock the shot you want before you spend a credit.",
  },
  {
    n: "3",
    title: "Export to Seedance",
    body: "Send the blockout to a video model and get a finished shot that matches your layout.",
  },
];

export const COURSES: Course[] = [
  {
    title: "Blockbuster 4K: The AI Filmmaking Pipeline",
    desc: "One 40-minute tutorial — scripting, asset creation, and scene-by-scene prompt engineering — chaptered into sections you can follow along with, shot by shot.",
    chips: ["Movie making", "Intermediate", "10 modules", "40 min"],
    img: "/pages/86a25c8392ef.webp",
  },
  {
    title: "Build an Ultra-Realistic Short Film in 4K",
    desc: "A 33-minute director's masterclass. A football drama built shot by shot with Claude Fable 5 and Seedance 2.0 4K.",
    chips: ["Movie making", "Intermediate", "19 modules", "33 min"],
    img: "/pages/d2542d1fc6bb.webp",
  },
  {
    title: "Add AI VFX to Real Footage",
    desc: "Turn footage you shot on a normal camera into cinematic 4K VFX with Seedance 2.0 — world swaps, creatures, and full handheld showcase shots, one sentence at a time.",
    chips: ["Movie making", "Advanced", "11 modules", "12 min"],
    img: "/pages/8fd14f86ce84.webp",
  },
  {
    title: "Make an AI Animated Short",
    desc: "Build one animated story across eight distinct visual worlds, from concept and scene design to a finished short.",
    chips: ["Movie making", "Intermediate", "11 modules", "17 min"],
    img: "/pages/82f8cff2f23f.webp",
  },
];
export const PROMPT_BANK: string[] = [
  "Static shot",
  "Pan right",
  "Tilt up",
  "Zoom in",
  "Dolly zoom",
  "Rack focus",
  "Crane up",
  "Drone orbit",
  "Aerial pullback",
  "Dolly in",
];

export const ORIGINAL_ROWS: OriginalRow[] = [
  {
    title: "RaisAI Choice",
    posters: [
      "/pages/4ea2b2837778.webp",
      "/pages/cd5f7e44ca4d.webp",
      "/pages/44b0ad41b161.webp",
      "/pages/d706d1784e1f.webp",
      "/pages/aad2714ebb06.webp",
      "/pages/a74a89494e95.webp",
    ],
  },
  {
    title: "First Look",
    posters: [
      "/pages/0580c7a0b2a6.webp",
      "/pages/4ce83128d22e.webp",
      "/pages/26746aae7b2b.webp",
      "/pages/962821afa921.webp",
      "/pages/62e736b51a17.webp",
      "/pages/665ba3e48808.webp",
    ],
  },
  {
    title: "On Our Radar",
    posters: [
      "/pages/5375d89140eb.webp",
      "/pages/a74a89494e95.webp",
      "/pages/a1e4b2708613.webp",
      "/pages/aad2714ebb06.webp",
      "/pages/ec38a6e487b5.webp",
      "/pages/8126f8141181.webp",
    ],
  },
  {
    title: "Coming Soon",
    posters: [
      "/pages/9dcc88b34b02.webp",
      "/pages/67e2bbafb5e7.webp",
      "/pages/7dfa5c6f89c8.webp",
      "/pages/d210cf325998.webp",
      "/pages/00f9364092b4.webp",
      "/pages/93ef65525be9.webp",
    ],
  },
  {
    title: "Top-3 Winners",
    posters: ["/pages/c756e9c0d2f4.webp", "/pages/a3f983ab75af.webp"],
  },
  {
    title: "Honorable Mentions",
    posters: [
      "/pages/e2597d862ec9.webp",
      "/pages/21a57d0509d6.webp",
      "/pages/0229d877ed76.webp",
      "/pages/e73d847071fa.webp",
      "/pages/e041b8a657e5.webp",
      "/pages/ed691fbe325c.webp",
    ],
  },
];
export const ORIGINALS_HERO: string | null = "/pages/f0eeaf6d49da.mp4";
