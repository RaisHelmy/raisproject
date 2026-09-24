/**
 * Community page content, taken from the reference community page. Media
 * lives under public/community; swap it for your own later.
 */
export interface ProjectCard {
  title: string;
  author: string;
  authorHref: string;
  img: string;
  likes: string;
  views: string;
}
export interface ShotCard {
  img: string;
  author: string;
  alt: string;
}

export const TABS = [
  { label: "Explore", href: "/community" },
  { label: "Projects", href: "/community/projects" },
  { label: "Shots", href: "/community/generations" },
  { label: "Originals", href: "/community/originals" },
];

export const HERO = {
  pill: "Contest is live",
  amount: "$1,000,000",
  title: "Global Film Festival",
  sub: "Any story. Any genre. Make your film in RaisAI. Fourteen winners, a million dollars.",
  dates: "Jul 14 — Sep 14",
  cta: "Join the festival",
  href: "/contests",
  video: "/community/4c17a5611279.mp4",
};

export const PROJECTS: ProjectCard[] = [
  {
    title: "The Patch",
    author: "VJ",
    authorHref: "/@zhit",
    img: "/community/4a64cf1285fd.png",
    likes: "314",
    views: "21.2K",
  },
  {
    title: "Ultra Realistic AI Short Film Breakdown",
    author: "Adil Alimzhanov",
    authorHref: "/@adilinthewild",
    img: "/community/66571babb65c.png",
    likes: "148",
    views: "30K",
  },
  {
    title: "CHANDLER-ROLLERBLADE-COMMERCIAL",
    author: "Thomas LundstrÃ¶m",
    authorHref: "/@thomas_lundstrom",
    img: "/community/2634c7d178fe.jpg",
    likes: "125",
    views: "7.1K",
  },
  {
    title: "Fallen Leaves",
    author: "Jacob Everett",
    authorHref: "/@jacob_everett",
    img: "/community/87eb6faa2c1c.jpg",
    likes: "298",
    views: "69.7K",
  },
  {
    title: "The Pardon Games",
    author: "christopher glenka",
    authorHref: "/@disruptorcreatorc",
    img: "/community/702861cdc305.jpg",
    likes: "41",
    views: "270",
  },
  {
    title: "The Prompter",
    author: "Allan Ripley",
    authorHref: "/@allan_ripley",
    img: "/community/21b4f7490cb5.png",
    likes: "233",
    views: "25.7K",
  },
  {
    title: '"Top Up" Cinematic AD Breakdown',
    author: "Adil Alimzhanov",
    authorHref: "/@adilinthewild",
    img: "/community/66571babb65c.png",
    likes: "106",
    views: "18K",
  },
  {
    title: "Voices in the Void: Hollow Heart",
    author: "Man-Aye",
    authorHref: "/@man-aye",
    img: "/community/aff1b626b6b9.png",
    likes: "83",
    views: "1.2K",
  },
  {
    title: "SEEDANCE 2 FRAGRANCE COMMERCIAL",
    author: "Thomas LundstrÃ¶m",
    authorHref: "/@thomas_lundstrom",
    img: "/community/2634c7d178fe.jpg",
    likes: "91",
    views: "5.8K",
  },
  {
    title: "The Sea Calls",
    author: "Mohamed Mourid",
    authorHref: "/@mourid",
    img: "/community/a2533ab6d41b.jpg",
    likes: "66",
    views: "3.1K",
  },
  {
    title: "AZUL COBALTO",
    author: "Tomas Pena",
    authorHref: "/@seeyousoonx",
    img: "/community/0d740ab4d9e0.png",
    likes: "310",
    views: "138.3K",
  },
  {
    title: "THE THREAD",
    author: "Evgeny Stadolnik",
    authorHref: "/@stadolnikstudio",
    img: "/community/56431e2c3ea1.png",
    likes: "157",
    views: "2.8K",
  },
];

export const SHOTS: ShotCard[] = [
  {
    img: "/community/f30a3f12de34.webp",
    author: "mysteriom_ludwig",
    alt: "Generation by @mysteriom_ludwig",
  },
  {
    img: "/community/a622849ee3bd.webp",
    author: "mysteriom_ludwig",
    alt: "",
  },
  {
    img: "/community/15503e601c98.webp",
    author: "kobal",
    alt: "Generation by @kobal",
  },
  {
    img: "/community/da8e341b9c00.webp",
    author: "kobal",
    alt: "",
  },
  {
    img: "/community/e4aa8d7bd5b6.webp",
    author: "arjun_asokan",
    alt: "Generation by @arjun_asokan",
  },
  {
    img: "/community/88eb9c687cbd.webp",
    author: "arjun_asokan",
    alt: "",
  },
  {
    img: "/community/ca375030e89d.webp",
    author: "thevanillababy",
    alt: "Generation by @thevanillababy",
  },
  {
    img: "/community/e0c902899ce0.webp",
    author: "thevanillababy",
    alt: "",
  },
  {
    img: "/community/ed88d323e833.webp",
    author: "voule",
    alt: "Generation by @voule",
  },
  {
    img: "/community/54cc17ea8050.png",
    author: "voule",
    alt: "",
  },
  {
    img: "/community/45ee399d1e0d.webp",
    author: "arjun_asokan",
    alt: "Generation by @arjun_asokan",
  },
  {
    img: "/community/c8eb1a35275b.webp",
    author: "valderway",
    alt: "Generation by @valderway",
  },
  {
    img: "/community/ae66e6beaf6a.webp",
    author: "valderway",
    alt: "",
  },
  {
    img: "/community/b4a7c2a64adc.webp",
    author: "arjun_asokan",
    alt: "Generation by @arjun_asokan",
  },
  {
    img: "/community/7df6071e7b9b.webp",
    author: "arjun_asokan",
    alt: "Generation by @arjun_asokan",
  },
  {
    img: "/community/7f5cda4b8126.webp",
    author: "sustainablecamel1377",
    alt: "Generation by @sustainablecamel1377",
  },
  {
    img: "/community/57ec26ea5877.webp",
    author: "vibingcookie1508",
    alt: "Generation by @vibingcookie1508",
  },
  {
    img: "/community/6e199b7bd6f2.webp",
    author: "mendelflamingo1758",
    alt: "Generation by @mendelflamingo1758",
  },
  {
    img: "/community/1ffda30c64ec.webp",
    author: "arjun_asokan",
    alt: "Generation by @arjun_asokan",
  },
  {
    img: "/community/f6a9c8ff1de6.webp",
    author: "mendelflamingo1758",
    alt: "Generation by @mendelflamingo1758",
  },
  {
    img: "/community/5bc5d1da8419.webp",
    author: "mysteriom_ludwig",
    alt: "Generation by @mysteriom_ludwig",
  },
  {
    img: "/community/b94a6f88c919.webp",
    author: "romanesqueelephant1714",
    alt: "Generation by @romanesqueelephant1714",
  },
  {
    img: "/community/21aa40f07406.webp",
    author: "romanesqueelephant1714",
    alt: "",
  },
  {
    img: "/community/da087f0a9147.webp",
    author: "glitchcoffee1674",
    alt: "Generation by @glitchcoffee1674",
  },
  {
    img: "/community/bad3dec05944.webp",
    author: "arjun_asokan",
    alt: "Generation by @arjun_asokan",
  },
  {
    img: "/community/19ff8d9bcf25.webp",
    author: "mendelflamingo1758",
    alt: "Generation by @mendelflamingo1758",
  },
  {
    img: "/community/3195d320ec69.webp",
    author: "vibingcookie1508",
    alt: "Generation by @vibingcookie1508",
  },
  {
    img: "/community/12faf02695ec.webp",
    author: "kimcheeworld",
    alt: "Generation by @kimcheeworld",
  },
  {
    img: "/community/6e86e38b9ee9.webp",
    author: "kimcheeworld",
    alt: "",
  },
  {
    img: "/community/f9f0218e0073.webp",
    author: "morpheus",
    alt: "Generation by @morpheus",
  },
];
