import { Link, useRouterState } from "@tanstack/react-router";
import { Briefcase, BookOpen, Compass, Home, UserCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

/* The rail lists only destinations that actually exist (owner direction:
   an option that doesn't exist shouldn't be present). Its look is the
   approved Insider Guides rail: floating pill, hairline border, blur,
   inverted-circle active state, pill tooltips. Guests see every item —
   "My Trips" simply routes them through login (owner direction 2026-08-13:
   full guest access; the clone/mint CTAs are the only auth touchpoints). */
const NAV_ITEMS = [
  { icon: Home, label: "Home", to: "/" as const, exact: true },
  { icon: BookOpen, label: "Templates", to: "/templates" as const, exact: false },
  { icon: Compass, label: "Insider Guides", to: "/guides" as const, exact: false },
] as const;

function displayNameOf(user: User): string {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const full = typeof meta.full_name === "string" ? meta.full_name : "";
  const name = typeof meta.name === "string" ? meta.name : "";
  return full || name || user.email || "Account";
}

function initialsOf(user: User): string {
  const name = displayNameOf(user);
  const isEmail = name.includes("@");
  if (!isEmail) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    const a = parts[0]?.[0] ?? "";
    const b = parts.length > 1 ? parts[parts.length - 1][0] : "";
    const out = (a + b) || parts[0]?.slice(0, 2) || "";
    if (out) return out.toUpperCase();
  }
  const local = (user.email ?? name).split("@")[0] ?? "";
  return (local.slice(0, 2) || "?").toUpperCase();
}

/** Pill tooltip shown to the right of a rail item. */
function Tip({ children }: { children: string }) {
  return (
    <span className="pointer-events-none absolute left-full ml-4 whitespace-nowrap rounded-full bg-ink px-3.5 py-1.5 text-[9px] font-medium uppercase tracking-[0.3em] text-paper opacity-0 transition-all duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
      {children}
    </span>
  );
}

/** Rail-top identity tile shared by both states. Same 44×44 footprint so
 *  the rail geometry never shifts between signed-out and signed-in. */
function IdentityChip({ user }: { user: User | null }) {
  const signedOut = user === null;
  const to = signedOut ? "/login" : "/app";
  const tooltip = signedOut ? "Sign in" : displayNameOf(user);
  const ariaLabel = signedOut ? "Sign in" : `Account: ${displayNameOf(user)}`;
  return (
    <Link
      to={to}
      aria-label={ariaLabel}
      className={
        "group relative flex h-11 w-11 items-center justify-center rounded-full border text-[11px] font-semibold tracking-[0.14em] transition-colors " +
        (signedOut
          ? "border-seal/60 text-seal shadow-[0_0_0_2px_color-mix(in_oklab,var(--seal,#b8452e)_18%,transparent)] hover:border-seal hover:shadow-[0_0_0_3px_color-mix(in_oklab,var(--seal,#b8452e)_28%,transparent)] focus-visible:shadow-[0_0_0_3px_color-mix(in_oklab,var(--seal,#b8452e)_35%,transparent)]"
          : "td-shimmer border-ink/20 text-ink hover:border-seal hover:text-seal")
      }
      style={{ fontFamily: "var(--font-display)" }}
    >
      {signedOut ? (
        <UserCircle2 className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
      ) : (
        <span aria-hidden="true">{initialsOf(user)}</span>
      )}
      <Tip>{tooltip}</Tip>
    </Link>
  );
}

export function Ribbon() {
  const [user, setUser] = useState<User | null>(null);
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data }) => {
      if (alive) setUser(data.user ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setUser(session?.user ?? null);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const items = [
    ...NAV_ITEMS.map((i) => ({ ...i, active: i.exact ? path === i.to : path.startsWith(i.to) })),
    {
      icon: Briefcase,
      label: user ? "My Trips" : "My Trips · sign in",
      to: (user ? "/app" : "/login") as "/app" | "/login",
      active: path.startsWith("/app"),
    },
  ];

  return (
    <aside
      className="fixed left-5 top-1/2 z-30 hidden -translate-y-1/2 flex-col items-stretch gap-1 rounded-[2rem] border border-ink/10 bg-paper/70 p-2 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.4)] backdrop-blur-xl md:flex"
      aria-label="Workspace navigation"
      aria-live="polite"
    >
      <IdentityChip user={user} />
      <nav className="mt-2 flex flex-col gap-1 border-t border-ink/10 pt-2">
        {items.map(({ icon: Icon, label, to, active }) => (
          <Link
            key={label}
            to={to}
            aria-current={active ? "page" : undefined}
            className={
              "group relative flex h-11 w-11 items-center justify-center rounded-full transition-all duration-300 " +
              (active
                ? "bg-ink text-paper shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]"
                : "text-ink/45 hover:text-seal focus-visible:text-seal")
            }
            aria-label={label}
          >
            <Icon className="h-4 w-4" strokeWidth={1.25} aria-hidden="true" />
            <Tip>{label}</Tip>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
