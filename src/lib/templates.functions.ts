import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getTemplate, type DocBlock } from "@/lib/templates";
import { buildGoogleAuthUrl } from "@/lib/google-oauth.server";

async function getFreshGoogleToken(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("google_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;

  const expiresAt = new Date(data.expires_at).getTime();
  if (expiresAt - Date.now() > 60_000) return data.access_token;

  // Refresh
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: data.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;
  const tok = (await res.json()) as { access_token: string; expires_in: number };
  const newExpiresAt = new Date(Date.now() + tok.expires_in * 1000).toISOString();
  await supabaseAdmin
    .from("google_tokens")
    .update({ access_token: tok.access_token, expires_at: newExpiresAt })
    .eq("user_id", userId);
  return tok.access_token;
}

function blocksToBatchUpdate(blocks: DocBlock[]) {
  // Build a single batchUpdate sequence. Insert all text first at index 1,
  // tracking ranges for each block so we can apply paragraph styles after.
  const requests: unknown[] = [];
  let index = 1;
  const styled: { start: number; end: number; level?: 1 | 2 | 3 }[] = [];

  for (const b of blocks) {
    const text = b.text + "\n";
    requests.push({ insertText: { location: { index }, text } });
    const start = index;
    const end = index + text.length - 1; // exclude trailing newline span end
    if (b.kind === "heading") styled.push({ start, end, level: b.level });
    else styled.push({ start, end });
    index += text.length;
  }

  for (const s of styled) {
    if (!s.level) continue;
    const namedStyleType =
      s.level === 1 ? "HEADING_1" : s.level === 2 ? "HEADING_2" : "HEADING_3";
    requests.push({
      updateParagraphStyle: {
        range: { startIndex: s.start, endIndex: s.end },
        paragraphStyle: { namedStyleType },
        fields: "namedStyleType",
      },
    });
  }

  return requests;
}

export const listTemplatesPublic = createServerFn({ method: "GET" }).handler(async () => {
  // No-op — templates are static; client imports them directly.
  return { ok: true };
});

export const getGoogleAuthUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const req = getRequest();
    const origin = new URL(req.url).origin;
    const authUrl = await buildGoogleAuthUrl(context.userId, origin);
    return { authUrl };
  });

export const pickTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ templateId: z.string().min(1).max(64) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const template = getTemplate(data.templateId);
    if (!template) throw new Error("Unknown template");

    const accessToken = await getFreshGoogleToken(userId);
    if (!accessToken) {
      const req = getRequest();
      const origin = new URL(req.url).origin;
      const authUrl = await buildGoogleAuthUrl(userId, origin);
      return { needsGoogle: true as const, authUrl };
    }

    // 1. Create empty doc
    const today = new Date().toISOString().slice(0, 10);
    const createRes = await fetch("https://docs.googleapis.com/v1/documents", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: `${template.title} — ${today}` }),
    });
    if (!createRes.ok) {
      const t = await createRes.text();
      console.error("[pickTemplate] create doc failed", createRes.status, t);
      throw new Error("Failed to create Google Doc");
    }
    const doc = (await createRes.json()) as { documentId: string };

    // 2. Populate via batchUpdate
    const batchRes = await fetch(
      `https://docs.googleapis.com/v1/documents/${doc.documentId}:batchUpdate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ requests: blocksToBatchUpdate(template.doc) }),
      },
    );
    if (!batchRes.ok) {
      const t = await batchRes.text();
      console.error("[pickTemplate] batchUpdate failed", batchRes.status, t);
      // proceed anyway — doc exists, just empty
    }

    const docUrl = `https://docs.google.com/document/d/${doc.documentId}/edit`;

    // 3. Insert trip row
    const { data: trip, error } = await supabaseAdmin
      .from("trips")
      .insert({
        user_id: userId,
        destination: template.title,
        start_date: today,
        end_date: new Date(Date.now() + template.days * 86400_000)
          .toISOString()
          .slice(0, 10),
        doc_url: docUrl,
        doc_id: doc.documentId,
        status: "draft",
      })
      .select("id")
      .single();
    if (error) {
      console.error("[pickTemplate] trip insert failed", error);
      throw new Error("Failed to save trip");
    }

    return { needsGoogle: false as const, tripId: trip.id, docUrl };
  });