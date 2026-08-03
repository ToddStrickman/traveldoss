import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { getTermsStatus, recordTermsAcceptance } from "@/lib/legal/acceptance.functions";
import { clearPendingAcceptance, readPendingAcceptance } from "@/lib/legal/pending-acceptance";
import { compareVersions } from "@/lib/legal/versions";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function AuthLayout() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const navigate = useNavigate();
  const currentHref = useRouterState({ select: (s) => s.location.href });

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    // getSession() only reads localStorage — a session whose server-side record
    // is gone (session_not_found) still looks valid, so children mount and
    // their protected server fns 401 with "No authorization header provided".
    // Validate against the Auth server once and drop a dead session.
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setSession(null);
        return;
      }
      const { error } = await supabase.auth.getUser();
      if (error) {
        await supabase.auth.signOut();
        setSession(null);
        return;
      }
      setSession(data.session);
    })();
    return () => sub.subscription.unsubscribe();
  }, []);

  // Signed-out visitors go to the sign-in form. This must be a NAVIGATION
  // from an effect, not a `throw redirect()` from render — a redirect
  // thrown inside a component (outside loader/beforeLoad) is treated as a
  // crash by the router, so anonymous visitors to /app were getting the
  // "This page didn't load" error boundary instead of the login form.
  // Carry the intended destination so login returns them here after.
  //
  // Fires exactly ONCE per signed-out transition. `currentHref` is a dep, so
  // without the ref this effect re-ran the moment its own navigation changed
  // the location — re-reading the new href (already `/login?redirect=…`) and
  // nesting it again, forever. Reproduced on production: a signed-out visit
  // to /app produced a 54-level `?redirect=%252F…` chain and a ~9.5KB URL.
  // That sits squarely in the sign-in path, and Safari's stricter URL limits
  // make it a hard failure rather than an ugly one.
  const redirectedRef = useRef(false);
  useEffect(() => {
    if (session !== null) {
      // Signed in (or still resolving) — re-arm for a future sign-out.
      redirectedRef.current = false;
      return;
    }
    if (redirectedRef.current) return;
    // Belt and braces: never fold a login URL into itself.
    if (currentHref.startsWith("/login")) return;
    redirectedRef.current = true;
    void navigate({ to: "/login", search: { redirect: currentHref }, replace: true });
  }, [session, navigate, currentHref]);

  if (session === undefined || session === null) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <TermsGate currentHref={currentHref}>
      <Outlet />
    </TermsGate>
  );
}

/**
 * Clickwrap enforcement for signed-in users. Renders the app only when the
 * current Terms of Service version has been accepted:
 *
 *  - Email signups ticked the checkbox before a session existed; that act
 *    is stashed locally (see pending-acceptance.ts) and flushed to the
 *    server here, invisibly, on first authenticated arrival.
 *  - Everyone else without a current acceptance (Google OAuth first-timers,
 *    accounts predating the Terms, users after a version bump) is sent to
 *    the /terms/update interstitial and returns after agreeing.
 *
 * If the status check itself fails (network blip, cold function) the gate
 * fails OPEN with a console error: locking users out of dossiers they paid
 * for over a transient error is worse than deferring the prompt to the
 * next visit. Signup itself never proceeds without acceptance.
 */
function TermsGate({ currentHref, children }: { currentHref: string; children: React.ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const statusFn = useServerFn(getTermsStatus);
  const recordFn = useServerFn(recordTermsAcceptance);
  const flushStarted = useRef(false);
  // Same unbounded-nesting hazard as the sign-in redirect above: `currentHref`
  // is an effect dep, so navigating to /terms/update re-fires this effect with
  // the new href and folds it into the next `?redirect=`. Latch it.
  const sentToInterstitial = useRef(false);

  const { data: status, isError } = useQuery({
    queryKey: ["terms-status"],
    queryFn: () => statusFn(),
    staleTime: 5 * 60_000,
    retry: 1,
  });

  useEffect(() => {
    if (!status || status.accepted) {
      // Re-arm so a later version bump can send them again.
      sentToInterstitial.current = false;
      return;
    }
    if (sentToInterstitial.current) return;
    if (currentHref.startsWith("/terms/update")) return;

    const pending = readPendingAcceptance();
    const stashCoversCurrent =
      pending && compareVersions(pending.version, status.currentVersion) >= 0;

    if (stashCoversCurrent) {
      if (flushStarted.current) return;
      flushStarted.current = true;
      recordFn({
        data: {
          method: "signup_clickwrap",
          acceptedAt: pending.acceptedAt,
          locale: navigator.language,
        },
      })
        .then(() => {
          clearPendingAcceptance();
          return queryClient.invalidateQueries({ queryKey: ["terms-status"] });
        })
        .catch((err) => {
          console.error("[terms] failed to record signup acceptance", err);
          // Fall back to the interstitial rather than looping the flush.
          clearPendingAcceptance();
          flushStarted.current = false;
          sentToInterstitial.current = true;
          void navigate({
            to: "/terms/update",
            search: { redirect: currentHref },
            replace: true,
          });
        });
    } else {
      sentToInterstitial.current = true;
      void navigate({
        to: "/terms/update",
        search: { redirect: currentHref },
        replace: true,
      });
    }
  }, [status, navigate, currentHref, queryClient, recordFn]);

  if (isError) {
    console.error("[terms] status check failed — allowing session through this visit");
    return <>{children}</>;
  }

  if (!status || !status.accepted) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return <>{children}</>;
}
