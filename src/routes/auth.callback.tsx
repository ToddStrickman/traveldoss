import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SITE_URL } from "@/lib/site";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
  head: () => ({
    meta: [
      { title: "Signing you in — TravelDoss" },
      {
        name: "description",
        content: "Completing your TravelDoss sign-in and returning you to your dossiers.",
      },
      { property: "og:title", content: "Signing you in — TravelDoss" },
      {
        property: "og:description",
        content: "Completing your TravelDoss sign-in.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/auth/callback` }],
  }),
});

/** Same-origin path only — never trust an arbitrary URL from storage. */
function safePath(value: string | null): string {
  if (!value) return "/app";
  if (!value.startsWith("/") || value.startsWith("//")) return "/app";
  return value;
}

/**
 * Public landing page for OAuth returns. The provider round-trip MUST come
 * back to a public route: landing straight on a protected path (/app) races
 * the session write, so the auth gate sees `session === null` and bounces the
 * user back to /login — the "Google login doesn't work in production" report.
 * Here we wait for the session, then forward to the intended destination.
 */
function AuthCallback() {
  const [message, setMessage] = useState("Signing you in…");

  useEffect(() => {
    let done = false;
    const target = safePath(sessionStorage.getItem("td:post-auth-redirect"));

    const go = () => {
      if (done) return;
      done = true;
      sessionStorage.removeItem("td:post-auth-redirect");
      window.location.replace(target);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) go();
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) go();
    });

    const timeout = window.setTimeout(() => {
      if (!done) setMessage("We couldn't finish sign-in. Redirecting you back…");
      window.setTimeout(() => {
        if (!done) window.location.replace("/login");
      }, 1500);
    }, 8000);

    return () => {
      sub.subscription.unsubscribe();
      window.clearTimeout(timeout);
    };
  }, []);

  return (
    <div className="flex min-h-dvh items-center justify-center px-6 text-sm text-muted-foreground">
      {message}
    </div>
  );
}