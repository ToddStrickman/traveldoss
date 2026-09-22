import type { EmailProviderAdapter } from "./providers";
import type { EmailSyncState, ImportedEmailMessage, ScanScope } from "./types";
import { unbase64 } from "./crypto.server";

export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
export type GmailTokens = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  scope?: string;
};
export function gmailConfig() {
  const clientId = process.env.GMAIL_CLIENT_ID,
    clientSecret = process.env.GMAIL_CLIENT_SECRET,
    redirectUri = process.env.GMAIL_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri || !process.env.ADAPTIVE_TOKEN_KEY)
    throw new Error(
      "Gmail connection is not configured yet. Add Gmail OAuth and email encryption settings on the server.",
    );
  return { clientId, clientSecret, redirectUri };
}
export async function exchangeCode(code: string, verifier: string): Promise<GmailTokens> {
  const c = gmailConfig();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      code,
      code_verifier: verifier,
      client_id: c.clientId,
      client_secret: c.clientSecret,
      redirect_uri: c.redirectUri,
      grant_type: "authorization_code",
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok)
    throw new Error("Google could not complete authorization. Please reconnect Gmail.");
  const data = await response.json();
  if (
    !data.refresh_token ||
    !String(data.scope ?? "")
      .split(" ")
      .includes(GMAIL_SCOPE)
  )
    throw new Error(
      "Gmail read permission and offline access are required. Please reconnect and grant email access.",
    );
  return { ...data, expires_at: Date.now() + Number(data.expires_in) * 1000 };
}
export function scanQuery(scope: ScanScope, connectedAt: string) {
  const since =
    Math.floor(Date.parse(connectedAt) / 1000) -
    (scope === "30" ? 30 : scope === "90" ? 90 : 0) * 86400;
  const travel =
    "{flight itinerary reservation booking hotel airline train rail ferry transfer parking tour ticket visa insurance cancellation cancelled canceled refund}";
  return scope === "all" ? travel : `${travel} after:${since}`;
}
function htmlText(html: string): string {
  return html
    .replace(/<(script|style|blockquote)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?\s*>|<\/p>|<\/div>|<\/tr>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
interface GmailPart {
  headers?: { name: string; value: string }[];
  body?: { data?: string };
  filename?: string;
  mimeType?: string;
  parts?: GmailPart[];
}
interface GmailMessage {
  id: string;
  internalDate: string;
  payload?: GmailPart;
}
export function decodeMessage(raw: GmailMessage, accountId: string): ImportedEmailMessage {
  const headers: Record<string, string> = {};
  for (const h of raw.payload?.headers ?? []) {
    const key = String(h.name).toLowerCase();
    if (!(key in headers)) headers[key] = h.value;
  }
  const texts: string[] = [],
    htmls: string[] = [],
    attachments: NonNullable<ImportedEmailMessage["attachments"]> = [];
  const visit = (part: GmailPart, depth = 0) => {
    if (depth > 12) return;
    const content = part.body?.data ? new TextDecoder().decode(unbase64(part.body.data)) : "";
    if (part.filename)
      attachments.push({
        name: String(part.filename).slice(0, 240),
        mimeType: part.mimeType ?? "application/octet-stream",
        ...(part.mimeType === "text/plain" && content ? { text: content.slice(0, 20_000) } : {}),
      });
    else if (part.mimeType === "text/plain") texts.push(content);
    else if (part.mimeType === "text/html") htmls.push(content);
    for (const child of part.parts ?? []) visit(child, depth + 1);
  };
  visit(raw.payload ?? {});
  const sender = headers.from ?? "Unknown sender",
    domain = /@([^>\s]+)/.exec(sender)?.[1]?.toLowerCase();
  // Google-added Authentication-Results must show DMARC pass aligned with the From domain.
  const auth = headers["authentication-results"] ?? "";
  const aligned =
    !!domain &&
    /\bmx\.google\.com;/.test(auth) &&
    /\bdmarc=pass\b/.test(auth) &&
    new RegExp(
      `header\\.from=${domain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:[;\\s]|$)`,
      "i",
    ).test(auth);
  return {
    id: String(raw.id),
    accountId,
    provider: "gmail",
    receivedAt: new Date(Number(raw.internalDate)).toISOString(),
    subject: (headers.subject ?? "Untitled message").slice(0, 240),
    sender,
    text: (texts.join("\n") || htmlText(htmls.join("\n"))).slice(0, 100_000),
    html: htmls.join("\n").slice(0, 250_000),
    authenticatedSender: aligned,
    attachments,
  };
}
export class GmailAdapter implements EmailProviderAdapter {
  constructor(
    private tokens: GmailTokens,
    private saveTokens: (tokens: GmailTokens) => Promise<void>,
  ) {}
  private async accessToken() {
    if (this.tokens.expires_at > Date.now() + 60_000) return this.tokens.access_token;
    const c = gmailConfig();
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: this.tokens.refresh_token,
        client_id: c.clientId,
        client_secret: c.clientSecret,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!r.ok)
      throw new Error("Gmail authorization expired or was revoked. Reconnect your account.");
    const fresh = await r.json();
    this.tokens = {
      ...this.tokens,
      access_token: fresh.access_token,
      expires_at: Date.now() + fresh.expires_in * 1000,
    };
    await this.saveTokens(this.tokens);
    return this.tokens.access_token;
  }
  private async get(path: string) {
    const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
      headers: { Authorization: `Bearer ${await this.accessToken()}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!r.ok) {
      const error = new Error(
        r.status === 429
          ? "Gmail rate limit reached; sync will retry."
          : `Gmail request failed (${r.status}).`,
      );
      Object.assign(error, { status: r.status });
      throw error;
    }
    return r.json();
  }
  async profile() {
    const p = await this.get("profile");
    return { email: p.emailAddress, historyId: p.historyId };
  }
  async scan(state: EmailSyncState): Promise<{ ids: string[]; next: EmailSyncState }> {
    const next = { ...state };
    if (state.scanning) {
      if (!next.baselineHistoryId) next.baselineHistoryId = (await this.profile()).historyId;
      const params = new URLSearchParams({
        q: scanQuery(state.scope, state.connectedAt),
        maxResults: "20",
      });
      if (state.pageToken) params.set("pageToken", state.pageToken);
      const page = await this.get(`messages?${params}`);
      next.pageToken = page.nextPageToken;
      if (!page.nextPageToken) {
        next.scanning = false;
        next.historyId = next.baselineHistoryId;
        next.baselineHistoryId = undefined;
      }
      return { ids: (page.messages ?? []).map((m: { id: string }) => String(m.id)), next };
    }
    if (!state.historyId)
      throw new Error("Gmail sync cursor is missing. Reconnect to recover safely.");
    const params = new URLSearchParams({
      startHistoryId: state.historyId,
      historyTypes: "messageAdded",
      maxResults: "20",
    });
    if (state.pageToken) params.set("pageToken", state.pageToken);
    try {
      const page = await this.get(`history?${params}`);
      next.pageToken = page.nextPageToken;
      // Commit the final historyId only after every page is durably reconciled.
      if (!page.nextPageToken) next.historyId = page.historyId;
      return {
        ids: [
          ...new Set<string>(
            (page.history ?? []).flatMap((h: { messagesAdded?: { message: { id: string } }[] }) =>
              (h.messagesAdded ?? []).map((m) => String(m.message.id)),
            ),
          ),
        ],
        next,
      };
    } catch (e) {
      if ((e as { status?: number }).status !== 404) throw e;
      // Recover within the originally authorized scan boundary; never widen "new only" to all mail.
      return this.scan({
        ...state,
        scanning: true,
        pageToken: undefined,
        baselineHistoryId: undefined,
      });
    }
  }
  async message(id: string, accountId: string) {
    return decodeMessage(
      await this.get(`messages/${encodeURIComponent(id)}?format=full`),
      accountId,
    );
  }
  async revoke() {
    const r = await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      body: new URLSearchParams({ token: this.tokens.refresh_token }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!r.ok && r.status !== 400)
      throw new Error(
        "Google could not revoke access. Retry, or revoke TravelDoss in your Google Account permissions.",
      );
  }
}
