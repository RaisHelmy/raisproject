export function uuid(): string { return crypto.randomUUID(); }
export function correlationId(prefix = "req"): string { return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`; }
export function slugify(s: string): string { return s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9一-鿿]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || `org-${correlationId("").slice(1, 9)}`; }
