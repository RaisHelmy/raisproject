import { describe, expect, it } from "vitest";
import { isPortCompatible, portColor } from "./types";

describe("editor port compatibility", () => {
  it("mirrors the engine rules the server enforces", () => {
    expect(isPortCompatible("image", "image")).toBe(true);
    expect(isPortCompatible("image", "image[]")).toBe(true);
    expect(isPortCompatible("text", "prompt")).toBe(true);
    expect(isPortCompatible("prompt", "text")).toBe(true);
    expect(isPortCompatible("image", "number")).toBe(false);
    expect(isPortCompatible("video", "text")).toBe(false);
  });

  it("accepts anything into an any port", () => {
    expect(isPortCompatible("video", "any")).toBe(true);
    expect(isPortCompatible("json", "any")).toBe(true);
  });

  it("gives each type a distinct colour so mismatches are visible", () => {
    expect(portColor("image")).not.toBe(portColor("text"));
    expect(portColor("unknown-type")).toBeTruthy();
  });
});
