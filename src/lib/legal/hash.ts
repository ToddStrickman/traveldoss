/**
 * FNV-1a 64-bit content fingerprint, hex-encoded.
 *
 * Chosen over crypto.subtle SHA-256 because it is synchronous (usable at
 * module init on both server and client) and dependency-free. This is an
 * integrity fingerprint binding an acceptance record to the exact document
 * text — not a security primitive.
 */
export function contentHash(text: string): string {
  // Normalize line endings so the hash is identical across git autocrlf
  // checkouts (Windows CRLF vs. LF would otherwise change every hash).
  const normalized = text.replace(/\r\n/g, "\n");
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let i = 0; i < normalized.length; i++) {
    hash ^= BigInt(normalized.charCodeAt(i));
    hash = (hash * prime) & mask;
  }
  return "fnv1a64-" + hash.toString(16).padStart(16, "0");
}
