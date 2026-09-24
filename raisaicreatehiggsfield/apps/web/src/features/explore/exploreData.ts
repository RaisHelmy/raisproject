/**
 * Explore page content, generated from the reference Explore page by
 * scripts/reference-menu/gen-explore.py. Media paths point at files under
 * public/explore (downloaded copies; swap them for your own assets later).
 * Brand names in copy were changed from the reference to RaisAI; model names
 * are kept as-is.
 */
export interface HeroItem {
  href: string;
  title: string;
  desc: string;
  img: string | null;
  video: string | null;
}
export interface Tile {
  href: string;
  title: string;
  desc: string;
  logo: string | null;
  icon: "banana" | "academy" | null;
  badge: string | null;
  kind: string | null;
}
export interface PresetCard {
  img: string | null;
  label: string;
  thumbs: string[];
}
export interface GridCard {
  aspect: number;
  img: string | null;
  video: string | null;
  prompt: string;
  author: string;
  avatar: string | null;
  likes: string;
}
export interface GridSection {
  id: string;
  title: string;
  href: string;
  subtitle: string;
  viewAll: { href: string; label: string } | null;
  columns: GridCard[][];
}
export interface ProjectItem {
  href: string;
  name: string;
  author: string;
  img: string | null;
}
export interface LinkItem {
  href: string;
  label: string;
}

export const HERO: HeroItem[] = [
  {
    href: "/gpt-astra",
    title: "RAISAI × GPT-6 ASTRA",
    desc: "Turn a single prompt into a playable 3D game. Story, mechanics, and every asset included",
    img: "/explore/8adc9ae347fb.webp",
    video: "/explore/video/221241a64ffb.mp4",
  },
  {
    href: "/3d-jutsu",
    title: "RaisAI 3D Jutsu, powered by GPT-6 Astra",
    desc: "Turn a single prompt into a fully editable, interactive 3D world",
    img: "/explore/3516a9278ab7.webp",
    video: "/explore/video/b8858e492004.mp4",
  },
  {
    href: "/create/video?model=genjutsu",
    title: "RaisAI Genjutsu",
    desc: "One upload in. Endless new visions out.",
    img: "/explore/de8c39892dfd.webp",
    video: "/explore/video/232f849a7300.mp4",
  },
  {
    href: "/create/video?model=gemini-omni-flash-1-1",
    title: "Gemini Omni 1.1 Flash",
    desc: "A new suite of creative controls for video generation",
    img: "/explore/ab0e4b70ff91.webp",
    video: "/explore/video/cef8ab942d99.mp4",
  },
  {
    href: "/@higgsfield.studio/projects/trigger",
    title: "The Trigger",
    desc: "8 minutes of action, fights, and one impossible hitman mission.",
    img: "/explore/ffbc6bb38107.webp",
    video: "/explore/video/99ad6cbb161b.mp4",
  },
];
export const PROMO = {
  poster: "/explore/4f8ec79edd38.jpg",
  video: "/explore/video/4b06a4ea24c9.mp4",
};
export const TILES: Tile[] = [
  {
    href: "/create/video?model=seedance_2_5",
    title: "Seedance 2.5",
    desc: "The most advanced video model",
    logo: "/explore/60846098b31e.png",
    icon: null,
    badge: "Top",
    kind: "Video",
  },
  {
    href: "/create/image?model=nano-banana-pro",
    title: "Nano Banana Pro",
    desc: "Generate high-quality visuals",
    logo: null,
    icon: "banana",
    badge: null,
    kind: "Image",
  },
  {
    href: "/canvas",
    title: "Supercomputer",
    desc: "Automation, skills, apps and more",
    logo: "/explore/e3a40c41df73.png",
    icon: null,
    badge: null,
    kind: null,
  },
  {
    href: "/developer/mcp",
    title: "MCP & CLI",
    desc: "Turn Claude into a creative engine",
    logo: "/explore/0a7917c296d6.png",
    icon: null,
    badge: null,
    kind: null,
  },
  {
    href: "/movies",
    title: "Cinema Studio 4.0",
    desc: "Create cinematic scenes effortlessly",
    logo: "/explore/30de95f51149.png",
    icon: null,
    badge: null,
    kind: null,
  },
  {
    href: "/academy",
    title: "RaisAI Academy",
    desc: "Learn how to use RaisAI",
    logo: null,
    icon: "academy",
    badge: null,
    kind: null,
  },
];
export const GENJUTSU = {
  title: "RaisAI Genjutsu",
  subtitle:
    "Reality Manipulation — transfer motion into new scenes, or swap details while everything else stays as filmed.",
  buttons: [
    { href: "/create/video?model=genjutsu", label: "Start generating" },
    { href: "/genjutsu", label: "Learn more" },
  ],
  viewAll: { href: "/higgsfield-genjutsu-presets", label: "View all presets" },
  columns: [
    [
      {
        img: "/explore/5d07c9ee417a.webp",
        label: "Objects swap",
        thumbs: [
          "/explore/5d07c9ee417a.webp",
          "/explore/eff523528767.webp",
          "/explore/32f4d2a87763.webp",
        ],
      },
      {
        img: "/explore/3e15a368cf18.webp",
        label: "Motion transfer",
        thumbs: [
          "/explore/3e15a368cf18.webp",
          "/explore/c59b8067744e.webp",
          "/explore/dc1cdd73c17a.webp",
        ],
      },
      {
        img: "/explore/df783acc205f.webp",
        label: "Objects swap",
        thumbs: [
          "/explore/df783acc205f.webp",
          "/explore/e0d7183c6bd4.webp",
          "/explore/290ba4888ef7.webp",
        ],
      },
      {
        img: "/explore/cf8e43698555.webp",
        label: "Motion transfer",
        thumbs: [
          "/explore/cf8e43698555.webp",
          "/explore/6d56779f5ebb.webp",
          "/explore/20ceb1d5ebf7.webp",
        ],
      },
      {
        img: "/explore/1104b28ca8d9.webp",
        label: "Objects swap",
        thumbs: [
          "/explore/1104b28ca8d9.webp",
          "/explore/77cd0ebeefb3.webp",
          "/explore/daac04333bfd.webp",
        ],
      },
      {
        img: "/explore/b7b1bf9f0142.webp",
        label: "Motion transfer",
        thumbs: [
          "/explore/b7b1bf9f0142.webp",
          "/explore/1865594f6d28.webp",
          "/explore/1a92e0ce1f0c.webp",
        ],
      },
      {
        img: "/explore/579b0dde7b62.webp",
        label: "Motion transfer",
        thumbs: [
          "/explore/579b0dde7b62.webp",
          "/explore/230d60bafe43.webp",
          "/explore/6db2a80b78fb.webp",
          "/explore/f6641203fa88.webp",
        ],
      },
      {
        img: "/explore/dde61c28e847.webp",
        label: "Motion transfer",
        thumbs: [
          "/explore/dde61c28e847.webp",
          "/explore/a427a686ddcd.webp",
          "/explore/835133616c49.webp",
        ],
      },
      {
        img: "/explore/9c2e0b9f5de0.webp",
        label: "Motion transfer",
        thumbs: [
          "/explore/9c2e0b9f5de0.webp",
          "/explore/753a0e6ca9c5.webp",
          "/explore/96ec71745a3c.webp",
        ],
      },
      {
        img: "/explore/8e067857048b.webp",
        label: "Motion transfer",
        thumbs: [
          "/explore/8e067857048b.webp",
          "/explore/37a65ab58c3d.webp",
          "/explore/630394712bc6.webp",
          "/explore/5630b9f6657c.webp",
        ],
      },
      {
        img: "/explore/18a10179bb03.webp",
        label: "Motion transfer",
        thumbs: [
          "/explore/18a10179bb03.webp",
          "/explore/aee731f453cd.webp",
          "/explore/66f08dece03c.webp",
          "/explore/e6e224e2028b.webp",
        ],
      },
      {
        img: "/explore/c0cef9aa5f2d.webp",
        label: "Motion transfer",
        thumbs: [
          "/explore/c0cef9aa5f2d.webp",
          "/explore/aead4daca875.webp",
          "/explore/5a3dd5ad9331.webp",
        ],
      },
    ],
    [
      {
        img: "/explore/28ede621e152.webp",
        label: "Objects swap",
        thumbs: [
          "/explore/28ede621e152.webp",
          "/explore/6b381982f4a8.webp",
          "/explore/731fb1607c1e.webp",
        ],
      },
      {
        img: "/explore/9c6291dc534b.webp",
        label: "Objects swap",
        thumbs: [
          "/explore/9c6291dc534b.webp",
          "/explore/aa87a101daf9.webp",
          "/explore/37c727f11a44.webp",
        ],
      },
      {
        img: "/explore/a0de75e633ec.webp",
        label: "Motion transfer",
        thumbs: [
          "/explore/a0de75e633ec.webp",
          "/explore/45ac5887f510.webp",
          "/explore/1b4605b762d8.webp",
        ],
      },
      {
        img: "/explore/0a9d3ddfeb2f.webp",
        label: "Objects swap",
        thumbs: [
          "/explore/0a9d3ddfeb2f.webp",
          "/explore/6d0baa75a7b7.webp",
          "/explore/37778601900c.webp",
        ],
      },
      {
        img: "/explore/d3b6046ea94c.webp",
        label: "Motion transfer",
        thumbs: [
          "/explore/d3b6046ea94c.webp",
          "/explore/353dc9328197.webp",
          "/explore/77ba22701ba6.webp",
          "/explore/4619cbffec9c.webp",
        ],
      },
      {
        img: "/explore/54e5563b7e5c.webp",
        label: "Motion transfer",
        thumbs: ["/explore/54e5563b7e5c.webp", "/explore/2611aeb0cfb2.webp"],
      },
      {
        img: "/explore/8283871e6d59.webp",
        label: "Motion transfer",
        thumbs: [
          "/explore/8283871e6d59.webp",
          "/explore/1a86563ec8dc.webp",
          "/explore/665d287fcc5f.webp",
          "/explore/bf9f39a54bf0.webp",
        ],
      },
    ],
    [
      {
        img: "/explore/c55a6d4a2627.webp",
        label: "Objects swap",
        thumbs: [
          "/explore/c55a6d4a2627.webp",
          "/explore/1840c50aa0f7.webp",
          "/explore/b71bcbb811e9.webp",
        ],
      },
      {
        img: "/explore/b399d0bd0e54.webp",
        label: "Motion transfer",
        thumbs: [
          "/explore/b399d0bd0e54.webp",
          "/explore/047e8b002009.webp",
          "/explore/e8c1122a1063.webp",
        ],
      },
      {
        img: "/explore/7770f723461c.webp",
        label: "Objects swap",
        thumbs: [
          "/explore/7770f723461c.webp",
          "/explore/56c35cf5a6ed.webp",
          "/explore/af8dbd4d2f70.webp",
        ],
      },
      {
        img: "/explore/95abe17297d5.webp",
        label: "Motion transfer",
        thumbs: [
          "/explore/95abe17297d5.webp",
          "/explore/067a6e83a065.webp",
          "/explore/c22c9ed49e7b.webp",
        ],
      },
      {
        img: "/explore/063f49c2cb31.webp",
        label: "Motion transfer",
        thumbs: [
          "/explore/063f49c2cb31.webp",
          "/explore/0facc52a6217.webp",
          "/explore/4be91345ec23.webp",
        ],
      },
      {
        img: "/explore/61751db07cf5.webp",
        label: "Motion transfer",
        thumbs: [
          "/explore/61751db07cf5.webp",
          "/explore/f1f246972522.webp",
          "/explore/d3d0a8c5068f.webp",
        ],
      },
      {
        img: "/explore/78972d9436ba.webp",
        label: "Motion transfer",
        thumbs: [
          "/explore/78972d9436ba.webp",
          "/explore/e4952d413f0a.webp",
          "/explore/f29188d5413a.webp",
        ],
      },
      {
        img: "/explore/655a782947fa.webp",
        label: "Motion transfer",
        thumbs: [
          "/explore/655a782947fa.webp",
          "/explore/a78cb9dbec46.webp",
          "/explore/b1587bf16b6e.webp",
          "/explore/240197815494.webp",
        ],
      },
      {
        img: "/explore/eb26757006fd.webp",
        label: "Motion transfer",
        thumbs: [
          "/explore/eb26757006fd.webp",
          "/explore/6fb127d2e3c1.webp",
          "/explore/970f7c64caa1.webp",
          "/explore/b03040ffdb46.webp",
        ],
      },
    ],
    [
      {
        img: "/explore/b75497bb4d68.webp",
        label: "Motion transfer",
        thumbs: [
          "/explore/b75497bb4d68.webp",
          "/explore/7c54e209e485.webp",
          "/explore/90775d58f750.webp",
        ],
      },
      {
        img: "/explore/3fa623a482f2.webp",
        label: "Objects swap",
        thumbs: [
          "/explore/3fa623a482f2.webp",
          "/explore/4ee2b5e51051.webp",
          "/explore/f71d82dd37ae.webp",
        ],
      },
      {
        img: "/explore/5df7a634173f.webp",
        label: "Motion transfer",
        thumbs: [
          "/explore/5df7a634173f.webp",
          "/explore/3b0f00a84945.webp",
          "/explore/c192feda20ce.webp",
        ],
      },
      {
        img: "/explore/1a4e591ab265.webp",
        label: "Objects swap",
        thumbs: [
          "/explore/1a4e591ab265.webp",
          "/explore/b795542bbd02.webp",
          "/explore/8c9a1524962b.webp",
        ],
      },
      {
        img: "/explore/c0a33b93026b.webp",
        label: "Motion transfer",
        thumbs: [
          "/explore/c0a33b93026b.webp",
          "/explore/deacfff68936.webp",
          "/explore/d9d110f35715.webp",
        ],
      },
      {
        img: "/explore/a820835bbacb.webp",
        label: "Motion transfer",
        thumbs: [
          "/explore/a820835bbacb.webp",
          "/explore/3c167d41a466.webp",
          "/explore/97343381781b.webp",
          "/explore/65cda8ba41e1.webp",
        ],
      },
      {
        img: "/explore/c06c279154e1.webp",
        label: "Motion transfer",
        thumbs: [
          "/explore/c06c279154e1.webp",
          "/explore/ba3aeb7a16f8.webp",
          "/explore/2fc5c6906abb.webp",
        ],
      },
    ],
  ],
};
export const GRIDS: GridSection[] = [
  {
    id: "seedance-2-5-community",
    title: "Seedance 2.5",
    href: "/seedance-2-5-community",
    subtitle: "The most advanced AI video model",
    viewAll: {
      href: "/seedance-2-5-community",
      label: "View all of Seedance 2.5",
    },
    columns: [
      [
        {
          aspect: 1.7778,
          img: "/explore/dd85a6ff187f.webp",
          video: "/explore/video/252209071a84.mp4",
          prompt:
            "ONE UNBROKEN 15-SECOND TAKE, 16:9, no cuts — ONE camera, ONE location, ONE continuous movement from the first frame to the last. <<<image_1>>> = the location: an empty studio room with deep dusty-RED",
          author: "raisai_hall_of_fame",
          avatar: "/explore/c05ce4bd14b5.webp",
          likes: "159",
        },
        {
          aspect: 1.7778,
          img: "/explore/1e47977873d7.webp",
          video: "/explore/video/1d73f1e5e2c0.mp4",
          prompt:
            "Cinematic 15-second single continuous handheld shot, no cuts. A fictional young East Asian woman in her early twenties, entirely original character resembling no real person, model or existing film ch",
          author: "jighit",
          avatar: "/explore/95f34c1e3ae5.webp",
          likes: "108",
        },
        {
          aspect: 1.7778,
          img: "/explore/e9cd6ae113b3.webp",
          video: "/explore/video/c734376c96d2.mp4",
          prompt:
            "[14.08.2026 04:16] Али Kimsfield: Prompt: Main subject: beautiful slim young Korean woman, early 20s, natural appearance, realistic skin, minimal makeup, warm face. Black wavy hair in a loose low pony",
          author: "banksy_pancake_gold22",
          avatar: "/explore/c05ce4bd14b5.webp",
          likes: "233",
        },
      ],
      [
        {
          aspect: 1.7778,
          img: "/explore/77130363b33b.webp",
          video: "/explore/video/eb71714df015.mp4",
          prompt:
            "<<<image_1>>> — Ines Camera Settings: shot on 35mm film, anamorphic 2x squeeze, 2.39:1, oval bokeh, heavy grain, halation on the bulbs. Focal length: 35mm. Aperture: f/2.0. Camera Style: handheld ins",
          author: "bourgeois_mean",
          avatar: "/explore/c05ce4bd14b5.webp",
          likes: "139",
        },
        {
          aspect: 1.7778,
          img: "/explore/9f6c683e721d.webp",
          video: "/explore/video/14b0dcbdf473.mp4",
          prompt:
            "<<<image_1>>> — the woman in the reference. Camera Settings: anamorphic, 2.39:1, oval bokeh. Focal length: 40mm. Aperture: f/2.0. Camera Style: locked static three-quarter framing from the passenger s",
          author: "zhanay",
          avatar: "/explore/f6c1553de047.webp",
          likes: "187",
        },
        {
          aspect: 1.7778,
          img: "/explore/85112a74d0e8.webp",
          video: "/explore/video/5bd83f4a0172.mp4",
          prompt:
            "SCENE CONTEXT A 30-second high-energy commercial for CRUNCHO sour cream & onion chips, inspired by the rapid pacing, playful absurdism, practical miniatures, retro Japanese television energy and mixe",
          author: "gaziziz",
          avatar: "/explore/c05ce4bd14b5.webp",
          likes: "209",
        },
      ],
      [
        {
          aspect: 1.7778,
          img: "/explore/47015b29f263.webp",
          video: "/explore/video/575e7a48f829.mp4",
          prompt:
            "ONE UNBROKEN 15-SECOND TAKE, 16:9, no cuts — ONE camera, ONE location, one continuous scene. = the girl: early twenties, pale skin with real texture, long straight strawberry-blonde hair parted in t",
          author: "jennifer_lopez",
          avatar: "/explore/52e04d665c1f.webp",
          likes: "138",
        },
        {
          aspect: 1.7778,
          img: "/explore/c5277f1d029a.webp",
          video: "/explore/video/3f8d198cf892.mp4",
          prompt:
            "SCENE CONTEXT A premium 30-second Japanese commercial for SIPPO Cherry: playful, surreal, fashion-forward and highly polished. Energetic pacing, wide-angle intimacy, colorful Japanese advertising lan",
          author: "religious_raccoon_dark36",
          avatar: "/explore/c05ce4bd14b5.webp",
          likes: "388",
        },
        {
          aspect: 1.7778,
          img: "/explore/4f6add01bade.webp",
          video: "/explore/video/b12bc99c0384.mp4",
          prompt:
            "The woman in @image_1 sits at a wooden table in an underground food court, in a scene similar to @image_2—pale concrete pillars, cool fluorescent lights, and a blurred newspaper rack in the background",
          author: "futurist_ice_special",
          avatar: "/explore/c05ce4bd14b5.webp",
          likes: "148",
        },
      ],
      [
        {
          aspect: 1.7778,
          img: "/explore/895a7b6747fc.webp",
          video: "/explore/video/bd8fc56a5b7a.mp4",
          prompt:
            "CAMERA: slow tracking shot moving backwards, holding a constant medium framing (waist-up) as she walks toward the lens down the middle of a Tokyo street. Smooth gimbal glide, one unbroken take, no cut",
          author: "artificial_penguin",
          avatar: "/explore/c05ce4bd14b5.webp",
          likes: "66",
        },
        {
          aspect: 1.7778,
          img: "/explore/4db43b551225.webp",
          video: "/explore/video/37fb455cda94.mp4",
          prompt:
            "SCENE CONTEXT A 30-second premium beauty commercial for Bounce Vita Tinol Bounce Balloon Lip Serum SPF 35. Four adult Korean women form a bold, playful creative team inside a vibrant Y2K beauty studi",
          author: "radiating_crystal_deep60",
          avatar: "/explore/c05ce4bd14b5.webp",
          likes: "243",
        },
        {
          aspect: 1.7778,
          img: "/explore/1ff2f77ddb28.webp",
          video: "/explore/video/4c13d406e600.mp4",
          prompt:
            "A dynamic street fight unfolds in daylight, against a backdrop of a typical Japanese alleyway—low-rise houses, hedges, and light-colored asphalt. A man in a white shirt and loose tie faces a group of ",
          author: "smartbeetle1651",
          avatar: "/explore/c05ce4bd14b5.webp",
          likes: "153",
        },
      ],
    ],
  },
  {
    id: "gpt-image-2-community",
    title: "GPT Image 2",
    href: "/gpt-image-2-community",
    subtitle: "4K images with near-perfect text rendering.",
    viewAll: {
      href: "/gpt-image-2-community",
      label: "View all of GPT Image 2",
    },
    columns: [
      [
        {
          aspect: 0.5655,
          img: "/explore/07dae12f8616.webp",
          video: null,
          prompt:
            'Vertical mobile-first landing page for a fictional streetwear brand called "LOUD KIDS CLUB" (placeholder). Full-page poster-as-landing-page aesthetic in the spirit of Y2K skate-surf streetwear culture',
          author: "cezanne_cupcake_haze12",
          avatar: "/explore/c05ce4bd14b5.webp",
          likes: "941",
        },
        {
          aspect: 0.5655,
          img: "/explore/01a58d8373c4.webp",
          video: null,
          prompt:
            "Contemporary commercial lifestyle photograph, luxury snow-sports campaign aesthetic, Moncler × Prada Linea Rossa × Arc'teryx × Jacquemus Ski campaign style, authentic iPhone 16 Pro aesthetic — looks l",
          author: "adapting_potato_keen39",
          avatar: "/explore/c05ce4bd14b5.webp",
          likes: "176",
        },
      ],
      [
        {
          aspect: 1.7778,
          img: "/explore/1f6f9be0577b.webp",
          video: null,
          prompt:
            "Here's the updated prompt — same surreal coastal Mediterranean composition and dreamy mood, now featuring a young man instead of a boy: Surreal cinematic portrait photograph, shot on medium-format fi",
          author: "modular_pufferfish_swift82",
          avatar: "/explore/c05ce4bd14b5.webp",
          likes: "269",
        },
        {
          aspect: 0.7466,
          img: "/explore/0611b14bb4e0.webp",
          video: null,
          prompt:
            "Vertical editorial poster in the style of a premium design magazine spread. Clean paper-textured background with a duotone photo-collage subject, refined serif typography, and multi-column editorial b",
          author: "piffle_jack",
          avatar: "/explore/68fae746df18.webp",
          likes: "651",
        },
        {
          aspect: 1.7684,
          img: "/explore/266832e17686.webp",
          video: null,
          prompt:
            'Horizontal desktop landing page hero section for a fictional snowboard eyewear and mountain gear store called "APEX & SUMMIT" (placeholder). Cinematic sports-tech advertising aesthetic with extreme cl',
          author: "surreal_pencil_sage24",
          avatar: "/explore/c05ce4bd14b5.webp",
          likes: "318",
        },
        {
          aspect: 1.5059,
          img: "/explore/e752ae4b889a.webp",
          video: null,
          prompt:
            "Bold graphic illustration poster design, Japanese street art meets vintage propaganda aesthetic, centered powerful roaring giant panda head snarling aggressively with teeth bared, pink tongue visible,",
          author: "singing_pencillin",
          avatar: "/explore/c05ce4bd14b5.webp",
          likes: "224",
        },
      ],
      [
        {
          aspect: 0.7466,
          img: "/explore/1589950a9478.webp",
          video: null,
          prompt:
            "A vertical exhibition invitation poster in the aesthetic of 1970s–80s punk silkscreen print design. Gritty, graphic, high-contrast, DIY zine energy with halftone grain and limited screen-printed color",
          author: "prompt_beetlez",
          avatar: "/explore/c05ce4bd14b5.webp",
          likes: "680",
        },
        {
          aspect: 1.7684,
          img: "/explore/4d349dcb19e1.webp",
          video: null,
          prompt:
            'Horizontal desktop landing page for a fictional virtual outfit try-on service called "DRESSR" (placeholder). Full Y2K / PS2-era video game character select screen aesthetic. Low-poly 3D models, glossy',
          author: "steampunk_donut_jade65",
          avatar: "/explore/c05ce4bd14b5.webp",
          likes: "241",
        },
        {
          aspect: 0.7466,
          img: "/explore/435538bf0b06.webp",
          video: null,
          prompt:
            "Cinematic urban photograph, contemporary Tokyo street photography aesthetic, hyperreal 3D billboard phenomenon captured during magic hour. Iconic Shibuya Scramble Crossing scene at blue hour (early ev",
          author: "gaziziz",
          avatar: "/explore/c05ce4bd14b5.webp",
          likes: "127",
        },
      ],
      [
        {
          aspect: 1.7684,
          img: "/explore/cdd104debb85.webp",
          video: null,
          prompt:
            'Vertical 90s manga-style poster with a clean pure white paper background and subtle grain. Massive arched bold slanted italic display wordmark "AKAI" in deep midnight-blue across the top, partially ob',
          author: "folk_rainbow_wise28",
          avatar: "/explore/c05ce4bd14b5.webp",
          likes: "391",
        },
        {
          aspect: 1.7684,
          img: "/explore/b64e605bee53.webp",
          video: null,
          prompt:
            'Horizontal desktop landing page hero section for a fictional playful homeware store called "kiln & co." (placeholder). Minimalist editorial layout combined with whimsical character-driven ceramic prod',
          author: "impressionist_cookie_haze96",
          avatar: "/explore/c05ce4bd14b5.webp",
          likes: "535",
        },
        {
          aspect: 0.7466,
          img: "/explore/dfe605329f49.webp",
          video: null,
          prompt:
            "Vertical advertising poster with a surreal playful concept, photorealistic rendering. The entire composition is shot from a first-person POV from inside a cardboard moving box looking straight up — th",
          author: "wer",
          avatar: "/explore/8e32c676527c.webp",
          likes: "560",
        },
      ],
    ],
  },
  {
    id: "marketing-studio-community",
    title: "Marketing Studio",
    href: "/marketing-studio-community",
    subtitle: "See what creators and brands are making with Marketing Studio.",
    viewAll: {
      href: "/marketing-studio-community",
      label: "View all of Marketing Studio",
    },
    columns: [
      [
        {
          aspect: 1.7778,
          img: "/explore/7eaa29b15a5f.webp",
          video: "/explore/video/41d74fa4a530.mp4",
          prompt:
            "chocolate japanese style commercial, with chocolate crunching, pieces breaking, hands passing chocolate to each other, japanese happy people smiling while biting, and these little characters animated ",
          author: "byzantinetiger1459",
          avatar: "/explore/c05ce4bd14b5.webp",
          likes: "447",
        },
        {
          aspect: 0.5625,
          img: "/explore/e1ddbbdce43f.webp",
          video: "/explore/video/aa352728e8b4.mp4",
          prompt:
            "Vertical 9:16 UGC sneaker unboxing and review, shot on iPhone front and back camera mix, bright natural daylight from a window, casual bedroom energy, handheld selfie perspective, real skin tones, no ",
          author: "byzantinetiger1459",
          avatar: "/explore/c05ce4bd14b5.webp",
          likes: "166",
        },
        {
          aspect: 0.75,
          img: "/explore/0618a23ee2b2.webp",
          video: "/explore/video/e2a13618517c.mp4",
          prompt: "dynamic <<<product:7c12cfc3-2c23-454f-9592-0bc0dc286153>>>",
          author: "byzantinetiger1459",
          avatar: "/explore/c05ce4bd14b5.webp",
          likes: "125",
        },
      ],
      [
        {
          aspect: 0.75,
          img: "/explore/de35a5706669.webp",
          video: "/explore/video/690b3ebf5232.mp4",
          prompt:
            "A young stylish female influencer <<<avatar:cd6fb78c-e1a2-42f1-8b1e-902c15511877>>> s in a cozy modern apartment with soft natural daylight. She records herself using the front camera of her phone (se",
          author: "byzantinetiger1459",
          avatar: "/explore/c05ce4bd14b5.webp",
          likes: "540",
        },
        {
          aspect: 0.5625,
          img: "/explore/652c5c1550c7.webp",
          video: "/explore/video/4e7a025b6693.mp4",
          prompt:
            "10-sec TikTok UGC, 9:16, iPhone 0:00–0:02 | Selfie close-up, front camera, young Asian woman mid-twenties with messy short black pixie haircut and choppy fringe, small silver hoop nose ring, no-makeup",
          author: "chapman",
          avatar: "/explore/5a8d07df872f.webp",
          likes: "167",
        },
        {
          aspect: 0.75,
          img: "/explore/0cb2296e4945.webp",
          video: "/explore/video/86f4d5edab8f.mp4",
          prompt:
            'HOOK (0–2 sec) POV handheld shot, slightly shaky. A bright red shopping bag with gold text "MAISON BRUNÉ" gets tossed onto a white unmade bed from above — lands with a satisfying thud, tissue paper ru',
          author: "byzantinetiger1459",
          avatar: "/explore/c05ce4bd14b5.webp",
          likes: "105",
        },
      ],
      [
        {
          aspect: 0.5625,
          img: "/explore/1a30966a08d1.webp",
          video: "/explore/video/0ef952d4000f.mp4",
          prompt:
            "Style: UGC, get ready with me, iPhone front camera, fashion vlog, playful energy Prompt: A stylish young girl is filming herself in her room while getting dressed. The room is aesthetic — mirror, clot",
          author: "byzantinetiger1459",
          avatar: "/explore/c05ce4bd14b5.webp",
          likes: "399",
        },
        {
          aspect: 0.75,
          img: "/explore/b334c1610fc5.webp",
          video: "/explore/video/f2830a57e83c.mp4",
          prompt:
            "6-second vertical video ad (9:16), cinematic, dark pirate-ship interior lit by candlelight. Sec 0–2: Close-up of an old treasure chest with red velvet lining being opened. Inside — gold coins and two ",
          author: "byzantinetiger1459",
          avatar: "/explore/c05ce4bd14b5.webp",
          likes: "61",
        },
      ],
      [
        {
          aspect: 0.75,
          img: "/explore/60e8f2b5a857.webp",
          video: "/explore/video/b6fe9fc4fe8b.mp4",
          prompt:
            "<<<avatar:bcd9e6ee-c000-48e6-9f4b-a20fc2a674f7>>>Промт: A 15-second vertical (9:16) UGC try-on video filmed on a smartphone. A young East Asian woman with a short black bob haircut stands in front of ",
          author: "byzantinetiger1459",
          avatar: "/explore/c05ce4bd14b5.webp",
          likes: "310",
        },
        {
          aspect: 1.3333,
          img: "/explore/7ce4481cee37.webp",
          video: "/explore/video/10a67c72d459.mp4",
          prompt:
            "15-sec TikTok UGC, 9:16, iPhone 0:00–0:03 | Wide handheld shot, phone propped on a bench across the gym floor, young man mid-twenties named Adam, Black, clean low fade haircut, sharp jawline, sweat gl",
          author: "chapman",
          avatar: "/explore/5a8d07df872f.webp",
          likes: "173",
        },
        {
          aspect: 1.7778,
          img: "/explore/6cccf369cfdc.webp",
          video: "/explore/video/3172ddb98fb1.mp4",
          prompt:
            "High-energy cinematic product commercial. Molten liquid silver flows and swirls elegantly in mid-air, pouring into a sleek silver chrome sneaker. The liquid chrome ripples across the shoe's surface, f",
          author: "byzantinetiger1459",
          avatar: "/explore/c05ce4bd14b5.webp",
          likes: "53",
        },
        {
          aspect: 0.75,
          img: "/explore/22aeb1645cb3.webp",
          video: "/explore/video/2aa559cce2ed.mp4",
          prompt:
            "<<<product:2e29530a-6f74-4086-aa82-42aa73b5bf14>>> Authentic amateur-style UGC in a bright bathroom: white tiles, soft natural daylight from a window, real-life details (folded towel, small plant, s",
          author: "byzantinetiger1459",
          avatar: "/explore/c05ce4bd14b5.webp",
          likes: "162",
        },
      ],
    ],
  },
  {
    id: "seedance-2-community",
    title: "Seedance 2.0",
    href: "/seedance-2-community",
    subtitle: "Browse premium AI video generations from the RaisAI community.",
    viewAll: {
      href: "/seedance-2-community",
      label: "View all of Seedance 2.0",
    },
    columns: [
      [
        {
          aspect: 1.7778,
          img: "/explore/9ef97de32c4f.webp",
          video: "/explore/video/a34c15f615e7.mp4",
          prompt:
            "A young skateboarder in a black t-shirt and baggy jeans performs tricks at a brutalist concrete skatepark on a sunny afternoon. The camera alternates between a fisheye lens ground-level POV following ",
          author: "modular_pufferfish_swift82",
          avatar: "/explore/c05ce4bd14b5.webp",
          likes: "625",
        },
        {
          aspect: 1.7778,
          img: "/explore/d5973163d9ba.webp",
          video: "/explore/video/8ba914cbb09a.mp4",
          prompt:
            "A sinister porcelain doll with pink hair moves through a dark apartment as an eerie orange glow intensifies from an adjacent doorway. The camera follows from a low angle as the doll walks toward the b",
          author: "romantic_grappe",
          avatar: "/explore/c05ce4bd14b5.webp",
          likes: "283",
        },
        {
          aspect: 1.7778,
          img: "/explore/042d6e332257.webp",
          video: "/explore/video/9dc5cdde34ca.mp4",
          prompt:
            "An anthropomorphic orange tabby cat warrior in green leather armor dashes across a stone bridge in a medieval fantasy alleyway bathed in purple fog. A snarling dark wolf-like creature lunges at her fr",
          author: "steampunk_donut_jade65",
          avatar: "/explore/c05ce4bd14b5.webp",
          likes: "291",
        },
      ],
      [
        {
          aspect: 1.7778,
          img: "/explore/4b871f940960.webp",
          video: "/explore/video/18ad46d06ca6.mp4",
          prompt:
            "A young woman with long rainbow-colored hair (blue, green, pink gradient) stands in the middle of a massive outdoor music festival crowd. She drinks from a can as colored laser beams sweep through haz",
          author: "sketching_manatee_peak94",
          avatar: "/explore/c05ce4bd14b5.webp",
          likes: "562",
        },
        {
          aspect: 1.7778,
          img: "/explore/91a313a414ee.webp",
          video: "/explore/video/e81555920f59.mp4",
          prompt:
            "A static wide shot of a weathered New York City tenement building facade. Graffiti-covered shuttered storefronts line the ground level, rusted fire escapes zigzag up the brick face. The camera holds s",
          author: "rococo_pen",
          avatar: "/explore/c05ce4bd14b5.webp",
          likes: "300",
        },
        {
          aspect: 1.7778,
          img: "/explore/fb32d24ea86a.webp",
          video: "/explore/video/d1c3160b5be7.mp4",
          prompt:
            "A woman in flowing dark crimson and gold fantasy robes stands in an ancient stone courtyard surrounded by gnarled trees. She summons swirling tendrils of orange fire from her hands, the flames spirali",
          author: "atompunk_cupcake_aero96",
          avatar: "/explore/c05ce4bd14b5.webp",
          likes: "495",
        },
      ],
      [
        {
          aspect: 1.7778,
          img: "/explore/9242e6432af9.webp",
          video: "/explore/video/20e11c159a28.mp4",
          prompt:
            "A man in a tailored navy blue suit washes his hands in a sleek modern bathroom, staring at his reflection in a large mirror. Another man in a matching suit appears behind him and they engage in a brut",
          author: "almasyan",
          avatar: "/explore/a47214a83847.webp",
          likes: "856",
        },
        {
          aspect: 1.7778,
          img: "/explore/be3cf49e0450.webp",
          video: "/explore/video/9aa76490c7c5.mp4",
          prompt:
            "A creepy antique porcelain doll with pink pigtails and a dark dress stands motionless on a table in the center of a dark abandoned apartment. Flames flicker from a small fire nearby, casting dancing o",
          author: "crafting_capybara_live88",
          avatar: "/explore/c05ce4bd14b5.webp",
          likes: "218",
        },
        {
          aspect: 1.7778,
          img: "/explore/d0d2391f9c31.webp",
          video: "/explore/video/77d4822d8bcd.mp4",
          prompt:
            "A woman in business attire strides through a deserted modern open-plan office with glass partitions. She trips and falls to the floor, scattering papers and her phone. A man in a grey suit rushes over",
          author: "parametric_llama_swift35",
          avatar: "/explore/c05ce4bd14b5.webp",
          likes: "302",
        },
      ],
      [
        {
          aspect: 1.7778,
          img: "/explore/bcb60b68963f.webp",
          video: "/explore/video/c6d6ab7ed376.mp4",
          prompt:
            "A white semi-truck hauling a large cargo container barrels down a sunlit highway, kicking up dust. The camera tracks it from a low front angle as it veers and collides violently with another vehicle, ",
          author: "quantized_porcupine",
          avatar: "/explore/c05ce4bd14b5.webp",
          likes: "330",
        },
        {
          aspect: 1.7778,
          img: "/explore/4f783e2acafc.webp",
          video: "/explore/video/e6ee6b48db23.mp4",
          prompt:
            "Continuation of a dramatic slow-motion crash sequence: a red-haired woman in a green jacket tumbles through the interior of a wrecked jewelry shop as a car plows through the storefront behind her. She",
          author: "institutional_butterflying",
          avatar: "/explore/c05ce4bd14b5.webp",
          likes: "425",
        },
        {
          aspect: 1.7778,
          img: "/explore/4647f19accf4.webp",
          video: "/explore/video/9686cc699213.mp4",
          prompt:
            "Close-up selfie-style POV of a red-haired young woman with medieval metal shoulder armor and massive feathered wings flying high above a mountainous green landscape. She looks into the camera with an ",
          author: "zhanay",
          avatar: "/explore/f6c1553de047.webp",
          likes: "297",
        },
      ],
    ],
  },
  {
    id: "soul-cinema-community",
    title: "RaisAI Soul Cinema",
    href: "/soul-cinema-community",
    subtitle:
      "Explore RaisAI Community gallery for stunning RaisAI Soul Cinema creations.",
    viewAll: {
      href: "/soul-cinema-community",
      label: "View all of RaisAI Soul Cinema",
    },
    columns: [
      [
        {
          aspect: 1.7778,
          img: "/explore/9419ce5f050a.webp",
          video: null,
          prompt:
            '{"silteme": "zxcv", "Caption": "Night. Three statuesque models \\u2014 apparent mixed West African / Afro-Caribbean women, deep brown skin tones \\u2014 stride down a fog-drenched city avenue in exagger',
          author: "institutional_butterflying",
          avatar: "/explore/c05ce4bd14b5.webp",
          likes: "262",
        },
        {
          aspect: 1.7778,
          img: "/explore/ede832733de6.webp",
          video: null,
          prompt:
            '{"Caption": "A late-afternoon slice of quiet: a young woman leans against a tree in deep shade, legs outstretched, absorbed in a book while warm sunlight filters through a leafy canopy and paints dapp',
          author: "aibek_zh",
          avatar: "/explore/c05ce4bd14b5.webp",
          likes: "386",
        },
        {
          aspect: 1.7778,
          img: "/explore/13125d56b660.webp",
          video: null,
          prompt:
            '{"silteme": "zxcv", "Caption": "Night. Three lone warriors hang suspended above a ruined industrial arena as a cold searchlight slices through dust \\u2014 a young woman of East Asian appearance with f',
          author: "transforming_cupcake_zero12",
          avatar: "/explore/c05ce4bd14b5.webp",
          likes: "106",
        },
      ],
      [
        {
          aspect: 1.7778,
          img: "/explore/1d107bd24e48.webp",
          video: null,
          prompt:
            '{"silteme": "zxcv", "Caption": "A cold, rain-slicked morning: from inside a dark concrete tunnel we watch a young man, 20 years old, Black with deep brown skin, stand at the tunnel mouth pointing towa',
          author: "piffle_jack",
          avatar: "/explore/68fae746df18.webp",
          likes: "339",
        },
        {
          aspect: 1.7778,
          img: "/explore/f593c1b909ce.webp",
          video: null,
          prompt:
            '{"silteme": "zxcv", "Caption": "A young woman, 20 years old, with warm olive skin and Mediterranean appearance sits astride a scaled dragon on a glittering volcanic ridge; she faces a vast violet sky ',
          author: "daulett",
          avatar: "/explore/add4f5b7db91.webp",
          likes: "182",
        },
        {
          aspect: 1.7778,
          img: "/explore/94ea2ec5efb7.webp",
          video: null,
          prompt:
            '{"silteme": "zxcv", "Caption": "A quiet, cinematic moment on a rain-slick pedestrian overpass at night: two young adults (both 20 years old), East Asian with light/fair skin tones, sit on opposite sid',
          author: "adapting_potato_keen39",
          avatar: "/explore/c05ce4bd14b5.webp",
          likes: "233",
        },
      ],
      [
        {
          aspect: 1.7778,
          img: "/explore/61a5e328336f.webp",
          video: null,
          prompt:
            '{"silteme": "zxcv", "Caption": "A lone young woman, 20 years old and of East Asian appearance with fair skin, spins in a dim rehearsal room as a ghostly double overlaps her\\u2014one figure caught in p',
          author: "crafting_capybara_live88",
          avatar: "/explore/c05ce4bd14b5.webp",
          likes: "213",
        },
        {
          aspect: 1.7778,
          img: "/explore/dcd0f63b67b1.webp",
          video: null,
          prompt:
            '{"silteme": "zxcv", "Caption": "A solitary young woman, 20 years old, Caucasian with fair skin, stands framed in a moonlit courtyard doorway; the camera watches her in a single, silent beat \\u2014 her',
          author: "cooking_orangutan",
          avatar: "/explore/c05ce4bd14b5.webp",
          likes: "194",
        },
        {
          aspect: 1.7778,
          img: "/explore/3a01aa45cde6.webp",
          video: null,
          prompt:
            '{"silteme": "zxcv", "Caption": "A close, reverent frame lingers on a young woman, twenty years old, of East Asian appearance with warm ivory skin, as she balances on a single satin-pink ballet slippe',
          author: "qwerty_322",
          avatar: "/explore/c05ce4bd14b5.webp",
          likes: "207",
        },
      ],
      [
        {
          aspect: 1.7778,
          img: "/explore/24d4aa31d416.webp",
          video: null,
          prompt:
            '{"silteme": "zxcv", "Caption": "A young woman, 20 years old, of apparent Northern European ethnicity with fair, cool-toned skin, sits alone at a white grand piano beneath a dripping crystal chandelier',
          author: "madi_k",
          avatar: "/explore/79f9e68d714a.webp",
          likes: "185",
        },
        {
          aspect: 1.7778,
          img: "/explore/f47c639b1862.webp",
          video: null,
          prompt:
            '{"silteme": "zxcv", "Caption": "A 20-year-old Northern European woman with warm fair skin sits poised atop a scaled dragon, the camera holding on a single, breath-steady moment as neon-green motes dri',
          author: "laplacetiger_haze75",
          avatar: "/explore/c05ce4bd14b5.webp",
          likes: "118",
        },
        {
          aspect: 1.7778,
          img: "/explore/04fb6d3bbee9.webp",
          video: null,
          prompt:
            '{"silteme": "zxcv", "Caption": "A rain-slicked Tokyo side-street trembles as a surreal leviathan \\u2014 a hulking, billboard-top creature with dangling limbs and a mossy, billboard head \\u2014 drifts ',
          author: "dankol",
          avatar: "/explore/e705c6012238.webp",
          likes: "191",
        },
      ],
    ],
  },
  {
    id: "soul-community",
    title: "RaisAI Soul 2.0",
    href: "/soul-community",
    subtitle:
      "A culture-native photo model built for fashion, aesthetics, and creative expression.",
    viewAll: { href: "/soul-community", label: "View all of RaisAI Soul 2.0" },
    columns: [
      [
        {
          aspect: 0.75,
          img: "/explore/84bbad079c21.webp",
          video: null,
          prompt:
            "A straight-on medium shot captures a handmade jellyfish-shaped lamp sitting on a light green tabletop, against a cluttered indoor background. The lamp features a textured blue fabric shade with intric",
          author: "zhanay",
          avatar: "/explore/f6c1553de047.webp",
          likes: "351",
        },
        {
          aspect: 0.75,
          img: "/explore/18f2d275ba66.webp",
          video: null,
          prompt:
            "A high-angle, full-body fashion editorial photograph of a young adult South Asian woman with medium brown skin and exceptionally long, thick dark hair tumbling naturally out behind her head, lying fac",
          author: "young_drill",
          avatar: "/explore/c05ce4bd14b5.webp",
          likes: "497",
        },
        {
          aspect: 0.75,
          img: "/explore/8f3f44ae9da4.webp",
          video: null,
          prompt:
            "A straight-on, recumbent close-up of a young woman with lustrous, porcelain skin, her head turned delicately towards camera as her hand rest gently atop her collarbone, providing a subtle framing of t",
          author: "wer",
          avatar: "/explore/8e32c676527c.webp",
          likes: "309",
        },
      ],
      [
        {
          aspect: 1.3333,
          img: "/explore/de91ef0d3452.webp",
          video: null,
          prompt:
            "A low-angle full-body shot captures a young adult female-presenting subject, approximately in her early 20s, with extremely pale, porcelain skin and very light, platinum-blond hair—features suggesting",
          author: "wer",
          avatar: "/explore/8e32c676527c.webp",
          likes: "625",
        },
        {
          aspect: 0.75,
          img: "/explore/7ec95aa5c454.webp",
          video: null,
          prompt:
            "A low-angle medium shot captures a young adult Caucasian woman standing in a snowy mountainous landscape. She is wearing a textured ensemble featuring a brown cable-knit jacket over a faux fur coat, w",
          author: "wer",
          avatar: "/explore/8e32c676527c.webp",
          likes: "621",
        },
        {
          aspect: 1.3333,
          img: "/explore/43dcdd7fb888.webp",
          video: null,
          prompt:
            "A high-angle shot captures the view of an open notebook placed on a wooden table, with a focus on a black ink sketch of a man's face on the right page. The left page features a weekly planner with han",
          author: "jighit",
          avatar: "/explore/95f34c1e3ae5.webp",
          likes: "252",
        },
      ],
      [
        {
          aspect: 0.75,
          img: "/explore/a08f35bad312.webp",
          video: null,
          prompt:
            "A medium shot captures a young Asian woman in a stylized outfit, standing against a textured, weathered wall. She wears a form-fitted, light denim corset with dark accents and oversized metallic gromm",
          author: "qwerty_322",
          avatar: "/explore/c05ce4bd14b5.webp",
          likes: "899",
        },
        {
          aspect: 0.75,
          img: "/explore/3dfcc8818b05.webp",
          video: null,
          prompt:
            "A straight-on, eye-level medium shot frames two young women reclining outdoors before a traditional, off-white wood-paneled home in what appears to be a contemporary documentary fashion photograph. Th",
          author: "young_drill",
          avatar: "/explore/c05ce4bd14b5.webp",
          likes: "335",
        },
        {
          aspect: 0.75,
          img: "/explore/a67fb518841a.webp",
          video: null,
          prompt:
            "Close-up overhead shot of a young woman, showing only the lower half of her body. She wears a monochromatic pastel blue outfit: a knit sleeveless top paired with a matching flowing skirt, and textured",
          author: "zhanay",
          avatar: "/explore/f6c1553de047.webp",
          likes: "255",
        },
      ],
      [
        {
          aspect: 0.75,
          img: "/explore/2eb58b6e7460.webp",
          video: null,
          prompt:
            "Close-up side profile of a young man, seated at an outdoor café table, wearing a white oversized sweatshirt and a yellow knitted beanie, holding a bright blue ceramic mug raised to his lips. Expressio",
          author: "young_drill",
          avatar: "/explore/2eb58b6e7460.webp",
          likes: "785",
        },
        {
          aspect: 0.75,
          img: "/explore/c5be4502b2db.webp",
          video: null,
          prompt:
            "A straight-on view of a mixed-media artwork featuring a weathered, vintage aesthetic. At the center, a heart-shaped object with a floral pattern acts as a focal point, surrounded by an array of metall",
          author: "gradient_tomatos",
          avatar: "/explore/c05ce4bd14b5.webp",
          likes: "211",
        },
        {
          aspect: 0.75,
          img: "/explore/54b708eadb12.webp",
          video: null,
          prompt:
            "A high-angle, two-frame composite featuring a young woman with long blonde hair and fair skin, relaxed on concrete steps within an industrial stairwell. She wears a fitted khaki tank top, olive camouf",
          author: "jighit",
          avatar: "/explore/95f34c1e3ae5.webp",
          likes: "491",
        },
      ],
    ],
  },
];
export const PROJECTS = {
  title: "Explore the inside of every project",
  subtitle: "See all prompts, assets, and how each project was created",
  items: [
    {
      href: "/@higgsfield.studio/projects/if-you-stop-loving-me-ill-die",
      name: "If you stop loving me, I'll die — I don't like dying, but for our love I'm ready to go that far",
      author: "raisai.studio",
      img: "/explore/cc7536d50458.webp",
    },
    {
      href: "/@higgsfield.studio/projects/cully-hill-boys",
      name: "Cully Hill Boys",
      author: "raisai.studio",
      img: "/explore/137520204eab.webp",
    },
    {
      href: "/@higgsfield.studio/projects/red-flag",
      name: "Red Flag",
      author: "raisai.studio",
      img: "/explore/a71271bc1e15.webp",
    },
    {
      href: "/@higgsfield.studio/projects/kok-boru-film",
      name: "Kok Boru",
      author: "raisai.studio",
      img: "/explore/dce9d922d137.webp",
    },
    {
      href: "/@higgsfield.studio/projects/adiliada",
      name: "Adiliada",
      author: "raisai.studio",
      img: "/explore/25351406f67e.webp",
    },
    {
      href: "/@higgsfield.studio/projects/oneiric",
      name: "ONEIRIC",
      author: "raisai.studio",
      img: "/explore/b69c3967a99c.webp",
    },
    {
      href: "/@higgsfield.studio/projects/zephyr-special",
      name: "ZEPHYR: Special",
      author: "raisai.studio",
      img: "/explore/29117c8f9df8.webp",
    },
    {
      href: "/@higgsfield.studio/projects/hell-grind",
      name: "HELL GRIND",
      author: "raisai.studio",
      img: "/explore/fbabf4a1d32d.webp",
    },
  ],
  viewAll: { href: "/templates?scope=public", label: "Explore community" },
};
export const EXPLORE_MORE: LinkItem[] = [
  { href: "/cinematic-video-generator", label: "Cinema Studio" },
  { href: "/create/video", label: "Visual Effects" },
  { href: "/create/image?model=soul", label: "RaisAI Soul" },
  { href: "/create/video?model=kling-v2-1-master", label: "Kling 2.1 Master" },
  { href: "/create/video", label: "Camera Controls" },
  { href: "/create/video", label: "Viral" },
  { href: "/create/video", label: "Action movements" },
  { href: "/create/video", label: "Commercial" },
  { href: "/create/video?model=minimax", label: "MiniMax Hailuo 02" },
  { href: "/create/video?model=seedance_pro", label: "Seedance Pro" },
  { href: "/templates?scope=public", label: "Community" },
  { href: "/create/image?model=wan2-2", label: "Wan 2.2 Image" },
  { href: "/create/image?model=seedream", label: "Seedream 4.0" },
  { href: "/create/image?model=nano_banana", label: "Nano Banana" },
  { href: "/create/image?model=kontext", label: "Flux Kontext" },
  { href: "/create/image?model=gpt", label: "GPT Image" },
  { href: "/create/studio/ai.upscale", label: "Topaz" },
  { href: "/create/video?model=veo-3-preview", label: "Google Veo3" },
  { href: "/create/video?model=kling-v2-5-turbo", label: "Kling 2.5 Turbo" },
  { href: "/lipsync-studio", label: "Kling Avatars 2.0" },
  { href: "/claude-ai-video-generator", label: "Claude MCP" },
  { href: "/wan-ai-video", label: "Wan 2.5" },
  { href: "/sora-2", label: "Sora 2" },
  { href: "/sora-2-ai-video-presets", label: "Sora 2 Presets" },
  { href: "/create/image?model=nano_banana", label: "Banana Placement" },
  { href: "/edit?model=nano_banana_pro_inpaint", label: "Edit Image" },
  { href: "/character", label: "Multi Reference" },
  { href: "/create/studio/ai.upscale", label: "Upscale" },
  { href: "/ai-assist", label: "Assists" },
  { href: "/sora-2-youtube", label: "YouTube" },
  { href: "/sora-2-tiktok", label: "TikTok" },
  { href: "/sora-2-reels", label: "Instagram Reels" },
  { href: "/sora-2-shorts", label: "YouTube Shorts" },
  { href: "/create/image?model=nano-banana-pro", label: "Nano Banana Pro" },
  { href: "/kling-3.0", label: "Kling o1" },
  { href: "/mixed-media-community", label: "Mixed Media Community" },
  { href: "/soul", label: "Soul Presets" },
  { href: "/collection/effects", label: "Visual Effects Collection" },
];
export const FOOTER_COLUMNS: { heading: string; links: LinkItem[] }[] = [
  {
    heading: "Create",
    links: [
      { href: "/ai-video", label: "AI Video" },
      { href: "/ai-image", label: "AI Image" },
      { href: "/edit?model=nano_banana_pro_inpaint", label: "Edit Image" },
      { href: "/image-editing", label: "Inpaint" },
      { href: "/create/studio/ai.upscale", label: "Upscale" },
      { href: "/sora-2-upscale", label: "Sora 2 Upscale" },
      { href: "/mixed-media-intro", label: "Mixed Media" },
      { href: "/apps/face-swap", label: "AI Face Swap" },
      { href: "/ai-influencer", label: "AI Influencer" },
      { href: "/apps", label: "Apps" },
    ],
  },
  {
    heading: "Video Models",
    links: [
      { href: "/seedance/2.5", label: "Seedance 2.5" },
      { href: "/seedance/2.0", label: "Seedance 2.0" },
      { href: "/kling-3.0", label: "Kling 3.0" },
      { href: "/sora-2", label: "Sora 2 Introduction" },
      { href: "/veo3.1", label: "Veo 3.1 Introduction" },
      { href: "/wan-2.6", label: "WAN 2.6" },
      { href: "/grok-imagine-1.5", label: "Grok Imagine 1.5" },
      { href: "/gemini-omni-flash", label: "Gemini Omni Flash" },
    ],
  },
  {
    heading: "Image Models",
    links: [
      { href: "/nano-banana-intro", label: "Nano Banana" },
      { href: "/flux-2-intro", label: "Flux 2" },
      { href: "/seedream-5.0", label: "Seedream 5" },
      { href: "/gpt-2", label: "GPT Image 2" },
    ],
  },
  {
    heading: "Studios",
    links: [
      { href: "/cinematic-video-generator", label: "Cinema Studio" },
      { href: "/marketing-studio-intro", label: "Marketing Studio" },
      { href: "/lipsync-studio", label: "Lipsync Studio" },
      { href: "/photodump-studio", label: "Photodump Studio" },
      { href: "/fashion-factory", label: "Fashion Factory" },
      { href: "/ugc-factory", label: "UGC Factory" },
      { href: "/storyboard-generator", label: "RaisAI Popcorn" },
      { href: "/canvas", label: "RaisAI Canvas" },
    ],
  },
  {
    heading: "Soul",
    links: [
      { href: "/soul-intro", label: "Soul 2.0" },
      { href: "/character", label: "Soul ID Character" },
      { href: "/soul-cinema", label: "Soul Cinema" },
    ],
  },
  {
    heading: "Platform",
    links: [
      { href: "/supercomputer-intro", label: "Supercomputer" },
      { href: "/developer/mcp", label: "MCP/CLI" },
      { href: "/chat-intro", label: "Collab" },
      { href: "/games-intro", label: "Games" },
      { href: "/ai-assist", label: "AI Assist" },
      {
        href: "https://chromewebstore.google.com/detail/higgsfield-reference/oohmjaflbknghbidmaoonmchcodhmkgj",
        label: "Reference Extension",
      },
    ],
  },
  {
    heading: "Resources",
    links: [
      { href: "/blog", label: "Blog" },
      { href: "/creator-hub", label: "Creator Hub" },
      { href: "/creator-hub/help-center", label: "Help Center" },
      { href: "/academy", label: "Academy" },
      { href: "/nano-banana-pro-prompt-guide", label: "Prompt Guide" },
    ],
  },
  {
    heading: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/trust", label: "Trust" },
      { href: "/enterprise", label: "Enterprise" },
      { href: "/team-plan", label: "Team" },
      { href: "/pricing", label: "Pricing" },
      { href: "https://jobs.ashbyhq.com/higgsfieldai", label: "Careers" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    heading: "Community",
    links: [
      { href: "/templates?scope=public", label: "Community" },
      { href: "/contests", label: "Contests" },
    ],
  },
];
export const STATIC = {
  mcpBg: "/explore/707d26594d66.png",
  spcBg: "/explore/42f8158b9ee0.png",
  spcLogo: "/explore/fbf0711fce1d.png",
  spcCreative: "/explore/d6d97529715d.png",
  spcVisualizing: "/explore/b8bdecc83f07.png",
  spcMarketing: "/explore/72de20f5c9b1.png",
  spcProduction: "/explore/e8c878ca1991.png",
  canvasBg: "/explore/c700199459db.webp",
  canvasArt: "/explore/05cea2d4ccdd.webp",
  canvasBgMobile: "/explore/f56b2f0a099c.webp",
  canvasArtMobile: "/explore/05cea2d4ccdd.webp",
  photodumpDesktop: "/explore/4b4c61bfd907.png",
  photodumpMobile: "/explore/e9aa2cc63187.png",
};
