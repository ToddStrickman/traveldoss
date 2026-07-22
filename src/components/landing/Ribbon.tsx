import { Link } from "@tanstack/react-router";
import { MapPin, BookOpen, Compass, Bookmark, Settings, UserCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

const items = [
  { icon: MapPin, label: "Browse Places", to: "/app" as const },
  { icon: BookOpen, label: "Templates", to: "/templates" as const },
  { icon: Compass, label: "Past Trips", to: "/app" as const },
  { icon: Bookmark, label: "Saved", to: "/app" as const },
  { icon: Settings, label: "Settings", to: "/app" as const },
];

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
        "group relative flex h-11 w-11 items-center justify-center border text-[11px] font-semibold tracking-[0.14em] transition-colors " +
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
      <span
        className="pointer-events-none absolute left-full ml-4 whitespace-nowrap border border-ink/15 bg-paper px-3 py-1.5 text-[9px] font-medium uppercase tracking-[0.3em] text-ink opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        {tooltip}
      </span>
    </Link>
  );
}

export function Ribbon() {
  const [user, setUser] = useState<User | null>(null);

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

  return (
    <aside
      className="fixed left-6 top-1/2 z-30 hidden -translate-y-1/2 flex-col items-stretch gap-1 border border-ink/10 bg-paper/60 p-2 backdrop-blur-sm md:flex"
      aria-label="Workspace navigation"
      aria-live="polite"
    >
      <IdentityChip user={user} />
      <nav className="mt-2 flex flex-col gap-0.5 border-t border-ink/10 pt-2">
        {items.map(({ icon: Icon, label, to }) => (
          <Link
            key={label}
            to={to}
            className="group relative flex h-11 w-11 items-center justify-center text-ink/45 transition-colors duration-300 hover:text-seal focus-visible:text-seal"
            aria-label={label}
          >
            <Icon className="h-4 w-4" strokeWidth={1.25} aria-hidden="true" />
            <span className="pointer-events-none absolute left-full ml-4 whitespace-nowrap border border-ink/15 bg-paper px-3 py-1.5 text-[9px] font-medium uppercase tracking-[0.3em] text-ink opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
              {label}
            </span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}