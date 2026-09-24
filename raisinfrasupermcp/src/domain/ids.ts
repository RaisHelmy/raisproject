let counter = 0;
export function newId(prefix = "id"): string {
  counter += 1;
  const rand = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${rand}${counter.toString(36)}`;
}
export function nowIso(): string { return new Date().toISOString(); }
export function minutesAgo(m: number, from = Date.now()): string { return new Date(from - m * 60_000).toISOString(); }
export function hoursAgo(h: number, from = Date.now()): string { return minutesAgo(h * 60, from); }
export function daysAgo(d: number, from = Date.now()): string { return hoursAgo(d * 24, from); }
export function hash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) { h ^= input.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16).padStart(8, "0");
}
