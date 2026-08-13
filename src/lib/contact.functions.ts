import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { CONTACT_CATEGORY_IDS } from "@/lib/contact";

const ContactInputSchema = z.object({
  email: z.string().trim().email().max(320),
  name: z.string().trim().max(120).optional(),
  category: z.enum(CONTACT_CATEGORY_IDS),
  message: z.string().trim().min(1).max(5000),
  /** Honeypot — real users never fill this. Must be empty. */
  trap: z.string().max(200).optional(),
});

/**
 * Best-effort per-IP throttle. In-memory, so it is per-isolate rather than
 * global — a spam speed bump on top of the honeypot, not a security control.
 */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();

function throttled(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 500) {
    for (const [k, v] of hits) if (v.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
  }
  return recent.length > MAX_PER_WINDOW;
}

export const submitContactMessage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ContactInputSchema.parse(input))
  .handler(async ({ data }): Promise<{ receivedAt: string }> => {
    const headers = getRequest()?.headers;
    const ip =
      headers?.get("cf-connecting-ip") ??
      headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";

    // Honeypot: accept silently so bots get no signal, but store nothing.
    const receivedAt = new Date().toISOString();
    if (data.trap && data.trap.length > 0) return { receivedAt };

    if (throttled(ip)) {
      throw new Error("Too many messages from this connection. Try again in a minute.");
    }

    const { error } = await supabaseAdmin.from("contact_messages").insert({
      email: data.email,
      name: data.name && data.name.length > 0 ? data.name : null,
      category: data.category,
      message: data.message,
      created_at: receivedAt,
    });
    if (error) throw new Error(error.message);
    return { receivedAt };
  });
