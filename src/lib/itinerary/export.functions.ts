import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
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
    const { supabase } = context;
    const { data: trip, error } = await supabase
      .from("trips")
      .select("id, destination, slug, content")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!trip) throw new Error("Trip not found");

    const blocks = (trip.content as { blocks?: AnyBlock[] } | null)?.blocks ?? [];
    if (!blocks.length) throw new Error("This dossier has no blocks to export yet.");

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
    const documentId = docJson.documentId;

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
      }
    }

    return {
      googleDocId: documentId,
      googleDocUrl: `https://docs.google.com/document/d/${documentId}/edit`,
    };
  });