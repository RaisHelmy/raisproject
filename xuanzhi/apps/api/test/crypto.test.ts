import { describe, expect, it } from "vitest";
import { decryptString, encryptString, hashPassword, verifyPassword, sha256Hex, hmacHex } from "../src/lib/crypto";
import { verifyStripeSignature } from "../src/services/billing";

describe("password hashing", () => {
  it("hashes with PBKDF2 at 100k iterations and verifies", async () => {
    const h = await hashPassword("correct horse 42");
    expect(h.startsWith("pbkdf2$100000$")).toBe(true);
    expect(await verifyPassword("correct horse 42", h)).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
    expect(await verifyPassword("anything", null)).toBe(false);
  });
});
describe("encryption", () => {
  it("round-trips provider keys with AES-GCM and rejects the wrong secret", async () => {
    const ct = await encryptString("sk-live-123", "secret-a");
    expect(ct).not.toContain("sk-live");
    expect(await decryptString(ct, "secret-a")).toBe("sk-live-123");
    await expect(decryptString(ct, "secret-b")).rejects.toBeTruthy();
  });
  it("sha256", async () => { expect(await sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"); });
});
describe("stripe signature", () => {
  it("accepts a valid v1 signature within tolerance and rejects others", async () => {
    const secret = "whsec_test"; const body = '{"id":"evt_1"}'; const t = Math.floor(Date.now() / 1000);
    const v1 = await hmacHex(`${t}.${body}`, secret);
    expect(await verifyStripeSignature(secret, `t=${t},v1=${v1}`, body)).toBe(true);
    expect(await verifyStripeSignature(secret, `t=${t},v1=deadbeef`, body)).toBe(false);
    expect(await verifyStripeSignature(secret, `t=${t - 10_000},v1=${v1}`, body)).toBe(false);
    expect(await verifyStripeSignature(secret, undefined, body)).toBe(false);
  });
});
