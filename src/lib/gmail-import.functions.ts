import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { fetchWithRetry } from "@/lib/retry";

/**
 * Gmail → Google Doc preview pipeline.
 *
 * The workspace builder's Gmail account is the source (connector-owned),
 * not the end-user's inbox. Each generated Doc is attached to a trip via
 * `trip_doc_previews` and surfaced in the dossier as an embedded iframe.
 *
 * All three server fns require an authenticated app user; the connector
 * gateway is called with the project's LOVABLE_API_KEY + connector key.
 */

const GMAIL_GATEWAY = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";
const DOCS_GATEWAY = "https://connector-gateway.lovable.dev/google_docs/v1";

/* ─── helpers ───────────────────────────────────────────────────────── */

function gatewayHeaders(connectorKey: string) {
  const lovableKey = process.env.LOVABLE_API_KEY;
  if (!lovableKey) throw new Error("LOVABLE_API_KEY is not configured");
  if (!connectorKey) throw new Error("Gmail/Docs connector is not linked");
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": connectorKey,
    "Content-Type": "application/json",
  };
}

function decodeBase64Url(b64: string): string {
  const norm = b64.replace(/-/g, "+").replace(/_/g, "/");
  const pad = norm.length % 4 === 0 ? norm : norm + "=".repeat(4 - (norm.length % 4));
  // atob is available in the Worker runtime.
  const bin = atob(pad);
  // Decode as UTF-8.
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder("utf-8").decode(bytes);
}

type GmailPayload = {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPayload[];
  headers?: Array<{ name: string; value: string }>;
};

/** Extract the plain-text body from a Gmail message payload tree. */
function extractBody(payload: GmailPayload | undefined): string {
  if (!payload) return "";
  const collect = (p: GmailPayload, prefer: string): string => {
    if (p.mimeType === prefer && p.body?.data) return decodeBase64Url(p.body.data);
    if (p.parts) {
      for (const part of p.parts) {
        const found = collect(part, prefer);
        if (found) return found;
      }
    }
    return "";
  };
  const plain = collect(payload, "text/plain");
  if (plain) return plain;
  const html = collect(payload, "text/html");
  if (!html) return "";
  // Cheap HTML → text fallback for confirmation emails.
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function headerValue(headers: GmailPayload["headers"], name: string): string {
  if (!headers) return "";
  const h = headers.find((x) => x.name.toLowerCase() === name.toLowerCase());
  return h?.value ?? "";
}

/* ─── 1. list booking-confirmation candidates ───────────────────────── */

export const listBookingEmails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const key = process.env.GOOGLE_MAIL_API_KEY;
    if (!key) return { emails: [], error: "Gmail is not connected." };

    const q = encodeURIComponent(
      "category:travel OR subject:(confirmation OR itinerary OR booking OR reservation) newer_than:180d",
    );
    const listRes = await fetchWithRetry(
      `${GMAIL_GATEWAY}/users/me/messages?maxResults=25&q=${q}`,
      { headers: gatewayHeaders(key) },
    );
    if (!listRes.ok) {
      return {
        emails: [],
        error:
          `Gmail list failed (${listRes.status}): ${await listRes.text().catch(() => "")}`.slice(
            0,
            240,
          ),
      };
    }
    const list = (await listRes.json()) as {
      messages?: Array<{ id: string; threadId: string }>;
    };
    if (!list.messages?.length) return { emails: [], error: null };

    // Fetch metadata for each id (parallel, capped at 25).
    const details = await Promise.all(
      list.messages.slice(0, 25).map(async (m) => {
        const r = await fetchWithRetry(
          `${GMAIL_GATEWAY}/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
          { headers: gatewayHeaders(key) },
        );
        if (!r.ok) return null;
        const j = (await r.json()) as {
          id: string;
          snippet?: string;
          internalDate?: string;
          payload?: GmailPayload;
        };
        return {
          id: j.id,
          snippet: (j.snippet ?? "").slice(0, 200),
          subject: headerValue(j.payload?.headers, "Subject"),
          from: headerValue(j.payload?.headers, "From"),
          date: headerValue(j.payload?.headers, "Date"),
        };
      }),
    );
    return {
      emails: details.filter((d): d is NonNullable<typeof d> => d !== null),
      error: null,
    };
  });

/* ─── 2. import a single email → parse → create Google Doc ──────────── */

export const importBookingEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        messageId: z.string().min(1).max(200),
        tripId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const gmailKey = process.env.GOOGLE_MAIL_API_KEY;
    const docsKey = process.env.GOOGLE_DOCS_API_KEY;
    if (!gmailKey || !docsKey) {
      throw new Error("Gmail and Google Docs connectors must both be linked.");
    }

    // Idempotency: short-circuit if we've already imported this message.
    const { data: existing } = await supabase
      .from("trip_doc_previews")
      .select("id, google_doc_id, google_doc_url, trip_id")
      .eq("source_message_id", data.messageId)
      .maybeSingle();
    if (existing) {
      return {
        alreadyImported: true,
        docPreviewId: existing.id,
        googleDocId: existing.google_doc_id,
        googleDocUrl: existing.google_doc_url,
      };
    }

    // Verify trip ownership (RLS would block otherwise; check eagerly for nicer errors).
    const { data: trip, error: tripErr } = await supabase
      .from("trips")
      .select("id, destination, user_id")
      .eq("id", data.tripId)
      .maybeSingle();
    if (tripErr) throw new Error(tripErr.message);
    if (!trip) throw new Error("Trip not found");

    // 1. Pull full Gmail message via gateway.
    const msgRes = await fetchWithRetry(
      `${GMAIL_GATEWAY}/users/me/messages/${encodeURIComponent(data.messageId)}?format=full`,
      { headers: gatewayHeaders(gmailKey) },
    );
    if (!msgRes.ok) {
      throw new Error(
        `Failed to fetch Gmail message (${msgRes.status}): ${(await msgRes.text().catch(() => "")).slice(0, 200)}`,
      );
    }
    const msg = (await msgRes.json()) as {
      id: string;
      snippet?: string;
      payload?: GmailPayload;
    };
    const body = extractBody(msg.payload);
    const subject = headerValue(msg.payload?.headers, "Subject") || "Booking confirmation";
    if (!body || body.length < 30) {
      throw new Error("Email body was empty or too short to parse.");
    }

    // 2. Parse with the existing AI itinerary parser (reuse system prompt).
    const { parseItineraryAiCore } = await import("@/lib/itinerary/parse-ai.functions");
    const parsed = await parseItineraryAiCore({
      text: `${subject}\n\n${body}`.slice(0, 50_000),
      source: "text",
    });

    // 3. Create a Google Doc and write the parsed blocks into it.
    const title = `${trip.destination} — ${subject}`.slice(0, 180);
    const createRes = await fetchWithRetry(`${DOCS_GATEWAY}/documents`, {
      method: "POST",
      headers: gatewayHeaders(docsKey),
      body: JSON.stringify({ title }),
    });
    if (!createRes.ok) {
      throw new Error(
        `Google Docs create failed (${createRes.status}): ${(await createRes.text().catch(() => "")).slice(0, 200)}`,
      );
    }
    const docJson = (await createRes.json()) as {
      documentId: string;
      revisionId?: string;
    };
    const documentId = docJson.documentId;

    // 4. Build batchUpdate requests from blocks. Index 1 is the start of body.
    const requests = blocksToDocsRequests(parsed.blocks);
    if (requests.length > 0) {
      const updateRes = await fetchWithRetry(
        `${DOCS_GATEWAY}/documents/${documentId}:batchUpdate`,
        {
          method: "POST",
          headers: gatewayHeaders(docsKey),
          body: JSON.stringify({ requests }),
        },
      );
      if (!updateRes.ok) {
        // Best-effort: still record the empty doc so user can retry.
        console.error(
          "[gmail-import] batchUpdate failed:",
          updateRes.status,
          await updateRes.text().catch(() => ""),
        );
      }
    }

    const googleDocUrl = `https://docs.google.com/document/d/${documentId}/edit`;

    // 5. Persist via admin client (RLS allows owner, but we already verified).
    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from("trip_doc_previews")
      .insert({
        trip_id: data.tripId,
        user_id: userId,
        source: "gmail",
        source_message_id: data.messageId,
        google_doc_id: documentId,
        google_doc_url: googleDocUrl,
        status: "ready",
      })
      .select("id")
      .single();
    if (insertErr) throw new Error(insertErr.message);

    // 6. Promote to primary doc on the trip if it doesn't have one.
    await supabaseAdmin
      .from("trips")
      .update({ doc_id: documentId, doc_url: googleDocUrl })
      .eq("id", data.tripId)
      .is("doc_id", null);

    return {
      alreadyImported: false,
      docPreviewId: inserted.id,
      googleDocId: documentId,
      googleDocUrl,
    };
  });

/* ─── 3. list previews attached to a trip ──────────────────────────── */

export const listTripDocPreviews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ tripId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("trip_doc_previews")
      .select("id, google_doc_id, google_doc_url, source, source_message_id, status, created_at")
      .eq("trip_id", data.tripId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { previews: rows ?? [] };
  });

/* ─── Block[] → Google Docs batchUpdate translator ─────────────────── */

type DocsRequest =
  | { insertText: { location: { index: number }; text: string } }
  | {
      updateParagraphStyle: {
        range: { startIndex: number; endIndex: number };
        paragraphStyle: { namedStyleType: string };
        fields: string;
      };
    }
  | {
      updateTextStyle: {
        range: { startIndex: number; endIndex: number };
        textStyle: { bold?: boolean; italic?: boolean };
        fields: string;
      };
    };

type ParsedBlock = {
  kind: string;
  n?: number;
  label?: string;
  name?: string;
  category?: string;
  address?: string;
  phone?: string;
  website?: string;
  hours?: string;
  time?: string;
  note?: string;
  text?: string;
  airline?: string;
  flightNumber?: string;
  fromCity?: string;
  toCity?: string;
  departTime?: string;
  arriveTime?: string;
};

function blocksToDocsRequests(blocks: unknown[]): DocsRequest[] {
  const reqs: DocsRequest[] = [];
  let cursor = 1; // Google Docs body starts at index 1.

  const insertLine = (
    text: string,
    style?: { heading?: "TITLE" | "HEADING_1" | "HEADING_2"; bold?: boolean },
  ) => {
    if (!text) return;
    const line = `${text}\n`;
    const start = cursor;
    reqs.push({ insertText: { location: { index: cursor }, text: line } });
    cursor += line.length;
    if (style?.heading) {
      reqs.push({
        updateParagraphStyle: {
          range: { startIndex: start, endIndex: start + line.length - 1 },
          paragraphStyle: { namedStyleType: style.heading },
          fields: "namedStyleType",
        },
      });
    }
    if (style?.bold) {
      reqs.push({
        updateTextStyle: {
          range: { startIndex: start, endIndex: start + line.length - 1 },
          textStyle: { bold: true },
          fields: "bold",
        },
      });
    }
  };

  for (const raw of blocks) {
    const b = raw as ParsedBlock;
    switch (b.kind) {
      case "day":
        insertLine(`Day ${b.n ?? ""}${b.label ? ` — ${b.label}` : ""}`.trim(), {
          heading: "HEADING_1",
        });
        break;
      case "place": {
        const head = [b.time, b.name].filter(Boolean).join("  ");
        insertLine(head, { heading: "HEADING_2" });
        if (b.category) insertLine(`Type: ${b.category}`);
        if (b.address) insertLine(`Address: ${b.address}`);
        if (b.phone) insertLine(`Phone: ${b.phone}`);
        if (b.website) insertLine(`Website: ${b.website}`);
        if (b.hours) insertLine(`Hours: ${b.hours}`);
        if (b.note) insertLine(b.note);
        insertLine("");
        break;
      }
      case "flight": {
        const head = [b.airline, b.flightNumber].filter(Boolean).join(" ") || "Flight";
        insertLine(head, { heading: "HEADING_2" });
        const route = [b.fromCity, b.toCity].filter(Boolean).join(" → ");
        if (route) insertLine(route);
        const times = [b.departTime, b.arriveTime].filter(Boolean).join(" → ");
        if (times) insertLine(times);
        insertLine("");
        break;
      }
      case "paragraph":
      case "note":
        if (b.text) {
          insertLine(b.text);
          insertLine("");
        }
        break;
    }
  }

  return reqs;
}
