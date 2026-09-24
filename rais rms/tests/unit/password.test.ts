import { describe, expect, test } from "bun:test";
import { hashPassword, verifyPassword } from "../../api/lib/password";

describe("password hashing", () => {
  test("verifies a correct password and rejects an incorrect one", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    expect(await verifyPassword("correct-horse-battery-staple", hash)).toBe(true);
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });

  test("produces a different hash each time (random salt)", async () => {
    const a = await hashPassword("same-password");
    const b = await hashPassword("same-password");
    expect(a).not.toBe(b);
  });
});
