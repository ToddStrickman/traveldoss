import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Block } from "@/lib/skins/types";
import { parseItineraryAiCore } from "@/lib/itinerary/parse-ai.functions";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Silent refine pass. Re-renders the current itinerary through the AI
 * parser/enricher using the latest dossier meta so newly-known constraints
 * (dates, travelers, pace, budget, interests) get reflected throughout the
 * blocks without the user re-prompting.
 *
 * Strategy: serialize the current blocks to a markdown brief, attach a
 * "Trip Context" header carrying the meta, and re-run the well-tested AI
 * parser. Returns the refreshed Block[].
 */

const MetaSchema = z.object({
  travelers: z.string().max(80).optional(),
  pace: z.enum(["relaxed", "balanced", "packed"]).optional(),
  budget: z.enum(["shoestring", "moderate", "elevated", "luxury"]).optional(),
  interests: z.array(z.string().max(40)).max(20).optional(),
});

const InputSchema = z.object({
  blocks: z.array(z.any()).min(1).max(400),
  destination: z.string().max(200).optional(),
  startDate: z.string().max(40).optional(),
  endDate: z.string().max(40).optional(),
  meta: MetaSchema.optional(),
  reason: z.string().max(200).optional(),
});

export type RefineItineraryInput = z.infer<typeof InputSchema>;

/**
 * Core refine implementation — callable directly from other SERVER code
 * (hardenItineraryAi runs three of these). See `parseItineraryAiCore` for why
 * server-to-server callers must not go through the wrapped server fn.
 */
export async function refineItineraryAiCore(data: RefineItineraryInput) {
  const blocks = data.blocks as Block[];
  const brief = serializeForRefine({
    blocks,
    destination: data.destination,
    startDate: data.startDate,
    endDate: data.endDate,
    meta: data.meta,
    reason: data.reason,
  });
  const result = await parseItineraryAiCore({ text: brief, source: "ai" });
  return { blocks: result.blocks, destination: result.destination ?? null };
}

/** Authenticated HTTP entry point. Spends AI + Google Places credits. */
export const refineItineraryAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => refineItineraryAiCore(data));

function serializeForRefine(args: {
  blocks: Block[];
  destination?: string;
  startDate?: string;
  endDate?: string;
  meta?: z.infer<typeof MetaSchema>;
  reason?: string;
}): string {
  const lines: string[] = [];
  lines.push("# Trip Context");
  if (args.destination) lines.push(`Destination: ${args.destination}`);
  if (args.startDate || args.endDate) {
    lines.push(`Dates: ${args.startDate ?? "?"} → ${args.endDate ?? "?"}`);
  }
  if (args.meta?.travelers) lines.push(`Travelers: ${args.meta.travelers}`);
  if (args.meta?.pace) lines.push(`Pace: ${args.meta.pace}`);
  if (args.meta?.budget) lines.push(`Budget: ${args.meta.budget}`);
  if (args.meta?.interests?.length) {
    lines.push(`Interests: ${args.meta.interests.join(", ")}`);
  }
  if (args.reason) lines.push(`Recent change: ${args.reason}`);
  lines.push("");
  lines.push(
    "Refine the itinerary below to honor this context. Preserve all user-named venues, times, and notes; tighten or fill missing details (categories, addresses, transit, accommodation, editorial notes) and adjust pacing only where it conflicts with the context above. Do NOT invent extra stops; do NOT remove user-listed stops.",
  );
  lines.push("");
  lines.push("# Current Itinerary");
  lines.push("");

  for (const b of args.blocks) {
    switch (b.kind) {
      case "hero":
        lines.push(`# ${b.title}${b.subtitle ? ` — ${b.subtitle}` : ""}`);
        break;
      case "section":
        lines.push(`### ${b.title}`);
        break;
      case "paragraph":
        if (b.text) lines.push(b.text);
        break;
      case "note":
        if (b.text) lines.push(`> ${b.text}`);
        break;
      case "quote":
        if (b.text) lines.push(`> "${b.text}"${b.attribution ? ` — ${b.attribution}` : ""}`);
        break;
      case "day":
        lines.push("");
        lines.push(`## Day ${b.n} — ${b.label}${b.date ? ` (${b.date})` : ""}`);
        if (b.notes) lines.push(b.notes);
        break;
      case "place": {
        const time = b.time ? `${b.time} · ` : "";
        const cat = b.category ? ` [${b.category}]` : "";
        const addr = b.address ? ` — ${b.address}` : "";
        const note = b.note ? ` — ${b.note}` : "";
        const tier = b.tier === "shadow" ? " (Alternative)" : "";
        lines.push(`- ${time}${b.name}${cat}${tier}${addr}${note}`);
        break;
      }
      case "flight": {
        const seg = `${b.from ?? b.fromCity ?? "?"} → ${b.to ?? b.toCity ?? "?"}`;
        const when = `${b.date ?? ""} ${b.departTime ?? ""}`.trim();
        lines.push(`- Flight ${b.airline ?? ""} ${b.flightNumber ?? ""} ${seg} ${when}`.trim());
        break;
      }
    }
  }

  return lines.join("\n");
}
