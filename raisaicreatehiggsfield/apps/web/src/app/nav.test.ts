import { describe, expect, it } from "vitest";
import { MOBILE_NAV, NAV, visibleItems } from "./nav";

const flatten = (items: typeof NAV): typeof NAV => items.flatMap((n) => [n, ...(n.children ?? [])]);

describe("navigation", () => {
  it("uses the section order our target users already know", () => {
    // Familiar shape for people coming from the big creative suites:
    // media types first, tools, then community/library, then money and self.
    expect(NAV.map((n) => n.label)).toEqual([
      "Home", "Image", "Video", "Audio", "Text", "Apps", "Canvas", "Community", "Library", "Pricing", "Profile",
    ]);
  });

  it("keeps admin items out of the customer sidebar entirely", () => {
    // Not merely behind advanced mode: a customer who turns advanced mode on
    // must still not be shown pricing and markup controls (§164).
    const all = flatten(NAV);
    expect(all.filter((n) => n.admin).length).toBeGreaterThan(0);
    expect(all.filter((n) => !n.admin).some((n) => n.to.startsWith("/admin"))).toBe(false);
    const customer = flatten(visibleItems(NAV, { advanced: true, admin: false }));
    expect(customer.some((n) => n.to.startsWith("/admin"))).toBe(false);
  });

  it("puts developer tools behind advanced mode", () => {
    const developer = flatten(NAV).filter((n) => n.to.startsWith("/developer"));
    expect(developer.length).toBeGreaterThan(0);
    expect(developer.every((n) => n.advanced)).toBe(true);
    const beginner = flatten(visibleItems(NAV, { advanced: false, admin: false }));
    expect(beginner.some((n) => n.to.startsWith("/developer"))).toBe(false);
  });

  it("fits four items in the phone bar", () => {
    expect(MOBILE_NAV).toHaveLength(4);
  });
});
