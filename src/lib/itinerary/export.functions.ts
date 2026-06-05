import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { fetchWithRetry } from "@/lib/retry";

/**
 * Export a dossier's blocks into a brand-new Google Doc using the
 * Google Docs connector. Each day renders as a morning/afternoon/
 * evening grid with venue links.
 */

const DOCS_GATEWAY = "https://connector-gateway.lovable.dev/google_docs/v1";

function gatewayHeaders() {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const docsKey = process.env.GOOGLE_DOCS_API_KEY;
  if (!lovableKey) throw new Error("LOVABLE_API_KEY is not configured");
  if (!docsKey) throw new Error("Google Docs connector is not linked");
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": docsKey,
    "Content-Type": "application/json",
  };
}

type AnyBlock = Record<string, unknown> & { kind: string };

/**
 * Stable idempotency key derived from the trip + its current block payload.
 * The same trip with the same blocks always yields the same key, so a retry
 * after a partial failure reuses the already-created Google Doc instead of
 * creating a duplicate.
 */
async function computeIdempotencyKey(
  tripId: string,
  blocks: AnyBlock[],
): Promise<string> {
  const payload = JSON.stringify({ tripId, blocks });
  const bytes = new TextEncoder().encode(payload);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `export:${tripId}:${hex.slice(0, 32)}`;
}

function bucketFor(time?: string): "morning" | "afternoon" | "evening" {
  if (!time) return "morning";
  const m = /^(\d{1,2})(?::(\d{2}))?/.exec(time.trim());
  if (!m) return "morning";
  const h = Number(m[1]);
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

export const exportItineraryToGoogleDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ slug: z.string().min(1).max(128) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: trip, error } = await supabase
      .from("trips")
      .select("id, destination, slug, content")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!trip) throw new Error("Trip not found");

    const blocks = (trip.content as { blocks?: AnyBlock[] } | null)?.blocks ?? [];
    if (!blocks.length) throw new Error("This dossier has no blocks to export yet.");

    /* ── Idempotency: short-circuit if this exact export already produced a doc. */
    const idempotencyKey = await computeIdempotencyKey(trip.id, blocks);
    const { data: existingExport } = await supabaseAdmin
      .from("trip_doc_previews")
      .select("id, google_doc_id, google_doc_url, status")
      .eq("user_id", userId)
      .eq("source_message_id", idempotencyKey)
      .maybeSingle();
    if (existingExport && existingExport.status === "ready") {
      return {
        googleDocId: existingExport.google_doc_id,
        googleDocUrl: existingExport.google_doc_url,
        reused: true as const,
      };
    }

    // Group places under their preceding day, bucketed by time-of-day.
    type Slot = "morning" | "afternoon" | "evening";
    type Day = {
      label: string;
      slots: Record<Slot, AnyBlock[]>;
    };
    const days: Day[] = [];
    let cur: Day | null = null;
    const ensureCur = () => {
      if (!cur) {
        cur = { label: "Day 1", slots: { morning: [], afternoon: [], evening: [] } };
        days.push(cur);
      }
      return cur;
    };
    for (const b of blocks) {
      if (b.kind === "day") {
        const n = (b as { n?: number }).n ?? days.length + 1;
        const label = (b as { label?: string }).label?.trim() || `Day ${n}`;
        cur = { label: `Day ${n} — ${label}`, slots: { morning: [], afternoon: [], evening: [] } };
        days.push(cur);
      } else if (b.kind === "place") {
        const day = ensureCur();
        day.slots[bucketFor((b as { time?: string }).time)].push(b);
      } else if (b.kind === "flight") {
        const day = ensureCur();
        day.slots.morning.push(b);
      }
    }

    // Create the doc.
    const title = `${trip.destination || "Itinerary"} — TravelDoss`.slice(0, 180);
    let documentId: string;
    let googleDocUrl: string;
    let reservationId: string | null = null;
    if (existingExport?.google_doc_id) {
      // A previous attempt created the doc but didn't finish writing. Reuse it.
      documentId = existingExport.google_doc_id;
      googleDocUrl = existingExport.google_doc_url;
      reservationId = existingExport.id;
      // Flip the row back to 'pending' so the cleanup sweep keeps tracking it
      // and concurrent retries see a fresh updated_at.
      await supabaseAdmin
        .from("trip_doc_previews")
        .update({ status: "pending" })
        .eq("id", reservationId);
      // Wipe any partial content left by the previous attempt so we don't
      // append duplicate sections on this retry.
      try {
        const getRes = await fetchWithRetry(
          `${DOCS_GATEWAY}/documents/${documentId}`,
          { headers: gatewayHeaders() },
        );
        if (getRes.ok) {
          const doc = (await getRes.json()) as {
            body?: { content?: Array<{ endIndex?: number }> };
          };
          const last = doc.body?.content?.[doc.body.content.length - 1];
          const endIndex = last?.endIndex ?? 1;
          if (endIndex > 2) {
            await fetchWithRetry(
              `${DOCS_GATEWAY}/documents/${documentId}:batchUpdate`,
              {
                method: "POST",
                headers: gatewayHeaders(),
                body: JSON.stringify({
                  requests: [
                    {
                      deleteContentRange: {
                        range: { startIndex: 1, endIndex: endIndex - 1 },
                      },
                    },
                  ],
                }),
              },
            );
          }
        }
      } catch (e) {
        console.warn("[export] could not clear reused doc, will append", e);
      }
    } else {
      const createRes = await fetchWithRetry(`${DOCS_GATEWAY}/documents`, {
        method: "POST",
        headers: gatewayHeaders(),
        body: JSON.stringify({ title }),
      });
      if (!createRes.ok) {
        throw new Error(
          `Google Docs create failed (${createRes.status}): ${(await createRes.text().catch(() => "")).slice(0, 200)}`,
        );
      }
      const docJson = (await createRes.json()) as { documentId: string };
      documentId = docJson.documentId;
      googleDocUrl = `https://docs.google.com/document/d/${documentId}/edit`;

      // Reserve the idempotency row in 'pending' state BEFORE writing content,
      // so a retry between create + batchUpdate reuses the same doc id.
      const { data: reserved, error: reserveErr } = await supabaseAdmin
        .from("trip_doc_previews")
        .insert({
          trip_id: trip.id,
          user_id: userId,
          source: "export",
          source_message_id: idempotencyKey,
          google_doc_id: documentId,
          google_doc_url: googleDocUrl,
          status: "pending",
        })
        .select("id")
        .single();
      if (reserveErr) {
        // Unique-violation race: another retry won. Re-read and return that doc.
        const { data: raced } = await supabaseAdmin
          .from("trip_doc_previews")
          .select("id, google_doc_id, google_doc_url, status")
          .eq("user_id", userId)
          .eq("source_message_id", idempotencyKey)
          .maybeSingle();
        if (raced) {
          return {
            googleDocId: raced.google_doc_id,
            googleDocUrl: raced.google_doc_url,
            reused: true as const,
          };
        }
        throw new Error(reserveErr.message);
      }
      reservationId = reserved.id;
    }

    // Build batchUpdate requests: header + per-day Morning/Afternoon/Evening sections.
    type Req =
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
            textStyle: { bold?: boolean; italic?: boolean; link?: { url: string } };
            fields: string;
          };
        };
    const reqs: Req[] = [];
    let cursor = 1;
    const insert = (
      text: string,
      style?: { heading?: "TITLE" | "HEADING_1" | "HEADING_2" | "HEADING_3"; bold?: boolean },
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
    const insertLink = (label: string, url: string) => {
      const line = `${label}\n`;
      const start = cursor;
      reqs.push({ insertText: { location: { index: cursor }, text: line } });
      cursor += line.length;
      reqs.push({
        updateTextStyle: {
          range: { startIndex: start, endIndex: start + label.length },
          textStyle: { link: { url } },
          fields: "link",
        },
      });
    };

    insert(title, { heading: "TITLE" });
    insert("");
    for (const d of days) {
      insert(d.label, { heading: "HEADING_1" });
      for (const slot of ["morning", "afternoon", "evening"] as const) {
        const items = d.slots[slot];
        if (!items.length) continue;
        insert(slot.charAt(0).toUpperCase() + slot.slice(1), { heading: "HEADING_3" });
        for (const it of items) {
          if (it.kind === "place") {
            const p = it as { name?: string; time?: string; address?: string; website?: string; note?: string };
            const head = [p.time, p.name].filter(Boolean).join("  ");
            insert(head, { bold: true });
            if (p.address) insert(p.address);
            if (p.website) insertLink(p.website, p.website);
            if (p.note) insert(p.note);
            insert("");
          } else if (it.kind === "flight") {
            const f = it as { airline?: string; flightNumber?: string; fromCity?: string; toCity?: string; departTime?: string; arriveTime?: string };
            insert(
              [f.airline, f.flightNumber, " — ", [f.fromCity, f.toCity].filter(Boolean).join(" → ")]
                .filter(Boolean)
                .join(" "),
              { bold: true },
            );
            const times = [f.departTime, f.arriveTime].filter(Boolean).join(" → ");
            if (times) insert(times);
            insert("");
          }
        }
      }
    }

    if (reqs.length) {
      const updateRes = await fetchWithRetry(
        `${DOCS_GATEWAY}/documents/${documentId}:batchUpdate`,
        { method: "POST", headers: gatewayHeaders(), body: JSON.stringify({ requests: reqs }) },
      );
      if (!updateRes.ok) {
        console.error("[export] batchUpdate failed", updateRes.status, await updateRes.text().catch(() => ""));
        throw new Error(
          `Google Docs write failed (${updateRes.status}). Doc was created — retry to finish writing it.`,
        );
      }
    }

    // Mark the reservation ready so future calls short-circuit.
    if (reservationId) {
      await supabaseAdmin
        .from("trip_doc_previews")
        .update({ status: "ready" })
        .eq("id", reservationId);
    }

    return {
      googleDocId: documentId,
      googleDocUrl,
      reused: false as const,
    };
  });