import { describe, expect, it } from "vitest";
import { auditCategory } from "@rais/shared-types";

describe("simplified (audit) view helpers", () => {
  it("maps task tags to generic activity types", () => {
    expect(auditCategory("[DEV] bayarzakat.io LIVE on custom domain")).toBe("Software development");
    expect(auditCategory("[MTG] Google Meet with Afif")).toBe("Meeting / discussion");
    expect(auditCategory("[SEC] DNSSEC enabled for bayarzakat.io")).toBe("Security hardening & remediation");
    expect(auditCategory("Untagged task mentioning MATAH")).toBe("General work");
  });
});
