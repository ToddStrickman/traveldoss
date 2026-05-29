import { createFileRoute } from "@tanstack/react-router";
import { getCookie, deleteCookie } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/google/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const err = url.searchParams.get("error");
        const origin = url.origin;

        if (err) return redirectBack(origin, "error", err);
        if (!code || !state) return redirectBack(origin, "error", "missing_code");

        const cookieState = getCookie("td_oauth_state");
        const uid = getCookie("td_oauth_uid");
        deleteCookie("td_oauth_state", { path: "/" });
        deleteCookie("td_oauth_uid", { path: "/" });

        if (!cookieState || cookieState !== state) {
          return redirectBack(origin, "error", "bad_state");
        }
        if (!uid) return redirectBack(origin, "error", "no_session");

        const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
        if (!clientId || !clientSecret) {
          return redirectBack(origin, "error", "server_misconfigured");
        }

        const redirectUri = `${origin}/api/google/callback`;
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
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

        if (!tok.refresh_token) {
          // Google only sends a refresh_token on first consent. Force it via prompt=consent in start.
          return redirectBack(origin, "error", "no_refresh_token");
        }

        // Best-effort decode of id_token email
        let email: string | null = null;
        if (tok.id_token) {
          try {
            const payload = JSON.parse(
              Buffer.from(tok.id_token.split(".")[1], "base64").toString("utf8"),
            );
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
      },
    },
  },
});

function redirectBack(origin: string, status: "connected" | "error", msg?: string) {
  const u = new URL("/app", origin);
  u.searchParams.set("drive", status);
  if (msg) u.searchParams.set("msg", msg);
  return new Response(null, { status: 302, headers: { Location: u.toString() } });
}