/**
 * Data for the Enterprise, Marketing Studio and Supercomputer replicas,
 * extracted from the reference pages. Brand names in copy are RaisAI; vendor
 * and model names are left as they are. Media lives in public/pages.
 */

export interface EntClient { title: string; quote: string; bg: string; logo: string }
export interface EntFeature { title: string; desc: string; imgs: string[]; vid?: string }
export interface EntGroup { title: string; items: string[] }
export interface Faq { q: string; a: string }
export interface ScCard { title: string; kind: string; media: string; video: boolean }

export const ENTERPRISE = {
  crumb: "RaisAI.AI",
  title: "Enterprise",
  heading: "The AI-native creative suite built for enterprise",
  fortune: "390 of the Fortune 500 already work with us",
  fortuneLogo: "/pages/82b94b506ca3.png",
  purpose: "Purpose-built for the modern creative enterprise",
  purposeBody: "Get a personalized walkthrough of the platform, see real use cases, and learn how leading enterprises cut production time by 90% while saving thousands on every project.",
  cta: "Contact Sales",
  clientsTitle: "Industry-leading enterprises already on board",
  secureTitle: "Premium. Secure. Enterprise.",
  secureTabs: ["Admin & Access", "Data & Compliance", "Dedicated Support"],
  suiteTitle: "All-in-one suite with 50+ models",
  suiteBody: "Our platform includes dedicated video, image, and audio models, along with proprietary tools built for creative scaling.",
  workspaceTitle: "Enterprise-level workspace",
  academyTitle: "RaisAI Academy",
  contactTitle: "Contact our sales team",
  contactBody: "Tell us about your needs and we'll get back to you",
  contactFeatures: ["No training on your data", "50+ top video, image, and audio models in one workspace", "Easy seat, role, and credit management", "Integrations with Adobe, Figma, and more"],
  faqTitle: "Still have questions?",
  faqBody: "We’ve answered the most frequently asked questions",
  secureArt: ["/pages/32afd4af5a3a.webp", "/pages/49e096d6b65a.webp", "/pages/6c30bfff1a7c.webp"],
  workspaceArt: ["/pages/b1d67ce42c38.webp", "/pages/cce8a2ef074b.webp", "/pages/6ad63c40fc53.webp"],
  heroPoster: "/pages/ed5ca750f941.webp",
};

export const ENT_CLIENTS: EntClient[] = [
  { title: "Studio creating the most widely reached mixed reality campaigns", quote: "“RaisAI didn't just speed up production, but it accelerated the synchronization itself”", bg: "/pages/d8cf2aeb7954.webp", logo: "/pages/c54845c38f5a.webp" },
  { title: "Creative director behind Madonna and Dolce & Gabbana", quote: "\"The best response is that nobody stops to ask how it was made.\"", bg: "/pages/acb7ad14acd1.webp", logo: "/pages/5fa96d738829.webp" },
  { title: "Creative production studio behind Netflix and Hulu", quote: "“RaisAI's policies go above and beyond to protect client intellectual property”", bg: "/pages/d8e49d420b2d.webp", logo: "/pages/e3c6e13d91a0.webp" },
  { title: "Istanbul production studio behind Lacoste and SuperStep", quote: "“Most clients no longer ask whether it was made with AI. They ask whether we can deliver by Thursday.”", bg: "/pages/10ad995a7057.webp", logo: "/pages/66495f18d06a.webp" },
  { title: "The AI studio built for sports and entertainment", quote: "“Individual AI models are like instruments. A platform like RaisAI gives you the whole orchestra”", bg: "/pages/7c80d5500deb.webp", logo: "/pages/dfafee7a0a4c.webp" },
  { title: "Leading Korean creative studio", quote: "“All roads to AI generation lead to RaisAI. Now, and always.” — AdQUA Interactive", bg: "/pages/24e7937d8fa2.webp", logo: "/pages/3b1c991099f9.webp" },
];

export const ENT_FEATURES: EntFeature[] = [
  { title: "50+ Models", desc: "All-in-one suite with 50+ models.", imgs: ["/pages/32afd4af5a3a.webp", "/pages/5958501bfa75.webp"] },
  { title: "Marketing Studio", desc: "Scale your marketing output.", imgs: ["/pages/2f21327d3e32.webp", "/pages/4d307360a27c.webp", "/pages/4d307360a27c.webp", "/pages/4d307360a27c.webp"] },
  { title: "Cinema Studio", desc: "Complete solution for your production studio.", imgs: ["/pages/49e096d6b65a.webp", "/pages/68a51b2592c9.webp", "/pages/2e2d716d3327.png", "/pages/a6c09aeec60d.png"], vid: "/pages/6046576e3828.mp4" },
  { title: "MCP & CLI", desc: "Enhance your best workflows with MCP & CLI.", imgs: ["/pages/6c30bfff1a7c.webp", "/pages/604989587df3.png", "/pages/0f17a05a0196.webp", "/pages/d68e9a288ad8.webp"] },
  { title: "Agentic Engine", desc: "Design smart, develop like a pro.", imgs: ["/pages/b65109fbe0e0.webp", "/pages/29b2b9604cc6.webp"] },
  { title: "Canvas", desc: "One canvas to rule them all.", imgs: ["/pages/74f56805dd13.webp", "/pages/a9922886971e.webp"] },
  { title: "Character Studio", desc: "Create your own enterprise characters, mascots, and brand faces.", imgs: ["/pages/99eed985738c.webp", "/pages/13805f9f89b2.webp"] },
];

export const ENT_WORKSPACE: EntGroup[] = [
  { title: "Work as one team", items: ["Shared team workspace with approvals & comments", "Sub-workspaces", "Unlimited number of seats"] },
  { title: "Exclusive features", items: ["Unlimited number of seats", "10x more concurrent generations", "Dedicated capacity"] },
  { title: "Pro control over workflow", items: ["Credit pooling & allocation across teams", "Centralized billing via invoice or PO", "Extended admin controls & usage analytics", "SSO / SAML & role-based access control"] },
];

export const ENT_FAQ: Faq[] = [
  { q: "What is RaisAI Enterprise?", a: "RaisAI Enterprise is an AI video and image generation platform for business teams. It combines 50+ leading generative models in one secure workspace with SSO, role-based access control, shared credit pools, and dedicated GPU capacity — so marketing, design, and content teams can produce campaign-ready video at scale with full commercial rights." },
  { q: "Which AI models are included in RaisAI Enterprise?", a: "RaisAI Enterprise includes 50+ state-of-the-art image, video, and audio models in one subscription — including Seedance, Kling, Nano Banana Pro, GPT Image, and RaisAI's own Soul model — plus 250+ VFX presets, camera controls, and consistent characters. One workspace and one credit pool cover every model, with new models added at launch." },
  { q: "Can we use AI-generated videos commercially?", a: "Yes. Every output created in RaisAI Enterprise is cleared for commercial use — ads, product content, social media, and client work. Enterprise agreements include full IP ownership of your outputs and contract-backed indemnification, so brands and agencies can publish AI-generated video with legal confidence." },
  { q: "Does RaisAI train AI models on our data?", a: "No. RaisAI Enterprise never trains models on your data. Your prompts, uploads, brand assets, and generated content stay within your private workspace under a contractual no-train guarantee, with granular access controls — protection built for unreleased products, embargoed campaigns, and confidential client material." },
  { q: "Is RaisAI secure enough for enterprise use?", a: "Yes. RaisAI Enterprise is built to enterprise security standards: SOC 2-aligned controls, GDPR compliance, single sign-on (SSO/SAML), role-based access control, private team workspaces, and centralized user provisioning. Security documentation is available for review during procurement, and our team supports vendor security assessments." },
  { q: "How much does RaisAI Enterprise cost?", a: "RaisAI Enterprise uses credit-based pricing on annual contracts with monthly payments, sized to your team's seats and generation volume." },
  { q: "Does RaisAI integrate with our existing creative tools?", a: "Yes. RaisAI offers native plugins for Adobe Premiere Pro, After Effects, Photoshop, DaVinci Resolve, and Figma, so generations land inside the tools your team already uses. Developers and agentic workflows connect through RaisAI's MCP server and CLI, and the Supercomputer agent can automate full content pipelines end to end." },
  { q: "How quickly can our team start producing with RaisAI Enterprise?", a: "Most teams are generating within days. After signing, your workspace goes live and a dedicated AI Educator runs hands-on onboarding built around your first real project — prompt craft, camera direction, and brand workflows — with ongoing support through a private Slack channel and a dedicated account manager." },
];

export const MS_TABS = ["All", "Product shot", "Motion", "UGC", "Ads", "Posters", "Marketplace"];
export const MS_RAIL = ["Home", "My generations", "My favorites", "Ad Reference", "Product Link", "New project"];
export const MS_HEROES = ["/pages/ece2ff81c188.webp", "/pages/923bbd8005c7.webp", "/pages/4975fe822e8a.webp", "/pages/9bdd2cb8b08f.webp", "/pages/c06baafdedf8.webp", "/pages/8a2f792e42d9.webp"];
export interface MsCard { title: string; kind: string; media: string; video: boolean }
export const MS_HERO_TITLE = "Turn any product into ready to post content";
export const MS_EXPLORE_TITLE = "Explore templates";
export const MS_CARDS: MsCard[] = [
  { title: "Ice Cube Hover", kind: "Product shot", media: "/pages/506ed86bca93.webp", video: false },
  { title: "Brushed Tin", kind: "Product shot", media: "/pages/c2b6c494891d.webp", video: false },
  { title: "Green Tea Macro", kind: "Product motion", media: "/pages/1d6b6dd05f08.mp4", video: true },
  { title: "Chilled Can", kind: "Product shot", media: "/pages/9cc5a5062920.webp", video: false },
  { title: "Emerald Pajamas", kind: "Product shot", media: "/pages/624e9da849de.webp", video: false },
  { title: "Linen Lid Lift", kind: "Product shot", media: "/pages/da5777db0862.webp", video: false },
  { title: "Fisheye Jelly Balloon", kind: "Product motion", media: "/pages/94e4d8ec061f.mp4", video: true },
  { title: "Golden Dew", kind: "Product shot", media: "/pages/e1befffce015.webp", video: false },
  { title: "Sky High Chili", kind: "Product shot", media: "/pages/c0f4367aa4ce.webp", video: false },
  { title: "How-To", kind: "UGC video", media: "/pages/f123c378b2df.mp4", video: true },
  { title: "Monospace Callouts", kind: "Product motion", media: "/pages/ac09797d8f7e.mp4", video: true },
  { title: "Blue Sky Cap", kind: "Product shot", media: "/pages/7f7a36c050cd.webp", video: false },
  { title: "Glass Dunk", kind: "Product shot", media: "/pages/1fc52305846b.webp", video: false },
  { title: "Fridge Regiment", kind: "Product shot", media: "/pages/6ba17a932439.webp", video: false },
  { title: "Levitating Totem", kind: "Product shot", media: "/pages/4739e9ba9b5f.webp", video: false },
  { title: "Y2K Flip Phone", kind: "Product motion", media: "/pages/1e79b9ac97ce.mp4", video: true },
  { title: "Pedestal Balancing Act", kind: "Product shot", media: "/pages/fcd330ea4b1b.webp", video: false },
  { title: "Teal Totem", kind: "Product shot", media: "/pages/376ab8eda581.webp", video: false },
  { title: "Copper HUD", kind: "Product motion", media: "/pages/17bd68657977.mp4", video: true },
  { title: "Periwinkle Checkers", kind: "Product shot", media: "/pages/fea2610198ab.webp", video: false },
  { title: "Courtside Stash", kind: "Product shot", media: "/pages/754911339c2a.webp", video: false },
  { title: "Liquid Gold", kind: "Product motion", media: "/pages/73b140c93356.mp4", video: true },
  { title: "Lemon on Pink", kind: "Product shot", media: "/pages/3299d819aa2f.webp", video: false },
  { title: "Pink Scoop Flat Lay", kind: "Product shot", media: "/pages/12e6d8cd9f70.webp", video: false },
  { title: "Acrylic Shelf Grab", kind: "Product shot", media: "/pages/a7e1541df8b1.webp", video: false },
  { title: "Pill Stack Logo", kind: "Product motion", media: "/pages/7e4e8f9b6657.mp4", video: true },
  { title: "Crossed Hands", kind: "Product shot", media: "/pages/473031dbec17.webp", video: false },
  { title: "Ice Bed Macro", kind: "Product shot", media: "/pages/9701d62e9109.webp", video: false },
  { title: "Midnight Crown", kind: "Product shot", media: "/pages/a24d057ca55b.webp", video: false },
  { title: "Signal Red HUD", kind: "Product motion", media: "/pages/5b635ea26435.mp4", video: true },
  { title: "Bubble Bead Dopamine", kind: "Product motion", media: "/pages/26d73967b7bc.mp4", video: true },
  { title: "Ochre Recline", kind: "Product shot", media: "/pages/fd4974a75e70.webp", video: false },
  { title: "Orchard Scatter", kind: "Product shot", media: "/pages/5b6e24ee410e.webp", video: false },
  { title: "Mirror Handstand", kind: "Product shot", media: "/pages/130322cd2707.webp", video: false },
  { title: "Clothesline Sky", kind: "Product shot", media: "/pages/b77d948b62d1.webp", video: false },
  { title: "Sunny Cooler", kind: "Product shot", media: "/pages/81009fbd7256.webp", video: false },
  { title: "Soft Blue Hover", kind: "Product shot", media: "/pages/6a1d6532a112.webp", video: false },
  { title: "Cardboard City Nights", kind: "Product motion", media: "/pages/c14a0e3acb98.mp4", video: true },
  { title: "UGC Addiction", kind: "UGC video", media: "/pages/d4b9fef632f5.mp4", video: true },
  { title: "Sunbeam Pedestal", kind: "Product shot", media: "/pages/8ba4758d370a.webp", video: false },
  { title: "Fuzzy Hair", kind: "Product motion", media: "/pages/1bca019d1173.mp4", video: true },
  { title: "Garden Duffel", kind: "Product shot", media: "/pages/9e5e4623253c.webp", video: false },
  { title: "Yellow Meets Pink", kind: "Product shot", media: "/pages/e11131ce0775.webp", video: false },
  { title: "Through Wet Glass", kind: "Product shot", media: "/pages/d9f6a1c08ed6.webp", video: false },
  { title: "Lawn Crate Tumble", kind: "Product shot", media: "/pages/5e15302117ae.webp", video: false },
  { title: "Speckled Stone Spill", kind: "Product shot", media: "/pages/f68ca5b6d78a.webp", video: false },
  { title: "Packed Shelves", kind: "Product shot", media: "/pages/0fe958676e28.webp", video: false },
  { title: "Fruit Ice Stack", kind: "Product shot", media: "/pages/be261c7347d5.webp", video: false },
  { title: "Sky Grip", kind: "Product shot", media: "/pages/50af246703a3.webp", video: false },
  { title: "Die-Cut Reveal", kind: "Product shot", media: "/pages/e60b3639525d.webp", video: false },
  { title: "Deep Green Flat Lay", kind: "Product shot", media: "/pages/5f6841977094.webp", video: false },
  { title: "Radial Red Spin", kind: "Product motion", media: "/pages/b042e1ee6c2f.mp4", video: true },
  { title: "Ukiyo-e Paper Waves", kind: "Product motion", media: "/pages/4cb4320bc998.mp4", video: true },
  { title: "Amber Resin Monotone", kind: "Product motion", media: "/pages/1ecc4c51e85d.mp4", video: true },
  { title: "Blue on Blue", kind: "Product shot", media: "/pages/4c607821d078.webp", video: false },
  { title: "Roasting Pan Treat", kind: "Product shot", media: "/pages/fe0eef0d720f.webp", video: false },
  { title: "Concrete Basket", kind: "Product shot", media: "/pages/e2fed96badd4.webp", video: false },
  { title: "Classic Unboxing", kind: "UGC video", media: "/pages/0d4166e42689.mp4", video: true },
  { title: "Pastel Droplet Morph", kind: "Product motion", media: "/pages/982e6005a79f.mp4", video: true },
  { title: "Arm Ladder", kind: "Product shot", media: "/pages/ee438188c6c1.webp", video: false },
  { title: "Xerox Meme Window", kind: "Product motion", media: "/pages/e4dd1c1099c9.mp4", video: true },
  { title: "Warm Light Shaft", kind: "Product shot", media: "/pages/998d369708ab.webp", video: false },
];

export const MS_TILES = ["/pages/506ed86bca93.webp", "/pages/c2b6c494891d.webp", "/pages/9cc5a5062920.webp", "/pages/624e9da849de.webp", "/pages/da5777db0862.webp", "/pages/e1befffce015.webp", "/pages/c0f4367aa4ce.webp", "/pages/7f7a36c050cd.webp", "/pages/1fc52305846b.webp", "/pages/6ba17a932439.webp", "/pages/4739e9ba9b5f.webp", "/pages/fcd330ea4b1b.webp", "/pages/376ab8eda581.webp", "/pages/fea2610198ab.webp", "/pages/754911339c2a.webp", "/pages/3299d819aa2f.webp", "/pages/12e6d8cd9f70.webp", "/pages/a7e1541df8b1.webp", "/pages/473031dbec17.webp", "/pages/9701d62e9109.webp", "/pages/a24d057ca55b.webp", "/pages/fd4974a75e70.webp", "/pages/5b6e24ee410e.webp", "/pages/130322cd2707.webp", "/pages/b77d948b62d1.webp", "/pages/81009fbd7256.webp", "/pages/6a1d6532a112.webp", "/pages/8ba4758d370a.webp"];

export const SC_HEADING = "Build, generate, and market anything with skills, connectors, and automation";
export const SC_TABS = ["All", "Marketing", "Explainer videos", "Apps", "Games"];
export const SC_CARDS: ScCard[] = [
  { title: "Free Mode", kind: "Feature", media: "/pages/a6d7b032cde1.webm", video: true },
  { title: "Ad Multiplier", kind: "Skill", media: "/pages/1a9f81315703.mp4", video: true },
  { title: "Editorial Motion Graphics", kind: "Skill", media: "/pages/a415336dcc4d.mp4", video: true },
  { title: "RaisAI Faceless Video", kind: "Skill", media: "/pages/a29ab43d2ba5.mp4", video: true },
  { title: "Cartoon Faceless Video", kind: "Skill", media: "/pages/441746fa95ae.mp4", video: true },
  { title: "SaaS UGC video", kind: "Skill", media: "/pages/c29567337631.mp4", video: true },
  { title: "Physical UGC video", kind: "Skill", media: "/pages/f1e4033341f4.mp4", video: true },
  { title: "Brandkit", kind: "Skill", media: "/pages/da0afc160121.mp4", video: true },
  { title: "Shorts Maker", kind: "Skill", media: "/pages/874f591bb7e3.mp4", video: true },
  { title: "Website Building", kind: "Skill", media: "/pages/c8a6ec6fc1c1.webp", video: false },
];
