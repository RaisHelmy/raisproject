import { describe, expect, test } from "bun:test";
import { isValidSlug, validateSlug, InvalidSlugError } from "../../src/core/domain/slug";

describe("slug validation", () => {
  test("accepts a valid slug", () => {
    expect(isValidSlug("acme-corp")).toBe(true);
  });
  test("rejects too short", () => {
    expect(isValidSlug("ab")).toBe(false);
  });
  test("rejects uppercase", () => {
    expect(isValidSlug("Acme")).toBe(false);
  });
  test("rejects leading/trailing hyphen", () => {
    expect(isValidSlug("-acme")).toBe(false);
    expect(isValidSlug("acme-")).toBe(false);
  });
  test("rejects reserved slugs", () => {
    expect(isValidSlug("www")).toBe(false);
    expect(isValidSlug("admin")).toBe(false);
    expect(isValidSlug("helpdeskc")).toBe(false);
  });
  test("validateSlug throws with the specific reason", () => {
    expect(() => validateSlug("ab")).toThrow(InvalidSlugError);
    try {
      validateSlug("www");
    } catch (e) {
      expect((e as InvalidSlugError).reason).toBe("reserved");
    }
    try {
      validateSlug("a");
    } catch (e) {
      expect((e as InvalidSlugError).reason).toBe("format");
    }
  });
});
