/**
 * Pricing page content, laid out like the reference pricing page.
 *
 * IMPORTANT: every price and allowance below is a PLACEHOLDER for the
 * prototype. Set real numbers before this page goes in front of customers.
 * Note also that this page presents monthly credit plans, while the product
 * rule in CLAUDE.md (§93/§94) is a prepaid ringgit balance with no credits —
 * the balance-based page is still served at /pricing/live.
 */

export interface PlanRow {
  label: string;
  /** null = not included on this plan. */
  value: string | null;
  badge?: string;
  badgeTone?: "lime" | "pink" | "blue";
}

export interface Plan {
  id: string;
  name: string;
  tagline: string;
  badges: { label: string; tone: "pink" | "blue" }[];
  credits: string;
  equivalents: string[];
  /** Ultra offers a credit slider instead of a fixed amount. */
  creditSteps?: string[];
  fixedNote?: string;
  price: { now: number; was?: number };
  cta: string;
  saveNote: string;
  tone: "plain" | "lime" | "pink";
  unlimited: { title: string; rows: PlanRow[]; more: string };
  seedance: { title: string; sub: string; available: boolean; rows: PlanRow[] };
  features: { label: string; included: boolean; accent?: boolean; badge?: string; badgeTone?: "lime" | "pink" }[];
}

const CURRENCY = "RM";
export const PRICE_PREFIX = CURRENCY;

export const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    tagline: "For first-time AI creators",
    badges: [],
    credits: "200 credits/mo.",
    equivalents: ["= 100 Nano Banana Pro Generations", "~ 11 Seedance 2.0 Fast videos"],
    fixedNote: "Fixed amount of 200 credits/mo",
    price: { now: 69 },
    cta: "Get Starter",
    saveNote: "No difference compared to monthly",
    tone: "plain",
    unlimited: {
      title: "Unlimited & free gens",
      rows: [
        { label: "Nano Banana 2", value: null },
        { label: "Nano Banana Pro", value: null },
        { label: "Kling 3.0", value: null },
      ],
      more: "3 unlimited & free generation models",
    },
    seedance: {
      title: "No access to Seedance 2.5",
      sub: "Available from Plus plan",
      available: false,
      rows: [
        { label: "Seedance 2.5", value: null },
        { label: "Seedance 2.0", value: null },
      ],
    },
    features: [
      { label: "Parallel generations: up to 2 Videos, 4 Images", included: true },
      { label: "Access to Supercomputer", included: true, accent: true },
      { label: "Access to Seedance 2.0 Fast & 2.0 Mini", included: true },
      { label: "Access to selected models only & features", included: true },
      { label: "Early access to advanced AI features", included: false },
      { label: "Access to unlimited marketplace", included: false },
      { label: "Lowest cost per credit", included: false },
    ],
  },
  {
    id: "plus",
    name: "Plus",
    tagline: "For everyday AI creation",
    badges: [{ label: "20% OFF", tone: "pink" }],
    credits: "1,000 credits/mo.",
    equivalents: ["= 500 Nano Banana Pro Generations", "~ 44 Seedance 2.0 videos"],
    fixedNote: "Fixed amount of 1,000 credits/mo",
    price: { now: 179, was: 229 },
    cta: "Get Plus",
    saveNote: `Save ${CURRENCY}600 compared to monthly`,
    tone: "lime",
    unlimited: {
      title: "Unlimited & free gens",
      rows: [
        { label: "Nano Banana Pro", value: null },
        { label: "Nano Banana 2", value: "7-day unlimited", badge: "2K", badgeTone: "blue" },
        { label: "Kling 3.0", value: "7-day unlimited" },
      ],
      more: "7 unlimited & free generation models",
    },
    seedance: {
      title: "Access to Seedance models",
      sub: "Full line-up included",
      available: true,
      rows: [
        { label: "Seedance 2.5", value: "Full access", badge: "1080p" },
        { label: "Seedance 2.0", value: "Full access", badge: "4K" },
      ],
    },
    features: [
      { label: "Unlimited paid parallel generations", included: true, badge: "New", badgeTone: "pink" },
      { label: "Access to Supercomputer", included: true, accent: true },
      { label: "Access to all Seedance models", included: true },
      { label: "Access to all models & features", included: true },
      { label: "Early access to advanced AI features", included: true },
      { label: "Access to unlimited marketplace", included: true },
      { label: "Lowest cost per credit", included: false },
    ],
  },
  {
    id: "ultra",
    name: "Ultra",
    tagline: "For ambitious AI projects",
    badges: [{ label: "23% OFF", tone: "pink" }, { label: "BEST VALUE", tone: "blue" }],
    credits: "3,000 credits/mo.",
    equivalents: ["= 1500 Nano Banana Pro Generations", "~ 133 Seedance 2.0 videos"],
    creditSteps: ["3,000", "6,000", "9,000"],
    price: { now: 459, was: 599 },
    cta: "Get Ultra",
    saveNote: `Save ${CURRENCY}1,800 compared to monthly`,
    tone: "pink",
    unlimited: {
      title: "Unlimited & free gens",
      rows: [
        { label: "Nano Banana Pro", value: "7-day unlimited", badge: "2K", badgeTone: "blue" },
        { label: "Nano Banana 2", value: "7-day unlimited", badge: "2K", badgeTone: "blue" },
        { label: "Kling 3.0", value: "7-day unlimited" },
      ],
      more: "7 unlimited & free generation models",
    },
    seedance: {
      title: "Access to Seedance models",
      sub: "Full line-up included",
      available: true,
      rows: [
        { label: "Seedance 2.5", value: "Full access", badge: "1080p" },
        { label: "Seedance 2.0", value: "Full access", badge: "4K" },
      ],
    },
    features: [
      { label: "Unlimited paid parallel generations", included: true, badge: "New", badgeTone: "pink" },
      { label: "Access to Supercomputer", included: true, accent: true },
      { label: "Access to all Seedance models", included: true },
      { label: "Access to all models & features", included: true },
      { label: "Early access to advanced AI features", included: true },
      { label: "Access to unlimited marketplace", included: true },
      { label: "Lowest cost per credit", included: true, badge: "60% CHEAPER", badgeTone: "lime" },
    ],
  },
];

export const PROMO = {
  badge: "Extra discount",
  titleAccent: "Nano Banana Pro, Nano Banana 2 & Kling 3.0 Unlimited",
  title: "Sign up and get your additional discount",
  sub: "Get Nano Banana 2 & Pro Unlimited on Ultra plan for 7 days with Special 30% discount",
  cta: "Sign up and get your discount",
};

export const FINE_PRINT = [
  "Unlimited models and Free Generations on plans are accessible only via RaisAI Create and are not accessible via MCP/CLI, Canvas or Supercomputer.",
  "Prices exclude tax, calculated at checkout. Unlimited usage may be subject to dynamic speed adjustments during high-traffic periods.",
  "Access to new models and advanced features may be done on a rolling basis and not available to all users at launch.",
];

export const PLAN_LINKS = [
  { label: "How do RaisAI plans work?", href: "/creator-hub/help-center" },
  { label: "What are Unlimited models?", href: "/creator-hub/help-center" },
];

/** "Find the best plan for you" configurator. */
export const QUIZ = {
  title: "Find the best plan for you",
  sub: "Choose what you want to create and get what you need",
  steps: [
    {
      n: 1,
      title: "What are you here to make?",
      hint: "Multiple options can be selected",
      options: ["Social media videos", "Talking-avatar videos", "UGC & product video ads", "Marketing product photos", "Cinematic videos", "Personal use"],
    },
    { n: 2, title: "How many content items per month?", hint: "", options: [] },
    { n: 3, title: "Features & capabilities", hint: "Add anything else you'll need", options: ["AI image generation", "AI video generation", "MCP & Supercomputer"] },
  ],
  recommend: "We recommend Plus plan",
};

export interface CompareRow { label: string; note?: string; values: (string | null)[] }
export interface CompareGroup { title: string; rows: CompareRow[] }

export const COMPARE: CompareGroup[] = [
  {
    title: "Video",
    rows: [
      { label: "Concurrent Jobs", values: ["2 concurrent jobs", "6 concurrent jobs", "8 concurrent jobs"] },
      { label: "Seedance 2.0 720p", note: "~22 credits/5s", values: [null, "533 videos", "1600 videos"] },
      { label: "Seedance 2.0 1080p", note: "~45 credits/5s", values: [null, "266 videos", "800 videos"] },
      { label: "Seedance 2.0 4K", note: "~110 credits/5s", values: [null, "109 videos", "327 videos"] },
      { label: "Kling 3.0", note: "~14 credits/8s", values: [null, "833 videos", "2500 videos"] },
    ],
  },
  {
    title: "Image",
    rows: [
      { label: "Nano Banana Pro", note: "~2 credits each", values: ["100 images", "500 images", "1500 images"] },
      { label: "Soul 2.0", note: "~1 credit each", values: ["200 images", "1000 images", "3000 images"] },
      { label: "GPT Image 2", note: "~3 credits each", values: [null, "333 images", "1000 images"] },
    ],
  },
];

export const FAQ = [
  { q: "How do credits work?", a: "Each generation costs credits based on the model, resolution and duration you pick. Your plan refills its credit allowance every month, and the estimate is always shown before you generate." },
  { q: "Is my subscription automatically renewed?", a: "Yes. Plans renew on the same day each month or year until you cancel, and you can cancel any time from your account." },
  { q: "How many images or videos can I generate?", a: "It depends on the models you use. The compare table above lists typical volumes per plan for the most popular models." },
  { q: "How can I purchase extra credits?", a: "Top up at any time from the balance page. Extra credits sit on top of your plan allowance and do not expire while your plan is active." },
  { q: "How does Unlimited work?", a: "Unlimited models can be generated without spending credits, at standard queue priority. Unlimited usage is only available inside RaisAI Create." },
  { q: "How does the 7-day Unlimited promo work?", a: "New Ultra subscribers get unlimited generations on the listed models for the first seven days after purchase." },
  { q: "Can I change my subscription after purchase?", a: "Yes. Upgrades take effect immediately and are prorated; downgrades take effect at the end of the current billing period." },
  { q: "How much does it cost to use RaisAI Supercomputer?", a: "Supercomputer runs consume credits from the same plan allowance, priced per task. The estimate is shown before each run." },
];
