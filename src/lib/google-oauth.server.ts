import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SCOPES = [
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/drive.file",
  "openid",
  "email",
  "profile",
].join(" ");

function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(/;\s*/)) {
    const i = part.indexOf("=");
    if (i === -1) continue;
    out[part.slice(0, i)] = decodeURIComponent(part.slice(i + 1));
  }
  return out;
}

function clearCookieHeaders(): string[] {
  return [
    "td_oauth_state=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax",
    "td_oauth_uid=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax",
  ];
}

function redirectBack(origin: string, status: "connected" | "error", msg?: string) {
  const u = new URL("/app", origin);
  u.searchParams.set("drive", status);
  if (msg) u.searchParams.set("msg", msg);
  const headers = new Headers({ Location: u.toString() });
  for (const c of clearCookieHeaders()) headers.append("Set-Cookie", c);
  return new Response(null, { status: 302, headers });
}

function bouncerHtml(startPath: string) {
  return `<!doctype html><html><body>
<script>
(async () => {
  try {
    const raw = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
    if (!raw) { location.href = '/login'; return; }
    const parsed = JSON.parse(localStorage.getItem(raw));
    const token = parsed?.access_token;
    if (!token) { location.href = '/login'; return; }
    location.href = '${startPath}?token=' + encodeURIComponent(token);
  } catch (e) { location.href = '/login'; }
})();
</script>
Redirecting…</body></html>`;
}

export async function handleGoogleOAuthStart(request: Request, startPath: string, callbackPath: string) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const supaUrl = process.env.SUPABASE_URL;
  const supaKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!clientId) return new Response("Missing GOOGLE_OAUTH_CLIENT_ID", { status: 500 });
  if (!supaUrl || !supaKey) return new Response("Backend env missing", { status: 500 });

  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const authHeader = request.headers.get("authorization") ?? (token ? `Bearer ${token}` : null);
  if (!authHeader) {
    return new Response(bouncerHtml(startPath), {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  const supabase = createClient(supaUrl, supaKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return new Response("Unauthorized", { status: 401 });

  const redirectUri = `${url.origin}${callbackPath}`;
  const state = crypto.randomUUID();
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", SCOPES);
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("include_granted_scopes", "true");
  authUrl.searchParams.set("state", state);

  const headers = new Headers({ Location: authUrl.toString() });
  headers.append(
    "Set-Cookie",
    `td_oauth_state=${state}; Path=/; Max-Age=600; HttpOnly; Secure; SameSite=Lax`,
  );
  headers.append(
    "Set-Cookie",
    `td_oauth_uid=${data.user.id}; Path=/; Max-Age=600; HttpOnly; Secure; SameSite=Lax`,
  );
  return new Response(null, { status: 302, headers });
}

export async function handleGoogleOAuthCallback(request: Request, callbackPath: string) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");
  const origin = url.origin;

  const cookies = parseCookies(request.headers.get("cookie"));
  const cookieState = cookies["td_oauth_state"];
  const uid = cookies["td_oauth_uid"];

  if (err) return redirectBack(origin, "error", err);
  if (!code || !state) return redirectBack(origin, "error", "missing_code");
  if (!cookieState || cookieState !== state) return redirectBack(origin, "error", "bad_state");
  if (!uid) return redirectBack(origin, "error", "no_session");

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