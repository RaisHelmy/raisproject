// Quick Invest: pick a horizon (few hours / a day / a week), an amount, a risk level and optionally
// Shariah-only; screen every default strategy on a fitting set of markets; then recommend a combo
// and say plainly whether it suits the user — with the reasons and what to change if it doesn't.

import { BY_CODE, INSTRUMENTS, UNIVERSE, priceAt } from "./market";
import { LIBRARY, PRESETS, type LibRule, type Preset } from "./library";
import { activityShariah, shariahOf } from "./shariah";
import { estimateCosts } from "./costs";
import { type ComboStats, comboConfig, ruleOf, tplOf, winConfidence } from "./combos";
import type { RuleConfig } from "./strategies";

export type QIHorizon = "HOURS" | "DAY" | "WEEK";
export type QIRisk = "CAREFUL" | "BALANCED" | "BOLD";
export interface QIInput { horizon: QIHorizon; amountUSD: number; risk: QIRisk; shariah: boolean }

export const HORIZONS: Record<QIHorizon, { label: string; icon: string; desc: string; stockPresets: string[]; binaryPresets: string[]; tradesPerDay: [number, number] }> = {
  HOURS: { label: "A few hours", icon: "⏳", desc: "Check back in 1–4 hours", stockPresets: ["hours"], binaryPresets: ["bin5m", "bin15m"], tradesPerDay: [1, 48] },
  DAY: { label: "Today", icon: "☀️", desc: "In and out within the day", stockPresets: ["intraday", "dayrun"], binaryPresets: [], tradesPerDay: [0.5, 24] },
  WEEK: { label: "This week", icon: "🗓", desc: "Hold for a few days, check daily", stockPresets: ["swing", "swing2"], binaryPresets: [], tradesPerDay: [0.05, 3] },
};
export const RISKS: Record<QIRisk, { label: string; robots: number; maxDD: number; binaryStake: number; desc: string }> = {
  CAREFUL: { label: "Careful", robots: 3, maxDD: 5, binaryStake: 0.02, desc: "Few robots, small stakes, shallow drawdowns" },
  BALANCED: { label: "Balanced", robots: 5, maxDD: 10, binaryStake: 0.04, desc: "A handful of robots, moderate stakes" },
  BOLD: { label: "Bold", robots: 8, maxDD: 20, binaryStake: 0.06, desc: "More robots, bigger stakes, deeper drawdowns" },
};

const h = (s: string) => { let x = 2166136261; for (let i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 16777619); return (x >>> 0) / 4294967296; };

/** Presets and markets to screen for these choices. Shariah: stocks only, compliant assets only. */
export function screeningPlan(inp: QIInput) {
  const hz = HORIZONS[inp.horizon];
  const presets: Preset[] = PRESETS.filter((p) => hz.stockPresets.includes(p.id) || (!inp.shariah && hz.binaryPresets.includes(p.id)));
  const perRobot = inp.amountUSD / RISKS[inp.risk].robots;
  // Stocks the budget can actually buy one lot of (at today's simulated price), Shariah-filtered if asked.
  const affordable = UNIVERSE.filter((i) => i.cls === "stock" && (i.code.startsWith("US.") || i.code.startsWith("MY.") || i.code.startsWith("HK."))
    && (!inp.shariah || shariahOf(i.code).status === "compliant") && priceAt(i.code, Date.now()) * i.lot <= Math.max(perRobot * 1.5, 1));
  const stockCodes = [...affordable].sort((a, b) => Number(!!a.ext) - Number(!!b.ext) || h(a.code) - h(b.code)).slice(0, 60).map((i) => i.code);
  const binaryCodes = INSTRUMENTS.filter((i) => !inp.shariah).map((i) => i.code);
  const rules: LibRule[] = LIBRARY.filter((r) => r.isDefault && presets.some((p) => p.id === r.preset));
  const jobs = presets.map((p) => ({ preset: p.id, codes: p.mode === "BINARY" ? binaryCodes : stockCodes, rules: rules.filter((r) => r.preset === p.id).map((r) => r.id) }));
  return { presets, jobs, stockCodes, total: jobs.reduce((s, j) => s + j.codes.length * j.rules.length, 0) };
}

export interface QIPick { r: ComboStats; cfg: RuleConfig; positionUSD: number; costPct: number; perDay: number; shariah: string; name: string }
export interface QICheck { level: "ok" | "warn" | "bad"; title: string; text: string }
export interface QIAdvice { verdict: "GOOD" | "CAVEATS" | "NOT_SUITABLE"; score: number; picks: QIPick[]; checks: QICheck[]; suggestions: string[]; expectedPerDayUSD: number }

export function advise(inp: QIInput, results: ComboStats[]): QIAdvice {
  const risk = RISKS[inp.risk], hz = HORIZONS[inp.horizon];
  const perRobot = inp.amountUSD / risk.robots;
  const fitsHorizon = (r: ComboStats) => r.perDay >= hz.tradesPerDay[0] && r.perDay <= hz.tradesPerDay[1];
  const minTrades = inp.horizon === "WEEK" ? 4 : 8;
  const cands = results
    .filter((r) => (r.verdict === "ROBUST" || r.verdict === "PROMISING") && r.pnl > 0 && r.trades >= minTrades && fitsHorizon(r) && r.maxDD <= risk.maxDD * 2.5)
    .filter((r) => !inp.shariah || activityShariah(rulesMode(r), r.code).status === "compliant")
    .sort((a, b) => b.score - a.score || winConfidence(b) - winConfidence(a));
  const picks: QIPick[] = [], usedAsset = new Set<string>(), usedTpl = new Map<string, number>();
  for (const r of cands) {
    if (picks.length >= risk.robots) break;
    const tpl = ruleOf(r).template;
    if (usedAsset.has(r.code) || (usedTpl.get(tpl) ?? 0) >= 2) continue;
    const base = comboConfig(ruleOf(r), r.code), inst = BY_CODE[r.code]!, px = priceAt(r.code, Date.now());
    let cfg: RuleConfig, positionUSD: number, costPct = 0;
    if (base.mode === "BINARY") {
      const stake = Math.max(1, Math.round(inp.amountUSD * risk.binaryStake * 100) / 100);
      cfg = { ...base, amount: stake }; positionUSD = stake;
    } else {
      const lots = Math.floor(perRobot / (px * inst.lot));
      if (lots < 1) continue; // can't afford one lot
      const qty = lots * inst.lot;
      cfg = { ...base, amount: qty }; positionUSD = qty * px;
      costPct = estimateCosts(r.code, "BUY", qty).roundTripPct;
    }
    usedAsset.add(r.code); usedTpl.set(tpl, (usedTpl.get(tpl) ?? 0) + 1);
    picks.push({ r, cfg, positionUSD, costPct, perDay: r.perDay, shariah: activityShariah(cfg.mode, r.code, cfg.money_mgmt).status, name: `${tplOf(r).name} · ${r.code}` });
  }

  const checks: QICheck[] = [], sugg: string[] = [];
  const stockPicks = picks.filter((p) => p.cfg.mode === "STOCK");
  if (!picks.length) {
    checks.push({ level: "bad", title: "No suitable robot", text: inp.shariah
      ? "No Shariah-compliant stock robot passed the stability checks for this horizon and budget."
      : "No robot passed the stability checks for this horizon and budget." });
    if (inp.horizon !== "WEEK") sugg.push("Try a longer horizon — weekly robots trade less and pay fewer costs.");
    sugg.push(`Increase the amount (at least about RM ${Math.ceil(minBudgetUSD(inp) * 4.3)}) so each robot can buy a full lot.`);
  }
  if (picks.length && picks.length < Math.min(3, risk.robots))
    checks.push({ level: "warn", title: "Low diversification", text: `Only ${picks.length} robot${picks.length > 1 ? "s" : ""} qualified — results will swing more than with 3+.` });
  else if (picks.length) checks.push({ level: "ok", title: "Diversified", text: `${picks.length} robots on ${new Set(picks.map((p) => p.r.code)).size} different markets, ${new Set(picks.map((p) => ruleOf(p.r).template)).size} strategies.` });

  const costly = stockPicks.filter((p) => p.costPct > 1);
  if (costly.length) {
    checks.push({ level: costly.length === stockPicks.length ? "bad" : "warn", title: "Trading costs", text: `${costly.length} of ${stockPicks.length} stock robots lose more than 1% to fees and spread on every round trip (worst ${Math.max(...costly.map((p) => p.costPct)).toFixed(1)}%). Profits must clear that first.` });
    if (inp.amountUSD < minBudgetUSD(inp)) sugg.push(`Use about RM ${Math.ceil(minBudgetUSD(inp) * 4.3).toLocaleString()} or more so each order is big enough for moomoo's minimum fees.`);
    else if (inp.risk !== "CAREFUL") sugg.push("Choose Careful (fewer robots) so each order is larger and fixed fees weigh less.");
  } else if (stockPicks.length) checks.push({ level: "ok", title: "Trading costs", text: `Round-trip costs ${Math.max(...stockPicks.map((p) => p.costPct)).toFixed(2)}% or less per trade — already included in the backtests.` });

  if (picks.length) {
    const worstDD = Math.max(...picks.map((p) => p.r.maxDD));
    checks.push(worstDD > risk.maxDD
      ? { level: "warn", title: "Drawdown vs your risk level", text: `Worst backtest dip ${worstDD.toFixed(1)}% is above the ${risk.maxDD}% you chose (${risk.label}).` }
      : { level: "ok", title: "Drawdown vs your risk level", text: `Worst backtest dip ${worstDD.toFixed(1)}% — within ${risk.maxDD}% for ${risk.label}.` });
    const proven = picks.filter((p) => p.r.verdict === "ROBUST").length;
    checks.push({ level: proven >= Math.ceil(picks.length / 2) ? "ok" : "warn", title: "Stability", text: `${proven} of ${picks.length} rated Consistent${proven < picks.length ? `, ${picks.length - proven} Promising` : ""}. Every pick was profitable after costs in most test periods.` });
  }
  const hasBinary = picks.some((p) => p.cfg.mode === "BINARY");
  if (inp.shariah) checks.push({ level: "ok", title: "Shariah", text: "Stock robots only, on assets on the SC Shariah list or passing the Musaffa screen. No binary options, no short selling." });
  else if (hasBinary) checks.push({ level: "warn", title: "Shariah", text: "Includes binary-option robots — not Shariah-compliant, and not a moomoo product (practice only)." });
  const fees = stockPicks.length && inp.amountUSD < 250;
  if (fees) checks.push({ level: "warn", title: "Small budget", text: "With less than about RM1,000, moomoo's fixed minimum fees (RM3 / US$0.99 + stamp duty per order) eat a large share of any gain." });

  const exp = picks.reduce((s, p) => s + Math.max(0, p.r.pnl / Math.max(1, (p.r.trades / Math.max(p.r.perDay, 0.01)))) * (p.cfg.mode === "BINARY" ? p.cfg.amount / 50 : 1), 0);
  const bad = checks.filter((c) => c.level === "bad").length, warn = checks.filter((c) => c.level === "warn").length;
  const score = Math.max(0, Math.min(100, Math.round(100 - bad * 45 - warn * 12 - (picks.length ? 0 : 40))));
  const verdict = bad || !picks.length ? "NOT_SUITABLE" : warn ? "CAVEATS" : "GOOD";
  return { verdict, score, picks, checks, suggestions: [...new Set(sugg)], expectedPerDayUSD: exp };
}

const rulesMode = (r: ComboStats) => (PRESETS.find((p) => p.id === r.preset)!.mode);

/** Smallest budget where the cheapest screened lots keep round-trip costs near 1%. */
function minBudgetUSD(inp: QIInput) {
  const per = inp.horizon === "WEEK" ? 300 : 450; // ≈ order size where US$0.99 + stamp duty ≈ 1% round trip
  return per * RISKS[inp.risk].robots;
}
