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
      className="fixed left-4 top-1/2 z-30 hidden -translate-y-1/2 flex-col items-stretch gap-2 rounded-3xl border border-white/10 bg-white/[0.04] p-3 shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-xl md:flex"
      aria-label="Workspace navigation"
    >
      <Link
        to="/"
        className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-seal to-seal-soft text-[11px] font-bold tracking-tight text-paper shadow-[0_4px_16px_rgba(80,120,255,0.4)]"
      >
        TD
      </Link>
      <nav className="flex flex-col gap-1.5 pt-2">
        {items.map(({ icon: Icon, label, to }) => (
          <Link
            key={label}
            to={to}
            className="group relative flex h-12 w-12 items-center justify-center rounded-2xl border border-transparent text-ink/60 transition-all duration-300 hover:border-white/10 hover:bg-white/[0.06] hover:text-ink hover:scale-110"
            title={label}
          >
            <Icon className="h-5 w-5" strokeWidth={1.5} />
            <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-lg border border-white/10 bg-white/[0.08] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-ink opacity-0 backdrop-blur-xl transition-opacity duration-200 group-hover:opacity-100">
              {label}
            </span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}