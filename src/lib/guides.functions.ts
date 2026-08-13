import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { cloneGuideForUser } from "@/lib/guides.server";

/** Clones an Insider Guide into a new draft dossier owned by the caller. */
export const cloneGuide = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ slug: z.string().min(1).max(64) }).parse(input))
  .handler(async ({ data, context }) => cloneGuideForUser(data.slug, context.userId));
