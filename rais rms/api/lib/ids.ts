export function newId(): string {
  return crypto.randomUUID();
}

export function now(): number {
  return Date.now();
}

/** Human-typeable temp password/token, e.g. for staff invites and public magic links. */
export function generateToken(bytes = 16): string {
  const arr = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}
