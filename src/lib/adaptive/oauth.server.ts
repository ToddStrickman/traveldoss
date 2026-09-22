import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";
import { adaptiveDb, checked, readState, requireTrip } from "./store.server";
import { decrypt, digest, encrypt, nonce } from "./crypto.server";
import { exchangeCode, GMAIL_SCOPE, gmailConfig, GmailAdapter } from "./gmail.server";
import type { ScanScope } from "./types";

const COOKIE = "td_gmail_state";
export async function beginGmail(
  userId: string,
  tripId: string,
  scope: ScanScope,
): Promise<string> {
  await requireTrip(userId, tripId);
  await readState(userId);
  const c = gmailConfig(),
    state = nonce(),
    verifier = nonce();
  checked(await adaptiveDb().from("adaptive_oauth_states").delete().eq("user_id", userId));
  checked(
    await adaptiveDb()
      .from("adaptive_oauth_states")
      .insert({
        state_hash: await digest(state),
        user_id: userId,
        encrypted_verifier: await encrypt(verifier, userId),
        scope,
        return_trip_id: tripId,
      }),
  );
  setCookie(COOKIE, state, {
    httpOnly: true,
    secure: c.redirectUri.startsWith("https:"),
    sameSite: "lax",
    path: "/api/adaptive/gmail/callback",
    maxAge: 600,
  });
  const params = new URLSearchParams({
    client_id: c.clientId,
    redirect_uri: c.redirectUri,
    response_type: "code",
    scope: GMAIL_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
    code_challenge: await digest(verifier),
    code_challenge_method: "S256",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}
export async function finishGmail(request: Request): Promise<Response> {
  const url = new URL(request.url),
    state = url.searchParams.get("state"),
    cookie = getCookie(COOKIE);
  deleteCookie(COOKIE, { path: "/api/adaptive/gmail/callback" });
  const redirect = (path: string) =>
    new Response(null, {
      status: 303,
      headers: { Location: path, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
    });
  if (!state || state.length > 256 || !cookie || (await digest(state)) !== (await digest(cookie)))
    return redirect("/app?gmail=error");
  // DELETE ... RETURNING consumes state atomically; expired states and replayed callbacks fail closed.
  const rows = checked(
    await adaptiveDb()
      .from("adaptive_oauth_states")
      .delete()
      .eq("state_hash", await digest(state))
      .gt("expires_at", new Date().toISOString())
      .select("*"),
  );
  const row = rows?.[0];
  if (!row) return redirect("/app?gmail=error");
  const back = `/app/dossier/${encodeURIComponent(row.return_trip_id)}`;
  if (url.searchParams.has("error") || !url.searchParams.get("code"))
    return redirect(`${back}?gmail=error`);
  try {
    await requireTrip(row.user_id, row.return_trip_id);
    const tokens = await exchangeCode(
      url.searchParams.get("code")!,
      await decrypt<string>(row.encrypted_verifier, row.user_id),
    );
    const adapter = new GmailAdapter(tokens, async () => {}),
      profile = await adapter.profile();
    const now = new Date().toISOString();
    const connected = checked(
      await adaptiveDb().rpc("adaptive_connect_account", {
        p_user_id: row.user_id,
        p_email: profile.email,
        p_tokens: await encrypt(tokens, row.user_id),
        p_sync: {
          scope: row.scope,
          connectedAt: now,
          historyId: row.scope === "new" ? profile.historyId : undefined,
          baselineHistoryId: row.scope === "new" ? undefined : profile.historyId,
          scanning: row.scope !== "new",
          processed: 0,
        },
      }),
    );
    if (!connected)
      throw new Error(
        "A sync or account-management operation is finishing. Reconnect in a moment.",
      );
    checked(
      await adaptiveDb()
        .from("adaptive_workspaces")
        .update({ next_run_at: now })
        .eq("user_id", row.user_id),
    );
    return redirect(`${back}?gmail=connected`);
  } catch {
    // Tokens, code, email contents, and upstream error bodies must never enter logs or query strings.
    return redirect(`${back}?gmail=error`);
  }
}
