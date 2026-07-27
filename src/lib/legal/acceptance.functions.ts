import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CURRENT_TERMS_VERSION, LEGAL_DOCS } from "./registry";
import { compareVersions } from "./versions";

/**
 * Server-side acceptance ledger for the Terms of Service.
 *
 * Immutability lives in the database (append-only table, unique per
 * user/version — see the terms_acceptances migration); these functions only
 * ever read status or append one row stamped with request metadata.
 */

export interface TermsStatus {
  currentVersion: string;
  /** True when the signed-in user has accepted the current version. */
  accepted: boolean;
  /** Highest version this user has ever accepted, or null if none. */
  latestAcceptedVersion: string | null;
}

export const getTermsStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TermsStatus> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("terms_acceptances")
      .select("version")
      .eq("user_id", userId)
      .eq("doc_slug", "terms");
    if (error) throw new Error(error.message);
    const versions = (data ?? []).map((r) => r.version);
    const latest = versions.length ? [...versions].sort(compareVersions).at(-1)! : null;
    return {
      currentVersion: CURRENT_TERMS_VERSION,
      accepted: latest !== null && compareVersions(latest, CURRENT_TERMS_VERSION) >= 0,
      latestAcceptedVersion: latest,
    };
  });

const AcceptInputSchema = z.object({
  method: z.enum(["signup_clickwrap", "onboarding_clickwrap", "update_clickwrap"]),
  locale: z.string().max(35).optional(),
  /**
   * ISO timestamp of the affirmative act, for email signups where the
   * checkbox was ticked before a session existed. Clamped server-side.
   */
  acceptedAt: z.string().max(40).optional(),
});

function clampAcceptedAt(iso: string | undefined, now: Date): string {
  // Trust the client-claimed click time only within a sane window (not in
  // the future, at most 7 days old — the email-confirmation gap). Anything
  // else falls back to server time.
  if (!iso) return now.toISOString();
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return now.toISOString();
  const ageMs = now.getTime() - t.getTime();
  if (ageMs < 0 || ageMs > 7 * 24 * 60 * 60 * 1000) return now.toISOString();
  return t.toISOString();
}

export const recordTermsAcceptance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AcceptInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const request = getRequest();
    const headers = request?.headers;
    const ip =
      headers?.get("cf-connecting-ip") ??
      headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      null;
    const userAgent = headers?.get("user-agent") ?? null;
    const locale = data.locale ?? headers?.get("accept-language")?.split(",")[0]?.trim() ?? null;

    const terms = LEGAL_DOCS.terms;
    const { error } = await supabase.from("terms_acceptances").insert({
      user_id: userId,
      doc_slug: terms.slug,
      version: terms.version,
      content_hash: terms.contentHash,
      accepted_at: clampAcceptedAt(data.acceptedAt, new Date()),
      ip_address: ip,
      user_agent: userAgent,
      locale,
      method: data.method,
    });
    // 23505 = unique violation: this user already accepted this version.
    // The first record stands (history is never overwritten) — report success.
    if (error && error.code !== "23505") throw new Error(error.message);
    return { ok: true as const, version: terms.version };
  });
