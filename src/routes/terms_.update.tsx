import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { LEGAL_DOCS } from "@/lib/legal/registry";
import { LEGAL_CONTENT } from "@/lib/legal/content";
import { getTermsStatus, recordTermsAcceptance } from "@/lib/legal/acceptance.functions";
import { clearPendingAcceptance } from "@/lib/legal/pending-acceptance";
import { LegalMarkdown } from "@/components/legal/LegalMarkdown";
import { SITE_URL } from "@/lib/site";

/**
 * Acceptance interstitial. Signed-in users land here when they have not
 * accepted the current Terms version: first-timers who signed up via
 * Google OAuth (no signup checkbox on that path), accounts that predate
 * the Terms, and everyone after a Terms version bump. Access to the app
 * resumes only after the affirmative act below is recorded.
 */
export const Route = createFileRoute("/terms_/update")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect:
      typeof search.redirect === "string" &&
      search.redirect.startsWith("/") &&
      !search.redirect.startsWith("//")
        ? search.redirect
        : undefined,
  }),
  component: TermsUpdatePage,
  head: () => ({
    meta: [
      { title: "Terms of Service | TravelDoss" },
      { name: "robots", content: "noindex,nofollow" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/terms/update` }],
  }),
});

function TermsUpdatePage() {
  const { redirect = "/app" } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const statusFn = useServerFn(getTermsStatus);
  const recordFn = useServerFn(recordTermsAcceptance);

  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sessionKnown, setSessionKnown] = useState(false);

  // This page only makes sense signed in — anonymous visitors read /terms.
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (!data.session) {
        void navigate({ to: "/login", search: { redirect: "/terms/update" }, replace: true });
      } else {
        setSessionKnown(true);
      }
    });
    return () => {
      mounted = false;
    };
  }, [navigate]);

  const { data: status, isError } = useQuery({
    queryKey: ["terms-status"],
    queryFn: () => statusFn(),
    enabled: sessionKnown,
    staleTime: 60_000,
  });

  // Already square (e.g. the back button after accepting) — carry on.
  useEffect(() => {
    if (status?.accepted) {
      window.location.replace(redirect);
    }
  }, [status?.accepted, redirect]);

  const meta = LEGAL_DOCS.terms;
  const isUpdate = !!status?.latestAcceptedVersion;

  const onAccept = async () => {
    if (!agreed || saving) return;
    setSaving(true);
    try {
      await recordFn({
        data: {
          method: isUpdate ? "update_clickwrap" : "onboarding_clickwrap",
          locale: navigator.language,
        },
      });
      clearPendingAcceptance();
      await queryClient.invalidateQueries({ queryKey: ["terms-status"] });
      window.location.replace(redirect);
    } catch (err) {
      console.error("[terms] acceptance failed", err);
      toast.error("Couldn't record your acceptance", {
        description: "Please try again in a moment.",
      });
      setSaving(false);
    }
  };

  const onSignOut = async () => {
    await supabase.auth.signOut();
    void navigate({ to: "/", replace: true });
  };

  return (
    <div className="relative min-h-dvh overflow-x-clip bg-background text-foreground selection:bg-seal/40">
      <div aria-hidden className="td-grain fixed inset-0 z-0" />
      <div aria-hidden className="td-vignette fixed inset-0 z-0" />

      <header className="relative z-10 mx-auto flex max-w-[1600px] items-center justify-between border-b border-ink/10 px-5 py-5 md:px-8 md:py-6">
        <span className="inline-flex items-center gap-3 td-eyebrow text-ink/70">
          <span className="h-px w-6 bg-ink/30" />
          TravelDoss<span className="text-ink/30">®</span>
        </span>
        <button
          type="button"
          onClick={onSignOut}
          className="td-eyebrow text-ink/45 transition-colors hover:text-seal"
        >
          Sign out
        </button>
      </header>

      <main className="relative z-10 mx-auto max-w-[860px] px-5 pb-24 pt-12 md:px-8 md:pt-16">
        <span className="td-eyebrow text-ink/50">
          {isUpdate ? "Legal · Updated agreement" : "Legal · Agreement"}
        </span>
        <h1 className="td-headline mt-6 text-4xl text-ink md:text-5xl">
          {isUpdate ? (
            <>
              Our Terms have <span className="italic text-ink/85">changed</span>
              <span className="text-seal">.</span>
            </>
          ) : (
            <>
              One <span className="italic text-ink/85">agreement</span>
              <span className="text-seal">.</span>
            </>
          )}
        </h1>
        <p className="mt-6 max-w-lg text-sm leading-relaxed text-ink-soft">
          {isUpdate
            ? "TravelDoss has updated its Terms of Service. Please review and accept the new version to continue."
            : "Before you continue, please review and agree to the Terms of Service that govern your use of TravelDoss."}
        </p>
        <p className="mt-3 td-eyebrow text-ink/35">
          Version {meta.version} · Effective {meta.effectiveAt}
        </p>

        {status === undefined && !isError && sessionKnown ? (
          <div className="mt-10 text-sm text-muted-foreground">Loading…</div>
        ) : null}

        <section
          aria-label="Terms of Service document"
          className="mt-10 max-h-[52dvh] overflow-y-auto border border-ink/10 bg-ink/[0.02] px-6 py-2 md:px-8"
          tabIndex={0}
        >
          <article className="text-[15px] text-ink/75">
            <LegalMarkdown markdown={LEGAL_CONTENT.terms} />
          </article>
        </section>
        <p className="mt-3 text-xs text-ink/40">
          Also available at{" "}
          <Link to="/terms" target="_blank" className="text-seal underline underline-offset-4">
            traveldoss.com/terms
          </Link>{" "}
          for your records.
        </p>

        <div className="mt-8 flex items-start gap-3">
          <Checkbox
            id="agree-updated-terms"
            checked={agreed}
            onCheckedChange={(v) => setAgreed(v === true)}
            aria-describedby="agree-updated-terms-label"
            className="mt-0.5 rounded-none border-ink/30 data-[state=checked]:border-seal data-[state=checked]:bg-seal data-[state=checked]:text-paper"
          />
          <label
            htmlFor="agree-updated-terms"
            id="agree-updated-terms-label"
            className="cursor-pointer text-sm leading-relaxed text-ink/75"
          >
            I have read and agree to the{" "}
            <Link
              to="/terms"
              target="_blank"
              className="text-seal underline decoration-seal/40 underline-offset-4 hover:text-seal-soft"
            >
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link
              to="/privacy"
              target="_blank"
              className="text-seal underline decoration-seal/40 underline-offset-4 hover:text-seal-soft"
            >
              Privacy Policy
            </Link>
            .
          </label>
        </div>

        <Button
          type="button"
          onClick={onAccept}
          disabled={!agreed || saving}
          className="mt-8 w-full rounded-none bg-seal py-6 text-[10px] uppercase tracking-[0.4em] text-paper hover:bg-seal-soft disabled:opacity-40 md:w-auto md:px-14"
        >
          {saving ? "Recording…" : "Agree and continue"}
        </Button>
      </main>
    </div>
  );
}
