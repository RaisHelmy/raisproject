import { describe, expect, test } from "bun:test";
import { applyTransition, canTransition, InvalidTransitionError, isDueForAutoClose, reopenOnRequesterReply } from "../../src/core/ticket/state";

describe("canTransition", () => {
  test("allows the documented lifecycle edges", () => {
    expect(canTransition("new", "open")).toBe(true);
    expect(canTransition("open", "pending")).toBe(true);
    expect(canTransition("pending", "resolved")).toBe(true);
    expect(canTransition("resolved", "closed")).toBe(true);
    expect(canTransition("on_hold", "open")).toBe(true);
  });

  test("rejects illegal edges", () => {
    expect(canTransition("new", "resolved")).toBe(false);
    expect(canTransition("closed", "resolved")).toBe(false);
    expect(canTransition("new", "new")).toBe(false);
  });
});

describe("applyTransition", () => {
  test("throws InvalidTransitionError on an illegal edge", () => {
    expect(() =>
      applyTransition({ from: "new", to: "resolved", actor: "agent", now: "2026-01-01T00:00:00.000Z", slaPausedAt: null, slaPausedTotalSeconds: 0 }),
    ).toThrow(InvalidTransitionError);
  });

  test("sets resolvedAt when transitioning into resolved", () => {
    const result = applyTransition({ from: "open", to: "resolved", actor: "agent", now: "2026-01-01T00:00:00.000Z", slaPausedAt: null, slaPausedTotalSeconds: 0 });
    expect(result.status).toBe("resolved");
    expect(result.resolvedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(result.closedAt).toBeUndefined();
  });

  test("clears resolvedAt when reopened from resolved", () => {
    const result = applyTransition({ from: "resolved", to: "open", actor: "agent", now: "2026-01-02T00:00:00.000Z", slaPausedAt: null, slaPausedTotalSeconds: 0 });
    expect(result.resolvedAt).toBeNull();
  });

  test("starts the SLA pause clock when entering pending", () => {
    const result = applyTransition({ from: "open", to: "pending", actor: "agent", now: "2026-01-01T10:00:00.000Z", slaPausedAt: null, slaPausedTotalSeconds: 0 });
    expect(result.slaPausedAt).toBe("2026-01-01T10:00:00.000Z");
    expect(result.slaPausedTotalSeconds).toBe(0);
  });

  test("accumulates paused seconds when leaving pending", () => {
    const result = applyTransition({
      from: "pending",
      to: "open",
      actor: "contact",
      now: "2026-01-01T11:30:00.000Z",
      slaPausedAt: "2026-01-01T10:00:00.000Z",
      slaPausedTotalSeconds: 60,
    });
    expect(result.slaPausedAt).toBeNull();
    expect(result.slaPausedTotalSeconds).toBe(60 + 90 * 60);
  });

  test("does not double-pause when moving pending -> on_hold", () => {
    const result = applyTransition({
      from: "pending",
      to: "on_hold",
      actor: "agent",
      now: "2026-01-01T12:00:00.000Z",
      slaPausedAt: "2026-01-01T10:00:00.000Z",
      slaPausedTotalSeconds: 0,
    });
    // Still paused, but the original pause start is preserved — not reset.
    expect(result.slaPausedAt).toBe("2026-01-01T10:00:00.000Z");
  });
});

describe("reopenOnRequesterReply", () => {
  test("reopens a resolved ticket", () => {
    expect(reopenOnRequesterReply("resolved")).toBe("open");
  });
  test("leaves other statuses unchanged", () => {
    expect(reopenOnRequesterReply("open")).toBe("open");
    expect(reopenOnRequesterReply("closed")).toBe("closed");
  });
});

describe("isDueForAutoClose", () => {
  test("false before the window elapses", () => {
    expect(isDueForAutoClose("2026-01-01T00:00:00.000Z", "2026-01-05T00:00:00.000Z", 7)).toBe(false);
  });
  test("true once the window elapses", () => {
    expect(isDueForAutoClose("2026-01-01T00:00:00.000Z", "2026-01-08T00:00:00.000Z", 7)).toBe(true);
  });
});
