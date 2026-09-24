export function nowIso(): string { return new Date().toISOString(); }
export function iso(d: Date | string | null | undefined): string | null { if (!d) return null; return d instanceof Date ? d.toISOString() : new Date(d).toISOString(); }
export function startOfUtcDay(d = new Date()): Date { return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); }
export function daysAgo(n: number): Date { return new Date(Date.now() - n * 86_400_000); }
