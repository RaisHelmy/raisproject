import type { NormalizedPosition } from "../types";
import type { MoomooRawPosition } from "./types";
import type { Instrument } from "../../instruments";

/** Moomoo-native shape → normalized position, enriched with the screening
 * metadata Rais Fintech already knows about the instrument. */
export function mapPosition(raw: MoomooRawPosition, inst: Instrument): NormalizedPosition {
  return {
    providerSecurityId: raw.stock_code,
    symbol: raw.stock_code,
    name: raw.stock_name,
    quantity: raw.qty,
    avgCost: raw.cost_price,
    lastPrice: raw.market_price,
    currency: raw.currency,
    assetClass: inst.type,
    shariahStatus: inst.shariah.status,
  };
}
