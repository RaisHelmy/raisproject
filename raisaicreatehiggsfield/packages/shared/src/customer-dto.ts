/**
 * ADR-006: internal provider economics never reach a customer-facing payload.
 * Customer DTOs are the only shape returned from non-admin `/api/v1` routes,
 * MCP tools and the SDK.
 */
export const FORBIDDEN_CUSTOMER_FIELDS = [
  "provider_cost_micro_usd",
  "providerCost",
  "providerCostMicroUsd",
  "markup_percent",
  "markupPercent",
  "markup",
  "margin_sen",
  "marginSen",
  "margin",
  "provider_price_json",
  "providerPrice",
  "provider_request_id",
  "providerRequestId",
  "fx_rate_usd_myr",
  "fxRateUsdMyr",
  "password_hash",
  "passwordHash",
  "key_hash",
  "secret_hash",
] as const;

/** Returns the dotted paths of any admin-only field found in a payload. */
export function findForbiddenCustomerFields(value: unknown, path = "$"): string[] {
  const found: string[] = [];
  const walk = (node: unknown, at: string) => {
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, `${at}[${i}]`));
      return;
    }
    if (node && typeof node === "object") {
      for (const [key, child] of Object.entries(node)) {
        if ((FORBIDDEN_CUSTOMER_FIELDS as readonly string[]).includes(key)) found.push(`${at}.${key}`);
        walk(child, `${at}.${key}`);
      }
    }
  };
  walk(value, path);
  return found;
}
