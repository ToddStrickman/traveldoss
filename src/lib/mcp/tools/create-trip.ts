import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function randomSuffix(len = 6) {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 40) || "trip";
}

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format");

export default defineTool({
  name: "create_trip",
  title: "Create trip",
  description:
    "Create a new TravelDoss trip dossier for the signed-in user with a destination and date range.",
  inputSchema: {
    destination: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .describe("Destination name, e.g. 'Kyoto, Japan'."),
    start_date: isoDate.describe("Trip start date (YYYY-MM-DD)."),
    end_date: isoDate.describe("Trip end date (YYYY-MM-DD)."),
    subtitle: z.string().trim().max(280).optional().describe("Optional subtitle."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ destination, start_date, end_date, subtitle }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    if (new Date(end_date) < new Date(start_date)) {
      return {
        content: [{ type: "text", text: "end_date must be on or after start_date" }],
        isError: true,
      };
    }
    const supabase = supabaseForUser(ctx);
    const slug = `${slugify(destination)}-${randomSuffix()}`;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("trips")
      .insert({
        user_id: ctx.getUserId(),
        destination,
        subtitle: subtitle ?? null,
        start_date,
        end_date,
        slug,
        visibility: "unlisted",
        status: "draft",
        expires_at: expiresAt,
        content: { blocks: [] },
      })
      .select("id, slug, destination, start_date, end_date, status, visibility")
      .single();
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { trip: data },
    };
  },
});