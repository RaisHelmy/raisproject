import { ValidationError } from "../errors";

// Screenshots, logs, invoices — the proof Contacts attach to tickets
// (CLAUDE.md §11). Deliberately narrow; widen only on request.
export const ALLOWED_EXTENSIONS: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".log": "text/plain",
  ".csv": "text/csv",
};

export const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024; // 15 MB

/** Extracts a safe, lowercase extension (with leading dot) from a filename, or null if none. */
export function extensionOf(filename: string): string | null {
  const match = /\.[a-z0-9]+$/i.exec(filename);
  return match ? match[0].toLowerCase() : null;
}

/**
 * Validated server-side before issuing a presigned URL (CLAUDE.md §11).
 * The client's declared filename/contentType are never trusted for
 * anything beyond picking an extension to validate.
 */
export function validateUploadRequest(filename: string, sizeBytes: number): { extension: string; expectedContentType: string } {
  if (sizeBytes <= 0 || sizeBytes > MAX_ATTACHMENT_BYTES) {
    throw new ValidationError(`File must be between 1 byte and ${MAX_ATTACHMENT_BYTES} bytes`);
  }
  const extension = extensionOf(filename);
  if (!extension || !(extension in ALLOWED_EXTENSIONS)) {
    throw new ValidationError(`File type not allowed: ${extension ?? "(no extension)"}`);
  }
  // Reject path-traversal / non-plain filenames outright.
  if (filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
    throw new ValidationError("Invalid filename");
  }
  return { extension, expectedContentType: ALLOWED_EXTENSIONS[extension]! };
}

const MAGIC_BYTES: Array<{ sig: number[]; type: string }> = [
  { sig: [0x89, 0x50, 0x4e, 0x47], type: "image/png" },
  { sig: [0xff, 0xd8, 0xff], type: "image/jpeg" },
  { sig: [0x47, 0x49, 0x46, 0x38], type: "image/gif" },
  { sig: [0x25, 0x50, 0x44, 0x46], type: "application/pdf" },
];

/**
 * Sniffs actual content from bytes rather than trusting the declared MIME
 * type (CLAUDE.md §11). Text types (txt/log/csv) have no reliable magic
 * number, so they're accepted only if the bytes look like plain UTF-8 text
 * (no embedded HTML/script markers, no null bytes).
 */
export function sniffContentType(bytes: Uint8Array): string | null {
  for (const { sig, type } of MAGIC_BYTES) {
    if (bytes.length >= sig.length && sig.every((b, i) => bytes[i] === b)) return type;
  }
  const sample = bytes.subarray(0, Math.min(bytes.length, 4096));
  const looksBinary = sample.some((b) => b === 0);
  if (looksBinary) return null;
  const text = new TextDecoder("utf-8", { fatal: false }).decode(sample).toLowerCase();
  if (text.includes("<script") || text.includes("<svg") || text.includes("<!doctype html")) return null;
  return "text/plain";
}

/** Does the sniffed content type match what the extension promised? */
export function contentTypeMatchesExtension(sniffed: string | null, extension: string): boolean {
  const expected = ALLOWED_EXTENSIONS[extension];
  if (!expected || !sniffed) return false;
  if (expected === "text/plain" || expected === "text/csv") return sniffed === "text/plain";
  return sniffed === expected;
}
