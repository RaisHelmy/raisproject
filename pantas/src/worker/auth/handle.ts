const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I ambiguity

function randomCode(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

const PREFIX_BY_ROLE: Record<string, string> = {
  purchaser: "Buyer",
  runner: "Runner",
  vendor: "Vendor",
  admin: "Admin",
};

/** Anonymity-facing display handle, e.g. "Runner #A72K". Never derived from real identity. */
export function generateHandle(role: string): string {
  const prefix = PREFIX_BY_ROLE[role] ?? "User";
  return `${prefix} #${randomCode(4)}`;
}
