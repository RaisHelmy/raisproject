/**
 * Content for the Plugins, Contests and Cinema Studio pages, taken from the
 * reference site. Media lives under public/pages.
 */
export interface PluginInfo {
  slug: string;
  tab: string;
  name: string;
  sub: string;
  logo: string | null;
}
export interface Film {
  title: string;
  author: string;
  img: string;
}
export interface ProjectCard {
  title: string;
  img: string;
  views: string;
  likes: string;
}

export const PLUGINS: PluginInfo[] = [
  {
    slug: "photoshop",
    tab: "Photoshop",
    name: "Adobe Photoshop",
    sub: "AI photo tools inside Photoshop",
    logo: "/pages/e7a29a99a6c0.svg",
  },
  {
    slug: "after-effects",
    tab: "After Effects",
    name: "Adobe After Effects",
    sub: "AI video tools inside After Effects",
    logo: "/pages/5009122c860c.svg",
  },
  {
    slug: "premiere-pro",
    tab: "Premiere Pro",
    name: "Adobe Premiere Pro",
    sub: "AI video tools inside Premiere Pro",
    logo: "/pages/40665354556a.svg",
  },
  {
    slug: "davinci",
    tab: "DaVinci Resolve",
    name: "DaVinci Resolve",
    sub: "AI video tools inside DaVinci Resolve",
    logo: "/pages/a626dbace600.svg",
  },
  {
    slug: "figma",
    tab: "Figma",
    name: "Figma",
    sub: "AI image & video tools inside Figma",
    logo: "/pages/91133bb52b14.webp",
  },
  {
    slug: "blender",
    tab: "Blender",
    name: "Blender",
    sub: "AI image & video tools inside Blender",
    logo: "/pages/8ab4a1fd2bc3.svg",
  },
  {
    slug: "minecraft",
    tab: "Minecraft",
    name: "Minecraft",
    sub: "AI generation tools inside Minecraft",
    logo: null,
  },
];
export const PLUGIN_HERO: string | null = "/pages/7169a9de1346.mp4";
export const PLUGIN_STEPS = [
  {
    n: "1",
    title: "Download the installer",
    body: "One installer covers every RaisAI plugin. Pick your host app and go.",
  },
  {
    n: "2",
    title: "Sign in once",
    body: "Your balance, models and library come with you into the host app.",
  },
  {
    n: "3",
    title: "Generate in place",
    body: "Create, edit and upscale on the layer or clip you already have open.",
  },
];

export const CONTEST = {
  breadcrumb: "Contests",
  name: "RaisAI Festival",
  tabs: ["General", "Timeline", "Rules", "Create in public"],
  badges: ["Optional", "Part of the Global Film Festival"],
  title: "Create in public",
  body: "Build your film in public — up to 50 most community supported films go straight to the jury's shortlist. Standout projects also get credit grants from the RaisAI team to finish stronger.",
  cta: "Learn more",
};
export const FILMS: Film[] = [
  {
    title: "Detour",
    author: "@aist",
    img: "/pages/d9ca56482920.webp",
  },
  {
    title: "The Zero Slasher",
    author: "@zerotohero",
    img: "/pages/5fb95cbb932c.webp",
  },
  {
    title: "Fallen Leaves",
    author: "@jacob_everett",
    img: "/pages/f32d3e756eb7.webp",
  },
  {
    title: "The Tortoise and the Hare",
    author: "@benhamin",
    img: "/pages/40780bfc58a1.webp",
  },
  {
    title: "VARMINTS: Las Bodas Del Rio",
    author: "@outrealproduction",
    img: "/pages/8e4c8019e4e0.webp",
  },
  {
    title: "APEIROPHOBIA",
    author: "@seksifratello",
    img: "/pages/9404a566b308.webp",
  },
  {
    title: "Buzkashi",
    author: "@sqr_studio",
    img: "/pages/57a7686bc394.webp",
  },
  {
    title: "BALLAST",
    author: "@lejardinier",
    img: "/pages/de03a22e5d14.webp",
  },
  {
    title: "CONTROL",
    author: "@pietromalegori",
    img: "/pages/de126fe275fe.webp",
  },
  {
    title: "AZUL COBALTO",
    author: "@seeyousoonx",
    img: "/pages/e40412993c06.webp",
  },
  {
    title: "In a Minute",
    author: "@dontcallmepapi",
    img: "/pages/3929610172dc.webp",
  },
  {
    title: "To live Another Morning",
    author: "@shox_digital",
    img: "/pages/1eb255d37414.webp",
  },
];

export const CINEMA_NAV = [
  { label: "Home", icon: "home" },
  { label: "My elements", icon: "elements" },
  { label: "My favorites", icon: "heart" },
  { label: "Community", icon: "community" },
  { label: "Academy", icon: "academy" },
];
export const CINEMA_CARDS: ProjectCard[] = [
  {
    title: "The Trigger",
    img: "/pages/cc6c8b12ef1e.webp",
    views: "80.8K",
    likes: "858",
  },
  {
    title: "Red Flag",
    img: "/pages/a71271bc1e15.webp",
    views: "43.6K",
    likes: "346",
  },
  {
    title: "Kok Boru",
    img: "/pages/dce9d922d137.webp",
    views: "48.1K",
    likes: "560",
  },
  {
    title: "ONEIRIC",
    img: "/pages/b69c3967a99c.webp",
    views: "105.3K",
    likes: "807",
  },
  {
    title: "ZEPHYR: Special",
    img: "/pages/29117c8f9df8.webp",
    views: "87.9K",
    likes: "613",
  },
  {
    title: "Adiliada",
    img: "/pages/25351406f67e.webp",
    views: "62.5K",
    likes: "428",
  },
  {
    title: "Cully Hill Boys",
    img: "/pages/137520204eab.webp",
    views: "200.1K",
    likes: "1,131",
  },
];
