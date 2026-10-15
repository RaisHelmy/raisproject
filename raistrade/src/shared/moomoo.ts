// What a moomoo Malaysia account can trade through moomoo OpenAPI (place_order), per the OpenAPI
// docs' trading-support table (openapi.futunn.com/futu-api-doc/en, checked Oct 2026). The simulator's
// instruments are mapped to the moomoo product you would actually trade; spot FX/crypto and binary
// options have no moomoo equivalent.

export type MoomooProduct = { via: "stock" | "futures"; product: string; contract?: string };

export const MOOMOO: Record<string, MoomooProduct | null> = {
  "US.AAPL": { via: "stock", product: "US stock" }, "US.TSLA": { via: "stock", product: "US stock" },
  "US.NVDA": { via: "stock", product: "US stock" }, "US.MSFT": { via: "stock", product: "US stock" },
  "US.AMZN": { via: "stock", product: "US stock" }, "US.MOO": { via: "stock", product: "US stock" },
  "HK.00700": { via: "stock", product: "HK stock" }, "HK.09988": { via: "stock", product: "HK stock" },
  "MY.MAYBANK": { via: "stock", product: "Bursa Malaysia stock" },
  "IDX.SPX": { via: "futures", product: "CME E-mini / Micro S&P 500 futures", contract: "ES / MES" },
  "CM.XAUUSD": { via: "futures", product: "CME gold futures", contract: "GC / MGC" },
  "CM.WTI": { via: "futures", product: "CME crude oil futures", contract: "CL / MCL" },
  "FX.EURUSD": { via: "futures", product: "CME euro FX futures", contract: "6E / M6E" },
  "FX.GBPUSD": { via: "futures", product: "CME British pound futures", contract: "6B / M6B" },
  "FX.USDJPY": { via: "futures", product: "CME Japanese yen futures", contract: "6J" },
  "CC.BTCUSD": { via: "futures", product: "CME Micro Bitcoin futures", contract: "MBT" },
  "CC.ETHUSD": { via: "futures", product: "CME Micro Ether futures", contract: "MET" },
  "FX.USDMYR": null,
};
export const moomooSupported = (code: string) => !!MOOMOO[code];

/** moomoo OpenAPI trading support for a moomoo MY account (live trading). */
export const MOOMOO_MATRIX: { market: string; products: string; my: boolean | "futures"; note?: string }[] = [
  { market: "🇺🇸 US", products: "Stocks, ETFs", my: true },
  { market: "🇺🇸 US", products: "Options", my: true },
  { market: "🇺🇸 US", products: "Futures (CME Group: index, gold, oil, FX, micro bitcoin/ether)", my: "futures", note: "needs a futures account" },
  { market: "🇭🇰 HK", products: "Stocks, ETFs, warrants, CBBCs, inline warrants", my: true },
  { market: "🇭🇰 HK", products: "Options, futures", my: false },
  { market: "🇲🇾 MY", products: "Bursa stocks, ETFs", my: true, note: "live only — no paper trading via API" },
  { market: "🇨🇳 A-shares", products: "China Connect stocks", my: true },
  { market: "🇸🇬 SG", products: "Stocks, ETFs, warrants, REITs, DLCs", my: true },
  { market: "🇯🇵 JP", products: "Stocks, ETFs, futures", my: false },
  { market: "🪙 Crypto", products: "Spot crypto", my: false },
  { market: "💱 Forex", products: "Spot FX", my: false, note: "only via CME FX futures" },
  { market: "⏱ Binary options", products: "Higher / Lower", my: false, note: "not a moomoo product — simulator only" },
];
