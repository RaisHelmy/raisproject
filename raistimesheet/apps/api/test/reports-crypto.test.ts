import { describe, expect, it } from "vitest";
import { buildXlsx, crc32, zipStore } from "../src/services/reports/xlsx";
import { buildPdf } from "../src/services/reports/pdf";
import { decryptString, encryptString, hashPassword, verifyPassword, timingSafeEqualString } from "../src/lib/crypto";

describe("XLSX writer", () => {
  it("produces a valid ZIP container with the expected parts", () => {
    const bytes = buildXlsx([{ name: "Timesheets", title: "Test", subtitle: "Sub", columns: [{ header: "Date", type: "date" }, { header: "Task" }, { header: "Duration", type: "duration" }], rows: [["2026-09-04", "Fix API", 135], ["2026-09-05", "Deploy", 60]], totals: ["Total", "", 195] }]);
    expect(bytes[0]).toBe(0x50); expect(bytes[1]).toBe(0x4b); // PK
    const text = new TextDecoder("latin1").decode(bytes);
    expect(text).toContain("[Content_Types].xml");
    expect(text).toContain("xl/worksheets/sheet1.xml");
    expect(text).toContain("state=\"frozen\"");
    expect(text).toContain("<autoFilter");
    expect(text).toContain("Fix API");
    // end of central directory signature present
    const eocd = bytes.slice(bytes.length - 22, bytes.length - 18);
    expect([...eocd]).toEqual([0x50, 0x4b, 0x05, 0x06]);
  });
  it("crc32 matches known vector", () => {
    expect(crc32(new TextEncoder().encode("123456789")).toString(16)).toBe("cbf43926");
    expect(zipStore([]).length).toBe(22);
  });
});

describe("PDF writer", () => {
  it("emits a well-formed multi-page PDF with page numbers", () => {
    const rows = Array.from({ length: 80 }, (_, i) => [`TS-2026-${String(i + 1).padStart(5, "0")}`, "04 Sep 2026", `Task number ${i + 1} with a reasonably long description to force wrapping in the table cell`, "BNM", "2h 15m"]);
    const bytes = buildPdf({ app: "Rais Timesheet", title: "Timesheet Summary", subtitle: "BNM Project", period: "01 September 2026 – 30 September 2026", generated_by: "Rais", generated_at: "2026-09-04 10:00", kpis: [{ label: "Total work", value: "174h 30m" }, { label: "Tasks", value: "86" }], sections: [{ title: "Detailed Timesheets", columns: [{ header: "Ref", width: 1.4 }, { header: "Date", width: 1.2 }, { header: "Task", width: 4 }, { header: "Project", width: 1 }, { header: "Duration", width: 1, align: "right" }], rows, totals: ["Total", "", "80 entries", "", "180h"] }] });
    const text = new TextDecoder("latin1").decode(bytes);
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("/Type /Catalog");
    expect(text.trim().endsWith("%%EOF")).toBe(true);
    const pages = (text.match(/\/Type \/Page\b/g) ?? []).length;
    expect(pages).toBeGreaterThan(1);
    expect(text).toContain(`Page 1 of ${pages}`);
    expect(text).toContain("Helvetica-Bold");
  });
});

describe("Crypto helpers", () => {
  it("hashes and verifies passwords", async () => {
    const h = await hashPassword("Demo1234!!");
    expect(h.startsWith("pbkdf2$")).toBe(true);
    expect(await verifyPassword("Demo1234!!", h)).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
    expect(await verifyPassword("x", "garbage")).toBe(false);
  });
  it("encrypts and decrypts tokens with AES-GCM", async () => {
    const ct = await encryptString("refresh-token-value", "secret-key");
    expect(ct).not.toContain("refresh-token-value");
    expect(await decryptString(ct, "secret-key")).toBe("refresh-token-value");
    await expect(decryptString(ct, "other-key")).rejects.toBeTruthy();
  });
  it("compares secrets in constant time", async () => {
    expect(await timingSafeEqualString("abc", "abc")).toBe(true);
    expect(await timingSafeEqualString("abc", "abd")).toBe(false);
  });
});
