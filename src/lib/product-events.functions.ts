/**
 * First-party event ingestion.
 *
 * This is a PUBLIC endpoint on the published site (anonymous visitors are the
 * top of the funnel, so it cannot require auth). Everything that follows is
 * therefore written as if the payload is hostile:
 *
 *   - event names are validated against the allowlist and anything else is
 *     dropped, so the store can never be filled with arbitrary names;
 *   - props are shallow primitives with capped key count and string length;
 *   - batches are capped, so one call cannot write unbounded rows;
 *   - no user id is accepted from the client — a client-supplied identity would
 *     be a lie, and user-level truth already lives in the tables we own.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isAllowedEvent } from "@/lib/analytics/event-allowlist";

const PropValue = z.union([z.string().max(200), z.number().finite(), z.boolean()]);

const EventSchema = z.object({
  event: z.string().min(1).max(64),
  occurred_at: z.string().datetime().optional(),
  session_id: z.string().max(64).optional(),
  path: z.string().max(200).nullable().optional(),
  props: z.record(z.string().max(40), PropValue).optional(),
});

const PayloadSchema = z.object({
  events: z.array(EventSchema).min(1).max(20),
});

const MAX_PROP_KEYS = 24;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const recordEvents = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => PayloadSchema.parse(input))
  .handler(async ({ data }) => {
    const rows = data.events
      .filter((e) => isAllowedEvent(e.event))
      .map((e) => {
        const props: Record<string, string | number | boolean> = {};
        let keys = 0;
        for (const [k, v] of Object.entries(e.props ?? {})) {
          if (keys >= MAX_PROP_KEYS) break;
          if (k === "template_id" || k === "trip_id") continue; // promoted below
          props[k] = v;
          keys++;
        }
        const templateId = e.props?.["template_id"];
        const tripId = e.props?.["trip_id"];
        return {
          event: e.event,
          occurred_at: e.occurred_at ?? new Date().toISOString(),
          session_id: e.session_id ?? null,
          path: e.path ?? null,
          template_id: typeof templateId === "string" ? templateId.slice(0, 64) : null,
          trip_id: typeof tripId === "string" && UUID_RE.test(tripId) ? tripId : null,
          props,
        };
      });

    if (rows.length === 0) return { accepted: 0 };

    // RLS denies every client write to product_events; the service role is the
    // only writer. Imported inside the handler so the server-only module never
    // enters a client bundle.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("product_events").insert(rows);
    if (error) {
      console.error(`[product-events] insert failed: ${error.message}`);
      return { accepted: 0 };
    }
    return { accepted: rows.length };
  });
