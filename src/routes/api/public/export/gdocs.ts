import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Block } from "@/lib/skins/types";

const Body = z.object({ slug: z.string().min(1).max(128) });

export const Route = createFileRoute("/api/public/export/gdocs")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = Body.safeParse(await request.json().catch(() => ({})));
        if (!parsed.success) return json({ error: "Invalid body" }, 400);

        // Look up the trip via admin (the user owns it through the slug).
        const { data: trip, error } = await supabaseAdmin
          .from("trips")
          .select("user_id, destination, subtitle, content")
          .eq("slug", parsed.data.slug)
          .maybeSingle();
        if (error || !trip) return json({ error: "Trip not found" }, 404);

        // Use the user's stored Google OAuth token (Drive/Docs scope already
        // granted via the existing /api/public/google/start flow).
        const { data: tok } = await supabaseAdmin
          .from("google_tokens")
          .select("access_token, refresh_token, expires_at, scope")
          .eq("user_id", trip.user_id)
          .maybeSingle();
        if (!tok) return json({ error: "Connect Google first" }, 412);
        if (!tok.scope?.includes("documents")) {
          return json({ error: "Google account is missing Docs scope" }, 412);
        }

        const accessToken = await ensureFreshToken(tok);
        const docId = await createDoc(accessToken, String(trip.destination ?? "TravelDoss"));
        const blocks = (trip.content as { blocks?: Block[] } | null)?.blocks ?? [];
        await fillDoc(accessToken, docId, blocks);
        const docUrl = `https://docs.google.com/document/d/${docId}/edit`;

        await supabaseAdmin
          .from("trips")
          .update({ doc_id: docId, doc_url: docUrl })
          .eq("slug", parsed.data.slug);

        return json({ ok: true, docUrl });
      },
    },
  },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type Tok = { access_token: string; refresh_token: string; expires_at: string };
async function ensureFreshToken(tok: Tok): Promise<string> {
  const exp = new Date(tok.expires_at).getTime();
  if (exp - Date.now() > 60_000) return tok.access_token;
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Google OAuth not configured");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tok.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Token refresh failed (${res.status})`);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  return j.access_token;
}

async function createDoc(token: string, title: string): Promise<string> {
  const res = await fetch("https://docs.googleapis.com/v1/documents", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ title: `${title} — TravelDoss` }),
  });
  if (!res.ok) throw new Error(`Docs create failed (${res.status}): ${await res.text()}`);
  const j = (await res.json()) as { documentId: string };
  return j.documentId;
}

async function fillDoc(token: string, docId: string, blocks: Block[]) {
  type Req = Record<string, unknown>;
  const requests: Req[] = [];
  let index = 1;

  function insertText(text: string, style?: "HEADING_1" | "HEADING_2" | "HEADING_3" | "NORMAL_TEXT") {
    if (!text) return;
    const withNewline = text + "\n";
    const start = index;
    requests.push({ insertText: { location: { index: start }, text: withNewline } });
    if (style && style !== "NORMAL_TEXT") {
      requests.push({
        updateParagraphStyle: {
          range: { startIndex: start, endIndex: start + withNewline.length - 1 },
          paragraphStyle: { namedStyleType: style },
          fields: "namedStyleType",
        },
      });
    }
    index += withNewline.length;
  }

  for (const b of blocks) {
    switch (b.kind) {
      case "hero":
        insertText(b.title, "HEADING_1");
        if (b.subtitle) insertText(b.subtitle);
        break;
      case "section":
        insertText(b.title, "HEADING_2");
        break;
      case "paragraph":
        insertText(b.text);
        break;
      case "day":
        insertText(`Day ${b.n} — ${b.label}`, "HEADING_2");
        if (b.notes) insertText(b.notes);
        break;
      case "place":
        insertText(b.name, "HEADING_3");
        if (b.address) insertText(b.address);
        if (b.note) insertText(b.note);
        break;
      case "flight":
        insertText(`${b.airline ?? "Flight"} ${b.flightNumber ?? ""}`, "HEADING_3");
        insertText([b.from, b.to].filter(Boolean).join(" → "));
        if (b.confirmation) insertText(`Confirmation ${b.confirmation}`);
        break;
      case "quote":
        insertText(`"${b.text}"${b.attribution ? ` — ${b.attribution}` : ""}`);
        break;
      case "note":
        insertText(b.text);
        break;
    }
  }

  if (!requests.length) return;
  const res = await fetch(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ requests }),
  });
  if (!res.ok) throw new Error(`Docs batchUpdate failed (${res.status}): ${await res.text()}`);
}