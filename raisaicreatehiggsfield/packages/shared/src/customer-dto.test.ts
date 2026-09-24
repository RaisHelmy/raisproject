import { describe, expect, it } from "vitest";
import { findForbiddenCustomerFields } from "./customer-dto";

describe("findForbiddenCustomerFields", () => {
  it("passes a clean customer payload", () => {
    expect(findForbiddenCustomerFields({ availableSen: 4962, currency: "MYR" })).toEqual([]);
  });
  it("finds admin-only fields at any depth", () => {
    const leaky = { items: [{ id: "g1", cost: { chargedSen: 38, provider_cost_micro_usd: 900 } }] };
    expect(findForbiddenCustomerFields(leaky)).toEqual(["$.items[0].cost.provider_cost_micro_usd"]);
  });
  it("finds credential hashes", () => {
    expect(findForbiddenCustomerFields({ user: { password_hash: "x" } })).toEqual(["$.user.password_hash"]);
  });
});
