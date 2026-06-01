import { Link } from "@tanstack/react-router";
import { MapPin, BookOpen, Compass, Bookmark, Settings, LogIn } from "lucide-react";

const items = [
  { icon: MapPin, label: "Browse Places", to: "/app" as const },
  { icon: BookOpen, label: "Templates", to: "/templates" as const },
  { icon: Compass, label: "Past Trips", to: "/app" as const },
  { icon: Bookmark, label: "Saved", to: "/app" as const },
  { icon: Settings, label: "Settings", to: "/app" as const },
  { icon: LogIn, label: "Enter", to: "/login" as const },
];

export function Ribbon() {
  return (
    <aside
      className="fixed left-6 top-1/2 z-30 hidden -translate-y-1/2 flex-col items-stretch gap-1 border border-ink/10 bg-paper/60 p-2 backdrop-blur-sm md:flex"
      aria-label="Workspace navigation"
    >
      <Link
        to="/"
        className="flex h-11 w-11 items-center justify-center border border-ink/15 text-[10px] font-medium tracking-[0.2em] text-ink transition-colors hover:border-seal hover:text-seal"
        style={{ fontFamily: "var(--font-display)" }}
      >
        TD
      </Link>
      <nav className="mt-2 flex flex-col gap-0.5 border-t border-ink/10 pt-2">
        {items.map(({ icon: Icon, label, to }) => (
          <Link
            key={label}
            to={to}
            className="group relative flex h-11 w-11 items-center justify-center text-ink/45 transition-colors duration-300 hover:text-seal"
            title={label}
            aria-label={label}
          >
            <Icon className="h-4 w-4" strokeWidth={1.25} aria-hidden="true" />
            <span className="pointer-events-none absolute left-full ml-4 whitespace-nowrap border border-ink/15 bg-paper px-3 py-1.5 text-[9px] font-medium uppercase tracking-[0.3em] text-ink opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              {label}
            </span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}