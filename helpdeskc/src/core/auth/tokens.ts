// Opaque bearer tokens (session cookies, magic links). Only the SHA-256
// hash is ever stored — never log or return the raw token (CLAUDE.md §5.5).
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function generateToken(bytes = 32): string {
  return toHex(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return toHex(new Uint8Array(digest));
}

export const SESSION_COOKIE_NAME = "hdc_session";
export const AGENT_SESSION_TTL_SECONDS = 60 * 60 * 12; // 12h
export const CONTACT_SESSION_TTL_SECONDS = 60 * 60 * 2; // 2h — shorter, per CLAUDE.md §7
export const MAGIC_LINK_TTL_SECONDS = 60 * 15; // 15 min, per CLAUDE.md §7
export const AGENT_INVITE_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days — an admin-initiated setup step, not urgent like a magic link
