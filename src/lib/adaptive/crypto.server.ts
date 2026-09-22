const encoder = new TextEncoder();
export function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
export function unbase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
}
export function nonce(): string {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}
export async function digest(value: string): Promise<string> {
  return base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
}
async function key(): Promise<CryptoKey> {
  const value = process.env.ADAPTIVE_TOKEN_KEY;
  if (!value) throw new Error("Email encryption is not configured.");
  const bytes = unbase64(value);
  if (bytes.length !== 32) throw new Error("ADAPTIVE_TOKEN_KEY must be a 32-byte base64 key.");
  return crypto.subtle.importKey("raw", bytes as BufferSource, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}
export async function encrypt(value: unknown, owner: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(owner) },
    await key(),
    encoder.encode(JSON.stringify(value)),
  );
  return `${base64url(iv)}.${base64url(new Uint8Array(encrypted))}`;
}
export async function decrypt<T>(value: string, owner: string): Promise<T> {
  const [iv, body] = value.split(".");
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: unbase64(iv) as BufferSource, additionalData: encoder.encode(owner) },
    await key(),
    unbase64(body) as BufferSource,
  );
  return JSON.parse(new TextDecoder().decode(plain));
}
