import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SCOPES = [
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/drive.file",
  "openid",
  "email",
  "profile",
].join(" ");

function redirectBack(origin: string, status: "connected" | "error", msg?: string) {
  const u = new URL("/app", origin);
  u.searchParams.set("drive", status);
  if (msg) u.searchParams.set("msg", msg);
  return new Response(null, { status: 302, headers: { Location: u.toString() } });
}

const CALLBACK_PATH = "/api/public/google/callback";

function b64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}

function getStateSecret(): string {
  const s = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!s) throw new Error("Missing GOOGLE_OAUTH_CLIENT_SECRET");
  return s;
}

async function signState(payload: {
  uid: string;
  origin: string;
  exp: number;
}): Promise<string> {
  const body = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getStateSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(body) as unknown as BufferSource,
  );
  return `${body}.${b64url(sig)}`;
}

async function verifyState(state: string): Promise<{ uid: string; origin: string } | null> {
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getStateSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const ok = await crypto.subtle.verify(
    "HMAC",
    key,
    b64urlDecode(sig) as unknown as BufferSource,
    new TextEncoder().encode(body) as unknown as BufferSource,
  );
  if (!ok) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body))) as {
      uid: string;
      origin: string;
      exp: number;
    };
    if (Date.now() > payload.exp) return null;
    return { uid: payload.uid, origin: payload.origin };
  } catch {
    return null;
  }
}

export async function buildGoogleAuthUrl(userId: string, origin: string): Promise<string> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) throw new Error("Missing GOOGLE_OAUTH_CLIENT_ID");
  const state = await signState({
    uid: userId,
    origin,
    exp: Date.now() + 10 * 60_000,
  });
  const redirectUri = `${origin}${CALLBACK_PATH}`;
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", SCOPES);
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("include_granted_scopes", "true");
  authUrl.searchParams.set("state", state);
  return authUrl.toString();
}

export function getGoogleCallbackPath(): string {
  return CALLBACK_PATH;
}

export async function handleGoogleOAuthCallback(request: Request, callbackPath: string) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");
  const origin = url.origin;

  if (err) return redirectBack(origin, "error", err);
  if (!code || !state) return redirectBack(origin, "error", "missing_code");
  const verified = await verifyState(state);
  if (!verified) return redirectBack(origin, "error", "bad_state");
  const uid = verified.uid;

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return redirectBack(origin, "error", "server_misconfigured");

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${origin}${callbackPath}`,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) {
    const t = await tokenRes.text();
    console.error("[google/callback] token exchange failed", tokenRes.status, t);
    return redirectBack(origin, "error", "token_exchange_failed");
  }

  const tok = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
    id_token?: string;
  };
  if (!tok.refresh_token) return redirectBack(origin, "error", "no_refresh_token");

  let email: string | null = null;
  if (tok.id_token) {
    try {
      const payload = JSON.parse(Buffer.from(tok.id_token.split(".")[1], "base64").toString("utf8"));
      email = payload?.email ?? null;
    } catch {
      /* ignore */
    }
  }

  const expiresAt = new Date(Date.now() + tok.expires_in * 1000).toISOString();
  const { error: upErr } = await supabaseAdmin.from("google_tokens").upsert(
    {
      user_id: uid,
      access_token: tok.access_token,
      refresh_token: tok.refresh_token,
      expires_at: expiresAt,
      scope: tok.scope,
      google_email: email,
    },
    { onConflict: "user_id" },
  );
  if (upErr) {
    console.error("[google/callback] db upsert failed", upErr);
    return redirectBack(origin, "error", "db_failed");
  }

  return redirectBack(origin, "connected");
}