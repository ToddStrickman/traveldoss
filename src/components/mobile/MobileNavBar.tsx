import { Link, useRouterState } from "@tanstack/react-router";
import { Briefcase, BookOpen, Compass, Home, UserCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Compose mark — a folded map with AI twinkles. Icon-only iconography that
 * matches the rest of the hairline lucide set but reads as "make something".
 */
function MapSparkIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {/* folded map */}
      <path d="M9 4 3.6 5.9v13L9 17l6 2 5.4-1.9V4L15 6 9 4Z" />
      <path d="M9 4v13M15 6v13" />
      {/* AI twinkles */}
      <path d="M17.6 3.1l.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.5.5-1.5Z" fill="currentColor" stroke="none" />
      <path d="M12.2 9.6l.32.96.96.32-.96.32-.32.96-.32-.96-.96-.32.96-.32.32-.96Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

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
export function MobileNavBar({ onCompose }: { onCompose?: () => void } = {}) {
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
      className="fixed bottom-4 left-1/2 z-40 flex max-w-[calc(100vw-16px)] -translate-x-1/2 items-center gap-1 rounded-full border border-white/25 bg-paper/55 p-1.5 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.45)] backdrop-blur-2xl backdrop-saturate-150 md:hidden"
      style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
      aria-label="Primary"
      data-print="hide"
    >
      {onCompose ? (
        <>
          <button
            type="button"
            onClick={onCompose}
            className="tap inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-seal px-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-paper shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] transition-transform active:scale-[0.98]"
          >
            <MapSparkIcon className="h-[18px] w-[18px]" />
            <span>Compose</span>
          </button>
          <span aria-hidden className="mx-0.5 h-6 w-px bg-ink/15" />
        </>
      ) : null}
      {items.map(({ to, label, icon: Icon, active, ...rest }) => {
        const accent = "accent" in rest && rest.accent;
        return (
          <Link
            key={label}
            to={to}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            className={
              "tap flex h-11 w-10 shrink-0 items-center justify-center rounded-full transition-all " +
              (active
                ? "bg-ink text-paper shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]"
                : accent
                  ? "text-seal ring-1 ring-inset ring-seal/50"
                  : "text-ink/80 hover:text-seal")
            }
          >
            <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
          </Link>
        );
      })}
    </nav>
  );
}
