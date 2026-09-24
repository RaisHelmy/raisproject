import { describe, expect, test } from "bun:test";
import { validateUploadRequest, sniffContentType, contentTypeMatchesExtension, extensionOf, MAX_ATTACHMENT_BYTES } from "../../src/core/attachments/policy";
import { ValidationError } from "../../src/core/errors";

describe("validateUploadRequest", () => {
  test("accepts an allowed extension within the size limit", () => {
    const result = validateUploadRequest("screenshot.png", 1024);
    expect(result).toEqual({ extension: ".png", expectedContentType: "image/png" });
  });

  test("rejects a disallowed extension", () => {
    expect(() => validateUploadRequest("payload.exe", 1024)).toThrow(ValidationError);
  });

  test("rejects an oversized file", () => {
    expect(() => validateUploadRequest("big.png", MAX_ATTACHMENT_BYTES + 1)).toThrow(ValidationError);
  });

  test("rejects a path-traversal filename", () => {
    expect(() => validateUploadRequest("../../etc/passwd.png", 100)).toThrow(ValidationError);
  });
});

describe("sniffContentType", () => {
  test("recognises a PNG signature", () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]);
    expect(sniffContentType(bytes)).toBe("image/png");
  });

  test("recognises a PDF signature", () => {
    const bytes = new TextEncoder().encode("%PDF-1.4 rest of file");
    expect(sniffContentType(bytes)).toBe("application/pdf");
  });

  test("treats plain text as text/plain", () => {
    const bytes = new TextEncoder().encode("2026-01-01 error: something broke\n");
    expect(sniffContentType(bytes)).toBe("text/plain");
  });

  test("rejects bytes disguised as text but containing a script tag", () => {
    const bytes = new TextEncoder().encode("<script>alert(1)</script>");
    expect(sniffContentType(bytes)).toBeNull();
  });

  test("rejects binary garbage that matches no known signature", () => {
    const bytes = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    expect(sniffContentType(bytes)).toBeNull();
  });
});

describe("contentTypeMatchesExtension", () => {
  test("a PNG extension claiming to be a PDF is rejected — the .png extension check itself", () => {
    expect(contentTypeMatchesExtension("application/pdf", ".png")).toBe(false);
  });
  test("matching sniff and extension passes", () => {
    expect(contentTypeMatchesExtension("image/png", ".png")).toBe(true);
  });
  test("csv/txt both accept sniffed text/plain", () => {
    expect(contentTypeMatchesExtension("text/plain", ".csv")).toBe(true);
    expect(contentTypeMatchesExtension("text/plain", ".txt")).toBe(true);
  });
});

describe("extensionOf", () => {
  test("extracts a lowercase extension", () => {
    expect(extensionOf("Report.PDF")).toBe(".pdf");
  });
  test("null when there is no extension", () => {
    expect(extensionOf("noextension")).toBeNull();
  });
});
