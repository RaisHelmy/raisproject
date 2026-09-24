/**
 * Data for the studio / tool replicas reached from the mega menu: Lipsync,
 * Shorts, Explainer, Mixed Media, Faceless, Moodboard, Character and the
 * Apps pages. Media lives in public/apps.
 */

export interface Preset { title: string; media: string; video: boolean }
export interface FieldRow { label: string; value: string }
export interface StudioStep { n: string; t: string; d: string }
export interface StudioDef {
  slug: string; name: string; heading: string; sub?: string;
  tabs?: string[]; rows: FieldRow[]; generate: string; presets: Preset[];
  heroTitle?: string; heroSub?: string; steps?: StudioStep[];
}
export interface IntroDef { slug: string; name: string; heading: string; sub: string; cta: string; hero: string[]; presets: Preset[] }
export interface AppDef { slug: string; name: string; heading: string; sub: string; slots: string[]; action: string; cost: string; art: string; steps: string[] }

export const STUDIOS: StudioDef[] = [
  {
    slug: "lipsync-studio",
    heroTitle: "Lipsync models, one click away",
    heroSub: "Create lipsynced videos with the world’s leading models, from Infiniti Talk and RaisAI Speak to Google VEO3, Kling, and more.",
  steps: [{ n: "1", t: "Upload image or video", d: "Add any photo or clip as your base" }, { n: "2", t: "Generate or upload audio", d: "Upload audio or type to generate speech" }, { n: "3", t: "Pick a model", d: "Choose a model and create your video" }],
 name: "Lipsync Studio", heading: "Lipsync models, one click away",
    tabs: ["Lipsync Studio", "UGC Factory"],
    rows: [{ label: "Audio", value: "Audio text" }, { label: "Model", value: "Wan 2.5 Fast" }, { label: "Duration", value: "5s" }, { label: "Resolution", value: "720p" }],
    generate: "Generate",
    presets: [

    ],
  },
  {
    slug: "shorts-studio", name: "Shorts Studio", heading: "Shorts Studio",
    rows: [{ label: "Detected language", value: "Auto detect" }, { label: "Output ratio", value: "Vertical" }],
    generate: "Generate",
    presets: [
    { title: "Bold Urban", media: "/apps/ba56f79e9dd0.mp4", video: true },
    { title: "Green Contrast", media: "/apps/8ca7a55aaec8.mp4", video: true },
    { title: "Urban Serenity", media: "/apps/77ce4339e837.mp4", video: true },
    { title: "Warm Glow", media: "/apps/40a3183ca878.mp4", video: true },
    { title: "Yellow Frame", media: "/apps/6bc6c0f09c08.mp4", video: true },
    { title: "Monochrome Vibes", media: "/apps/672cd16dd262.mp4", video: true },
    { title: "Claymation", media: "/apps/16b55b3c8414.mp4", video: true },
    { title: "Marker Scribble", media: "/apps/7f172c1f9e77.mp4", video: true },
    { title: "Sticker Type", media: "/apps/1563ad640617.mp4", video: true },
    { title: "Blue Comic", media: "/apps/dbe1bcde0c3f.mp4", video: true },
    { title: "Red Graffiti", media: "/apps/c70bd8a7a6a3.mp4", video: true },
    { title: "Watercolor", media: "/apps/8ead95b576a0.mp4", video: true },
    { title: "Pencil Sketch", media: "/apps/835861bc37ba.mp4", video: true },
    { title: "Desktop", media: "/apps/26a82f1e085e.mp4", video: true },
    { title: "Acid Green", media: "/apps/5202bfdc0aec.webp", video: false },
    { title: "Balloon Type", media: "/apps/9aa0266b9434.webp", video: false },
    { title: "Blueprint", media: "/apps/ce014fdf4046.webp", video: false },
    { title: "Bold Caption", media: "/apps/65f8b5d5f0a8.webp", video: false },
    { title: "Bounding Box", media: "/apps/1799a9e8f532.webp", video: false },
    { title: "Circuit", media: "/apps/289bd078a671.webp", video: false },
    { title: "Comic Burst", media: "/apps/bdd1055a3e41.webp", video: false },
    { title: "Comic Pop", media: "/apps/dbc5862ec02c.webp", video: false },
    { title: "Pink Wash", media: "/apps/835bdf8dc008.webp", video: false },
    { title: "Gold Stars", media: "/apps/5f310cf2715b.webp", video: false },
    ],
  },
  {
    slug: "explainer", name: "RaisAI Explainer", heading: "RaisAI Explainer",
    rows: [{ label: "Aspect Ratio", value: "16:9" }, { label: "Duration", value: "1m" }, { label: "Voice", value: "Cillian" }],
    generate: "Generate ~200",
    presets: [
    { title: "Editorial Motion Graphics", media: "/apps/68f3c9cf6cbb.mp4", video: true },
    { title: "Stickman Cartoon", media: "/apps/0661720b0aa1.mp4", video: true },
    { title: "Watercolor Chronicle", media: "/apps/890b5cb511fa.mp4", video: true },
    { title: "Fairy Tale & Myth", media: "/apps/bb1deaeb617a.mp4", video: true },
    { title: "Paper Diorama", media: "/apps/fc99d88bc81f.mp4", video: true },
    { title: "Pastel Flat 2D", media: "/apps/0bec0d20c3d5.mp4", video: true },
    { title: "Colorful 3D", media: "/apps/0d24bdfd7fc8.mp4", video: true },
    { title: "Hand Drawn", media: "/apps/c338a162fca6.mp4", video: true },
    { title: "Poster Vector", media: "/apps/5383e83dc25a.mp4", video: true },
    { title: "Mannequin", media: "/apps/a568e132d632.mp4", video: true },
    { title: "Whiteboard Doodle", media: "/apps/b5cd3919a6e8.mp4", video: true },
    { title: "3D Papercraft", media: "/apps/2706b52241ba.mp4", video: true },
    { title: "Mixed Media", media: "/apps/7a0135229878.mp4", video: true },
    { title: "Low Poly", media: "/apps/7e4bcfd5af89.mp4", video: true },
    { title: "2D Illustrator", media: "/apps/35aaaa461610.mp4", video: true },
    { title: "Pixel Art", media: "/apps/4a3f3e953483.mp4", video: true },
    { title: "Claymotion", media: "/apps/8d0140f95d68.mp4", video: true },
    { title: "Isometric Flat Vector", media: "/apps/66721ec40b41.mp4", video: true },
    { title: "3D Mix", media: "/apps/a29ab43d2ba5.mp4", video: true },
    { title: "Studio 3D", media: "/apps/60bad700bb42.mp4", video: true },
    { title: "Fluffy Toy", media: "/apps/c86d9799334a.mp4", video: true },
    { title: "Paper collage", media: "/apps/d1bb35d5e08a.mp4", video: true },
    ],
  },
  {
    slug: "mixed-media", name: "Mixed Media", heading: "Layer mixed media",
    rows: [{ label: "FPS", value: "8 FPS" }, { label: "Resolution", value: "1K" }],
    generate: "Generate",
    presets: [
      { title: "Sketch", media: "/apps/cb759b55f8b5.mp4", video: true },
      { title: "Canvas", media: "/apps/0c2333eb950c.mp4", video: true },
      { title: "Flash comic", media: "/apps/c939bb5e3115.mp4", video: true },
      { title: "Overexposed", media: "/apps/4a1d47c4a1ff.mp4", video: true },
      { title: "Paper", media: "/apps/8641baa6e9bd.mp4", video: true },
      { title: "Noir", media: "/apps/d539a473ecbb.mp4", video: true },
      { title: "Particles", media: "/apps/ea6422c60019.mp4", video: true },
      { title: "Hand paint", media: "/apps/3b9e84e68d90.mp4", video: true },
      { title: "Toxic", media: "/apps/424e769df36c.mp4", video: true },
      { title: "Tracking", media: "/apps/fe2779d4d7b0.mp4", video: true },
      { title: "Ultraviolet", media: "/apps/3b1873dff71e.mp4", video: true },
      { title: "Windows", media: "/apps/3294f34db665.mp4", video: true },
      { title: "Acid", media: "/apps/001c58ba53a5.webp", video: false },
      { title: "Palette", media: "/apps/d0b10bf77260.mp4", video: true },
      { title: "Comic", media: "/apps/7ab4d48617b5.mp4", video: true },
      { title: "Akrill", media: "/apps/3898c8a96589.mp4", video: true },
      { title: "Two color", media: "/apps/8221cde638d3.mp4", video: true },
      { title: "Multiverse", media: "/apps/93d6ddbe68d0.mp4", video: true },
      { title: "Fragments", media: "/apps/812bc40ff84f.mp4", video: true },
      { title: "Origami", media: "/apps/bb4d0b6a2d18.mp4", video: true },
      { title: "Random Glow", media: "/apps/f5e3d0996059.mp4", video: true },
      { title: "Vintage", media: "/apps/10ef5bdf9454.mp4", video: true },
      { title: "Cannabis", media: "/apps/d70eb952a82b.mp4", video: true },
      { title: "Bubbles", media: "/apps/f5f3a7e75430.mp4", video: true },
      { title: "Magazine", media: "/apps/118126bb46c6.mp4", video: true },
      { title: "Cold vision", media: "/apps/b598b8006695.mp4", video: true },
      { title: "Modern", media: "/apps/3d2f203541eb.mp4", video: true },
      { title: "LSD", media: "/apps/926747a16cc2.mp4", video: true },
      { title: "Broken mirror", media: "/apps/1cb31fcf8b22.mp4", video: true },
      { title: "Lava", media: "/apps/7d3d66912a72.mp4", video: true },
      { title: "Marble", media: "/apps/2ed91d9d6ff4.mp4", video: true },
      { title: "Ocean", media: "/apps/aea3798c12cf.mp4", video: true },
    ],
  },
  {
    slug: "faceless-studio", name: "Faceless Studio", heading: "Create your faceless channel",
    rows: [{ label: "Why We Dream?", value: "Education" }, { label: "The Golden Fish Story", value: "Storytelling" }, { label: "The Immortal Jellyfish", value: "Education" }],
    generate: "Generate",
    presets: [
    { title: "The Raven Who Stole the Light", media: "/apps/a422a9e0bd65.mp4", video: true },
    { title: "POV: 17th Century Factory Worker", media: "/apps/55f2222ead11.webm", video: true },
    { title: "Marie Antoinette — The Queen Who Still Sells", media: "/apps/cc6808fa69ee.webm", video: true },
    { title: "Why It’s So Hard to Spend Money?", media: "/apps/9e5bb48802e6.webm", video: true },
    { title: "Learning Numbers: Counting to 5", media: "/apps/1decafd9bcce.webm", video: true },
    { title: "Why We Dream?", media: "/apps/b96b589e88ce.webm", video: true },
    { title: "The Golden Fish Story", media: "/apps/2f72fce3ec70.webm", video: true },
    { title: "Brief History of Domestic Dogs", media: "/apps/377318ed850c.webm", video: true },
    { title: "The Immortal Jellyfish", media: "/apps/0971a6d2c5c0.webm", video: true },
    ],
  },
];

export const INTROS: IntroDef[] = [
  {
    slug: "character", name: "Character", heading: "Make your own character",
    sub: "Upload photos from multiple angles to train your character. Then use the same consistent character across new images and videos.",
    cta: "Create Character",
    hero: ["/apps/07390f6dc0c4.jpg", "/apps/53be6a114840.jpg", "/apps/a1b90ae659c7.jpg", "/apps/74b242e4a259.jpg"],
    presets: [

    ],
  },
  {
    slug: "moodboard", name: "Moodboard", heading: "Create your moodboard",
    sub: "Turn your references into a focused moodboard that defines style, tone, consistent details, and creative direction.",
    cta: "Build your moodboard",
    hero: ["/apps/6a2b82dd7c93.webp", "/apps/648b405276e9.webp", "/apps/650f6a22c7db.webp", "/apps/6c1a9088eddc.webp"],
    presets: [
    { title: "Warm ambient", media: "/apps/80cff2121684.webp", video: false },
    { title: "Y2K studio", media: "/apps/26ec94e59f56.webp", video: false },
    { title: "Swag era", media: "/apps/93f0af359fbf.webp", video: false },
    { title: "Theatrical light", media: "/apps/96579eae4e65.webp", video: false },
    { title: "Y2K street", media: "/apps/f9794372631d.webp", video: false },
    { title: "Flash editorial", media: "/apps/5a9b345a1cc5.webp", video: false },
    { title: "Old smartphone", media: "/apps/c7105e74c729.webp", video: false },
    { title: "Street photography", media: "/apps/8e49d0ffa519.webp", video: false },
    { title: "Retro BW", media: "/apps/65e9dd7ed42d.webp", video: false },
    { title: "Asian nostalgia", media: "/apps/fac1631526a0.webp", video: false },
    { title: "Surreal solarization", media: "/apps/5f487f32fce4.webp", video: false },
    { title: "Subtle flash", media: "/apps/684319526d56.webp", video: false },
    { title: "Digital camera", media: "/apps/6f87ad58e94d.webp", video: false },
    { title: "Siren", media: "/apps/89142bfe62d4.webp", video: false },
    { title: "Mystique city", media: "/apps/b6306f50401a.webp", video: false },
    { title: "Candy pop", media: "/apps/3e9af46f778f.webp", video: false },
    { title: "Double exposure", media: "/apps/a3312e509249.webp", video: false },
    { title: "2000s band", media: "/apps/bd97a8be433d.webp", video: false },
    { title: "Frutiger aero", media: "/apps/bdb9c9718c28.webp", video: false },
    { title: "Drain", media: "/apps/2c1668d80437.webp", video: false },
    ],
  },
];

export const APPS: AppDef[] = [
  {
    slug: "face-swap", name: "Face Swap", heading: "Instant face swap in a single click",
    sub: "The best instant AI face swap technology for photos",
    slots: ["Target Image", "Your Photo"], action: "Face Swap", cost: "2", art: "/apps/7cdeb4dc413e.webp",
    steps: ["Upload your media", "Pick the settings you want", "Generate and download"],
  },
  {
    slug: "character-swap", name: "Character Swap", heading: "Swap any character in one click",
    sub: "Replace the character in a photo or clip, keeping the scene intact",
    slots: ["Target Image", "Your Character"], action: "Character Swap", cost: "2", art: "/apps/7cdeb4dc413e.webp",
    steps: ["Upload your media", "Pick the settings you want", "Generate and download"],
  },
  {
    slug: "relight", name: "Relight", heading: "Relight any photo",
    sub: "Adjust lighting position, color temperature, and brightness to perfect any photo",
    slots: ["Upload media"], action: "Relight", cost: "2", art: "/apps/167ed122cefe.webp",
    steps: ["Upload your media", "Pick the settings you want", "Generate and download"],
  },
  {
    slug: "video-relight", name: "Video Relight", heading: "Relight any clip",
    sub: "Change the lighting of a finished clip without reshooting it",
    slots: ["Upload video"], action: "Relight", cost: "6", art: "/apps/531a36ac5df8.webp",
    steps: ["Upload your media", "Pick the settings you want", "Generate and download"],
  },
  {
    slug: "video-rehex", name: "Video Rehex", heading: "Restyle any clip",
    sub: "Re-render a clip in a new look while keeping its motion",
    slots: ["Upload video"], action: "Rehex", cost: "6", art: "/apps/ce2b77ca47c8.webp",
    steps: ["Upload your media", "Pick the settings you want", "Generate and download"],
  },
];
