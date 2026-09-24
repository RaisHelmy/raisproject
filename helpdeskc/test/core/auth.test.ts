import { describe, expect, test } from "bun:test";
import { hashPassword, verifyPassword } from "../../src/core/auth/password";
import { generateToken, hashToken } from "../../src/core/auth/tokens";
import { uuidv7 } from "../../src/core/id/uuid7";

describe("password hashing", () => {
  test("verifies the correct password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
  });
  test("rejects the wrong password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("wrong password", hash)).toBe(false);
  });
  test("two hashes of the same password differ (random salt)", async () => {
    const a = await hashPassword("same password");
    const b = await hashPassword("same password");
    expect(a).not.toBe(b);
  });
});

describe("tokens", () => {
  test("generateToken produces unique hex strings", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f]+$/);
  });
  test("hashToken is deterministic", async () => {
    const token = generateToken();
    expect(await hashToken(token)).toBe(await hashToken(token));
  });
  test("different tokens hash differently", async () => {
    expect(await hashToken("a")).not.toBe(await hashToken("b"));
  });
});

describe("uuidv7", () => {
  test("produces well-formed, unique ids with the version/variant bits set", () => {
    const a = uuidv7();
    const b = uuidv7();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a).not.toBe(b);
  });

  test("the timestamp prefix orders ids generated a millisecond apart", async () => {
    const a = uuidv7();
    await new Promise((resolve) => setTimeout(resolve, 5));
    const b = uuidv7();
    // Only the 48-bit timestamp prefix is ordered by spec — the random
    // suffix is not, so this compares timestamps far enough apart to be
    // in different milliseconds, not full string order within one ms.
    expect(a.slice(0, 13) <= b.slice(0, 13)).toBe(true);
  });
});
