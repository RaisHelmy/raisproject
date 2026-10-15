// Marketing copy and brand kit shared by the /ads page and the public MCP server (/mcp), so a video
// or design made through MCP always matches the live page.

export const HERO = {
  pill: "Live demo · paper money · no sign-up",
  headline: ["Trading robots that", "prove themselves", "first."], // middle part uses the brand gradient
  lead: "Chart 18 markets, trade stocks and binary options, and let 100 strategy robots trade for you — each one backtested live and ranked by how stable it really is.",
  ctas: [{ label: "Start trading free", href: "/" }, { label: "▶ Watch it work", href: "/ads#demo" }, { label: "🕹 Try the live demo", href: "/?demo=1" }],
};

export const FEATURES = [
  { icon: "📈", title: "Real-time charts", text: "Candlesticks, volume and a live price line for stocks, forex, crypto, gold and oil — 5-second to daily candles." },
  { icon: "⏱", title: "Binary options", text: "Higher / Lower trades from 30 seconds to 15 minutes with live strike and expiry markers." },
  { icon: "🤖", title: "Robots that run 24/7", text: "Start a strategy and it trades on the server every minute — even with the app closed. Auto-stops after 4 losses in a row." },
  { icon: "🧪", title: "Live backtests", text: "Every rule is replayed on real price history and re-scored each time a candle closes." },
  { icon: "🎯", title: "Robots for your style", text: "Quick profit, few hours, day trading, weekly swing or long-term — the most stable robots for how you actually trade." },
  { icon: "🛡", title: "Honest predictions", text: "Out-of-sample checks, peer-asset checks and a trend test flag robots whose profit is just luck or a rally." },
  { icon: "💰", title: "Real profit, after costs", text: "Spread, slippage, moomoo Malaysia fees and taxes shown before you trade — and net profit after every fill." },
  { icon: "🚨", title: "Crash guards", text: "Anomaly detectors halt new trades during market or crypto crashes until the risk has passed." },
  { icon: "🗂", title: "Sessions", text: "Run strategies in sessions, compare results, and start the next one from your best robots." },
  { icon: "🎁", title: "One-click bundles", text: "100+ ready-made portfolios — conservative to aggressive — start several robots at once." },
  { icon: "🧾", title: "Full audit trail", text: "Every order, signal, win, loss, halt and auto-stop is logged, append-only." },
  { icon: "🇲🇾", title: "Made for Malaysia", text: "Ringgit by default, moomoo Malaysia fee schedule, and a filter for what moomoo's API can really trade." },
];

export const DISCLAIMER = "RaisTrade is a demo trading simulator. Prices come from a simulated market; backtests and predictions are not financial advice.";

export const BRAND = {
  name: "RaisTrade",
  wordmark: "Rais + Trade (\"Trade\" in the primary orange)",
  font: { family: "Inter", weights: [400, 500, 600, 700, 800], source: "https://fonts.google.com/specimen/Inter" },
  colors: {
    dark: { background: "#09090b", card: "#111113", foreground: "#fafafa", muted: "#18181b", mutedForeground: "#a1a1aa", border: "#27272a", primary: "#f97316", up: "#22c55e", down: "#ef4444", warn: "#eab308", info: "#38bdf8" },
    light: { background: "#fafafa", card: "#ffffff", foreground: "#09090b", muted: "#f4f4f5", mutedForeground: "#71717a", border: "#e4e4e7", primary: "#ea580c", up: "#16a34a", down: "#dc2626", warn: "#ca8a04", info: "#0284c7" },
  },
  gradient: "linear-gradient(90deg, #f97316, #ec4899 60%, #8b5cf6)",
  logoSvg: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='7' fill='#ff6a00'/><path d='M6 22l7-7 5 5 8-10' stroke='white' stroke-width='3' fill='none' stroke-linecap='round'/></svg>",
  style: "shadcn/ui-like: zinc neutrals, rounded 12px cards, subtle borders, one orange accent, green/red for profit/loss, Inter, generous whitespace.",
};
