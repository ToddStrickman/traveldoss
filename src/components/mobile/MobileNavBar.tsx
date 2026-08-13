import { Link, useRouterState } from "@tanstack/react-router";
import { Briefcase, BookOpen, Compass, Home, UserCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Mobile bottom navigation for the public/workspace surfaces (landing,
 * templates, trip list). The desktop Ribbon rail has no mobile presence,
 * which left phones with no way to reach sign-in or their own trips —
 * the fatal flaw this bar exists to close.
 *
 * Thumb-reachable, safe-area aware, backdrop-blurred paper like the rail.
 * Sign-in state swaps the last item: "Sign in" (signed out, seal accent so
 * the way in is unmissable) ↔ "Trips" (signed in). Hidden ≥ md where the
 * Ribbon takes over. Dossier pages keep their own masthead chrome — this
 * bar deliberately does not render there.
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
    { to: "/guides" as const, label: "Guides", icon: Compass, active: path.startsWith("/guides") },
    ...(signedIn
      ? [{ to: "/app" as const, label: "Trips", icon: Briefcase, active: path.startsWith("/app") }]
      : []),
    ...(signedIn === false
      ? [{ to: "/login" as const, label: "Sign in", icon: UserCircle2, active: path.startsWith("/login"), accent: true }]
      : []),
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-paper/85 backdrop-blur-md md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      aria-label="Primary"
      data-print="hide"
    >
      <div className="mx-auto flex max-w-md items-stretch justify-around">
        {items.map(({ to, label, icon: Icon, active, ...rest }) => {
          const accent = "accent" in rest && rest.accent;
          return (
            <Link
              key={label}
              to={to}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={
                "tap flex min-h-[56px] min-w-[64px] flex-col items-center justify-center gap-1 px-3 text-[9px] font-medium uppercase tracking-[0.28em] transition-colors " +
                (active
                  ? "text-seal"
                  : accent
                    ? "text-seal/90 hover:text-seal"
                    : "text-ink/55 hover:text-seal")
              }
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={accent ? 1.75 : 1.25} aria-hidden />
              <span>{label}</span>
              <span
                aria-hidden
                className={
                  "h-0.5 w-6 rounded-full transition-opacity " +
                  (active ? "bg-seal opacity-100" : "opacity-0")
                }
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
