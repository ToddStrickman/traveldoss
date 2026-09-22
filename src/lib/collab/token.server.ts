/**
 * Invite tokens: random at rest nowhere, hashed in the database.
 *
 * R8 — a token is single-use, bound to one address, hashed at rest, and
 * expires. Only the hash is stored, so a database read can never replay an
 * invite link.
 */

const ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** 32 characters of URL-safe randomness (~190 bits). */
export function newInviteToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

export async function hashInviteToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Lower-cased, trimmed address — the identity an invite is bound to. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
