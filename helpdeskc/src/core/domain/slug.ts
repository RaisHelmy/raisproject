// CLAUDE.md §6: lowercase alphanumeric plus hyphens, 3-40 chars, immutable after creation.
const SLUG_PATTERN = /^[a-z0-9]([a-z0-9-]{1,38})[a-z0-9]$/;

// Anything the platform itself uses, plus common infra/service names.
// Checked at creation only — slugs are immutable afterward.
export const RESERVED_SLUGS = new Set([
  "www", "api", "app", "admin", "mail", "smtp", "status", "cdn", "assets",
  "static", "help", "support", "docs", "blog", "dev", "staging", "test",
  "helpdeskc", "billing", "portal", "dashboard", "console", "auth", "login",
  "ftp", "ns1", "ns2", "mx", "webmail", "autodiscover",
]);

export class InvalidSlugError extends Error {
  readonly code = "domain.invalid_slug";
  constructor(readonly reason: "format" | "reserved") {
    super(reason === "format" ? "Slug must be 3-40 lowercase alphanumeric characters or hyphens" : "Slug is reserved");
  }
}

export function validateSlug(slug: string): void {
  if (!SLUG_PATTERN.test(slug)) {
    throw new InvalidSlugError("format");
  }
  if (RESERVED_SLUGS.has(slug)) {
    throw new InvalidSlugError("reserved");
  }
}

export function isValidSlug(slug: string): boolean {
  try {
    validateSlug(slug);
    return true;
  } catch {
    return false;
  }
}
