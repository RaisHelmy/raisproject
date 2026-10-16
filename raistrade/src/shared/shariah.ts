import { BURSA_SHARIAH, SC_LIST, US_SCREENED } from "./universe.data";
// Shariah screening indication per instrument and per trading activity (checked Oct 2026).
// This is an indication from public screeners and SC Malaysia Shariah Advisory Council (SAC)
// resolutions — not a fatwa. Screeners differ and statuses change every quarter; "verified: false"
// marks entries we could not confirm from a source and that should be checked before investing.

export type ShariahStatus = "compliant" | "doubtful" | "not";
export interface ShariahInfo { status: ShariahStatus; reason: string; source: string; verified: boolean }

export const SHARIAH: Record<string, ShariahInfo> = {
  "US.AAPL": { status: "compliant", reason: "Passes AAOIFI business and financial-ratio screens.", source: "Musaffa (2026)", verified: true },
  "US.NVDA": { status: "compliant", reason: "Revenue from chips/software; passes financial ratios.", source: "Musaffa (Sep 2026), HalalWallet", verified: true },
  "US.TSLA": { status: "compliant", reason: "Passes AAOIFI business and financial-ratio screens.", source: "Musaffa (2026)", verified: true },
  "US.MSFT": { status: "not", reason: "Fails the screen (financial ratios / non-compliant income).", source: "Musaffa Nasdaq-100 screen (Apr 2026)", verified: true },
  "US.AMZN": { status: "doubtful", reason: "Rated doubtful — close to the screening limits.", source: "Musaffa Nasdaq-100 screen (Apr 2026)", verified: true },
  "US.MOO": { status: "not", reason: "Brokerage earning margin-lending interest (riba) as core income.", source: "business-activity screen (RaisTrade assessment)", verified: false },
  "HK.00700": { status: "doubtful", reason: "Gaming and fintech income; screeners differ.", source: "unverified", verified: false },
  "HK.09988": { status: "not", reason: "Impermissible income 8.5% of revenue (limit 5%).", source: "HalalWallet (Mar 2026)", verified: true },
  "MY.MAYBANK": { status: "not", reason: "Conventional bank — interest-based income (Maybank Islamic is a separate subsidiary).", source: "Musaffa AAOIFI screen (Jul 2026); check SC Shariah-compliant list", verified: true },
  "IDX.SPX": { status: "not", reason: "Broad index includes conventional banks, insurers and other non-compliant sectors; traded via conventional futures.", source: "index composition", verified: false },
  "CM.XAUUSD": { status: "doubtful", reason: "Physical gold with spot settlement is permissible; here it trades as CME futures, where scholars differ.", source: "SAC accepts some futures (e.g. FCPO); CME gold not ruled", verified: false },
  "CM.WTI": { status: "doubtful", reason: "Commodity futures: SAC accepted FCPO, but CME crude futures are not ruled on.", source: "SAC resolutions (FCPO)", verified: false },
  "FX.EURUSD": { status: "doubtful", reason: "Currency exchange is permissible only hand-to-hand; FX futures/leveraged FX are disputed.", source: "general fiqh of sarf", verified: false },
  "FX.GBPUSD": { status: "doubtful", reason: "Currency exchange is permissible only hand-to-hand; FX futures/leveraged FX are disputed.", source: "general fiqh of sarf", verified: false },
  "FX.USDJPY": { status: "doubtful", reason: "Currency exchange is permissible only hand-to-hand; FX futures/leveraged FX are disputed.", source: "general fiqh of sarf", verified: false },
  "FX.USDMYR": { status: "not", reason: "Leveraged/CFD-style FX with deferred settlement; no moomoo product.", source: "general fiqh of sarf", verified: false },
  "CC.BTCUSD": { status: "doubtful", reason: "SAC permits trading digital assets in principle on SC-registered exchanges; here it is CME futures.", source: "SC SAC (2020)", verified: true },
  "CC.ETHUSD": { status: "doubtful", reason: "SAC permits trading digital assets in principle on SC-registered exchanges; here it is CME futures.", source: "SC SAC (2020)", verified: true },
};

const EXT_SHARIAH: Record<string, ShariahInfo> = Object.fromEntries([
  ...BURSA_SHARIAH.map(([c, , board]) => [`MY.${c}`, { status: "compliant" as const, reason: `On the SC Shariah Advisory Council's list of Shariah-compliant securities (${board} Market).`, source: `${SC_LIST.name}, effective ${SC_LIST.effective}`, verified: true }]),
  ...US_SCREENED.map(([t, , status, src]) => [`US.${t}`, { status, reason: status === "compliant" ? "Passes AAOIFI business and financial-ratio screens." : status === "doubtful" ? "Close to the screening limits — screeners differ." : "Fails the business-activity or financial-ratio screen.", source: src, verified: true }]),
]);

export const shariahOf = (code: string): ShariahInfo =>
  SHARIAH[code] ?? EXT_SHARIAH[code] ?? { status: "doubtful", reason: "Not screened.", source: "none", verified: false };

/** Shariah status of a trading activity (robot/order), combining what it does with the asset. */
export function activityShariah(mode: "STOCK" | "BINARY", code: string, moneyMgmt?: string): ShariahInfo {
  if (mode === "BINARY")
    return { status: "not", reason: `Fixed-payout binary options are widely regarded as gambling (maisir) with excessive uncertainty (gharar)${moneyMgmt === "MARTINGALE" ? "; martingale doubling adds to it" : ""}.`, source: "no SAC ruling found; scholarly consensus", verified: false };
  const a = shariahOf(code);
  return { ...a, reason: a.status === "compliant" ? `Buying and holding a Shariah-compliant asset (cash account, no short selling). ${a.reason}` : a.reason };
}

export const SHARIAH_LABEL: Record<ShariahStatus, { short: string; long: string; icon: string }> = {
  compliant: { short: "Shariah", long: "Shariah-compliant", icon: "✓" },
  doubtful: { short: "Check", long: "Doubtful — screeners differ", icon: "?" },
  not: { short: "Non-Shariah", long: "Not Shariah-compliant", icon: "✕" },
};
export const SHARIAH_NOTE = "Indication only, not a fatwa. Screens change quarterly and screeners differ — confirm with the SC Malaysia Shariah list or your Shariah adviser.";

// ---------------- Purification (cleansing) ----------------

export interface PurifyRow { mode: "STOCK" | "BINARY"; code: string; pnl: number; mm?: string }
export interface PurifyClass { status: ShariahStatus; trades: number; profit: number; loss: number; net: number; shareOfProfit: number; shareOfNet: number; purify: number }

/** Splits results by Shariah status and works out how much profit should be cleansed (given away).
 *  Non-compliant (haram) profit: 100% to purify. Doubtful (syubhah): shown separately as a recommended purification.
 *  Losses are not offset against profits for purification. */
export function purification(rows: PurifyRow[]) {
  const by: Record<ShariahStatus, PurifyClass> = Object.fromEntries((["compliant", "doubtful", "not"] as ShariahStatus[]).map((s) => [s, { status: s, trades: 0, profit: 0, loss: 0, net: 0, shareOfProfit: 0, shareOfNet: 0, purify: 0 }])) as never;
  for (const r of rows) {
    const c = by[activityShariah(r.mode, r.code, r.mm).status];
    c.trades++; c.net += r.pnl;
    if (r.pnl > 0) c.profit += r.pnl; else c.loss += -r.pnl;
  }
  const totalProfit = Object.values(by).reduce((s, c) => s + c.profit, 0), totalNet = Object.values(by).reduce((s, c) => s + c.net, 0);
  for (const c of Object.values(by)) {
    c.shareOfProfit = totalProfit ? c.profit / totalProfit : 0;
    c.shareOfNet = totalNet ? c.net / totalNet : 0;
    c.purify = c.status === "compliant" ? 0 : c.profit;
  }
  return { classes: by, totalProfit, totalNet, mustPurify: by.not.purify, recommendPurify: by.doubtful.purify, halalNet: by.compliant.net };
}
export const PURIFY_NOTE = "Purification: profit from non-compliant (haram) activity should be given away to charity in full; profit from doubtful (syubhah) assets is commonly purified as a precaution. Losses are not offset. Confirm amounts with your Shariah adviser.";
