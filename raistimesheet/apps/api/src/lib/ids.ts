export function uuid(): string {
  return crypto.randomUUID();
}

export function correlationId(prefix = "req"): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

/** Human readable error reference, e.g. SYNC-20260904-00182 */
export function errorReference(prefix: string, date = new Date()): string {
  const d = date.toISOString().slice(0, 10).replace(/-/g, "");
  const n = crypto.getRandomValues(new Uint32Array(1))[0]! % 100000;
  return `${prefix}-${d}-${String(n).padStart(5, "0")}`;
}
