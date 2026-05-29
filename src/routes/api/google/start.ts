import { createFileRoute } from "@tanstack/react-router";
import { setCookie } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";

const SCOPES = [
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/drive.file",
  "openid",
  "email",
  "profile",
].join(" ");

export const Route = createFileRoute("/api/google/start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
        const supaUrl = process.env.SUPABASE_URL;
        const supaKey = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!clientId) return new Response("Missing GOOGLE_OAUTH_CLIENT_ID", { status: 500 });
        if (!supaUrl || !supaKey) return new Response("Supabase env missing", { status: 500 });

        // Verify user is signed in via the auth header attached by attachSupabaseAuth.
        // For browser-initiated navigation there is no header, so fall back to the
        // Supabase access token cookie set by the SDK on the client. To keep this
        // robust we require a valid bearer token in the `sb-access-token` query
        // param OR an Authorization header.
        const authHeader =
          request.headers.get("authorization") ??
          (new URL(request.url).searchParams.get("token")
            ? `Bearer ${new URL(request.url).searchParams.get("token")}`
            : null);
        if (!authHeader) {
          // Bounce through a tiny client page that attaches the token then redirects.
          return new Response(bouncerHtml(), {
            status: 200,
            headers: { "content-type": "text/html; charset=utf-8" },
          });
        }

        const supabase = createClient(supaUrl, supaKey, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) return new Response("Unauthorized", { status: 401 });

        const origin = new URL(request.url).origin;
        const redirectUri = `${origin}/api/google/callback`;
        const state = crypto.randomUUID();

        setCookie("td_oauth_state", state, {
          httpOnly: true,
          secure: true,
          sameSite: "lax",
          path: "/",
          maxAge: 600,
        });
        setCookie("td_oauth_uid", data.user.id, {
          httpOnly: true,
          secure: true,
          sameSite: "lax",
          path: "/",
          maxAge: 600,
        });

        const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
        authUrl.searchParams.set("client_id", clientId);
        authUrl.searchParams.set("redirect_uri", redirectUri);
        authUrl.searchParams.set("response_type", "code");
        authUrl.searchParams.set("scope", SCOPES);
        authUrl.searchParams.set("access_type", "offline");
        authUrl.searchParams.set("prompt", "consent");
        authUrl.searchParams.set("include_granted_scopes", "true");
        authUrl.searchParams.set("state", state);

        return new Response(null, {
          status: 302,
          headers: { Location: authUrl.toString() },
        });
      },
    },
  },
});

function bouncerHtml() {
  return `<!doctype html><html><body>
<script>
(async () => {
  try {
    const raw = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
    if (!raw) { location.href = '/login'; return; }
    const parsed = JSON.parse(localStorage.getItem(raw));
    const token = parsed?.access_token;
    if (!token) { location.href = '/login'; return; }
    location.href = '/api/google/start?token=' + encodeURIComponent(token);
  } catch (e) { location.href = '/login'; }
})();
</script>
Redirecting…</body></html>`;
}