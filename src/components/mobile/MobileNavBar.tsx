import { Link, useRouterState } from "@tanstack/react-router";
import { Briefcase, BookOpen, Compass, Home, UserCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Mobile counterpart of the desktop Ribbon rail: the approved Insider Guides
 * bottom-centered floating pill (hairline border, blur, inverted-circle
 * active state), icon-only with aria-labels. Renders on the public/workspace
 * surfaces (landing, templates, guides, trip list); dossier pages keep their
 * own masthead chrome and deliberately omit it.
 *
 * Sign-in state swaps the last slot: "Sign in" (signed out, seal accent so
 * the way in is unmissable) ↔ "Trips" (signed in). Hidden ≥ md where the
 * Ribbon takes over.
 */
export function MobileNavBar() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data }) => {
      if (alive) setSignedIn(!!data.user);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setSignedIn(!!session?.user);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const path = useRouterState({ select: (s) => s.location.pathname });

  const items = [
    { to: "/" as const, label: "Home", icon: Home, active: path === "/" },
    { to: "/templates" as const, label: "Templates", icon: BookOpen, active: path.startsWith("/templates") },
    { to: "/guides" as const, label: "Insider Guides", icon: Compass, active: path.startsWith("/guides") },
    ...(signedIn
      ? [{ to: "/app" as const, label: "My Trips", icon: Briefcase, active: path.startsWith("/app") }]
      : []),
    ...(signedIn === false
      ? [{ to: "/login" as const, label: "Sign in", icon: UserCircle2, active: path.startsWith("/login"), accent: true }]
      : []),
  ];

  return (
    <nav
      className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full border border-ink/10 bg-paper/85 p-1.5 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.45)] backdrop-blur-xl md:hidden"
      style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
      aria-label="Primary"
      data-print="hide"
    >
      {items.map(({ to, label, icon: Icon, active, ...rest }) => {
        const accent = "accent" in rest && rest.accent;
        return (
          <Link
            key={label}
            to={to}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            className={
              "tap flex h-11 w-11 items-center justify-center rounded-full transition-all " +
              (active
                ? "bg-ink text-paper shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]"
                : accent
                  ? "text-seal ring-1 ring-inset ring-seal/50"
                  : "text-ink/55 hover:text-seal")
            }
          >
            <Icon className="h-[18px] w-[18px]" strokeWidth={accent ? 1.75 : 1.25} aria-hidden />
          </Link>
        );
      })}
    </nav>
  );
}
