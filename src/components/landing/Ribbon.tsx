import { Link } from "@tanstack/react-router";
import { MapPin, BookOpen, Compass, Bookmark, Settings, LogIn } from "lucide-react";

const items = [
  { icon: MapPin, label: "Places", to: "/app" as const },
  { icon: BookOpen, label: "Templates", to: "/templates" as const },
  { icon: Compass, label: "Past Trips", to: "/app" as const },
  { icon: Bookmark, label: "Saved", to: "/app" as const },
  { icon: Settings, label: "Settings", to: "/app" as const },
  { icon: LogIn, label: "Enter", to: "/login" as const },
];

export function Ribbon() {
  return (
    <aside
      className="sticky top-0 z-20 hidden h-screen w-[88px] shrink-0 flex-col items-stretch border-r border-ink/20 bg-paper/40 backdrop-blur-sm md:flex"
      aria-label="Workspace navigation"
    >
      <Link
        to="/"
        className="flex h-20 items-center justify-center border-b border-ink/20 text-[10px] font-bold uppercase tracking-[0.3em] text-ink"
        style={{ fontFamily: "var(--font-sans)" }}
      >
        TD
      </Link>
      <nav className="flex flex-1 flex-col">
        {items.map(({ icon: Icon, label, to }) => (
          <Link
            key={label}
            to={to}
            className="group relative flex flex-col items-center gap-2 border-b border-ink/10 px-2 py-5 text-[9px] font-bold uppercase tracking-[0.25em] text-ink/70 transition-colors hover:bg-ink/[0.04] hover:text-ink"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            <Icon className="h-4 w-4 transition-transform group-hover:scale-110" strokeWidth={1.5} />
            <span className="text-center leading-tight">{label}</span>
            <span className="absolute left-0 top-0 h-full w-[2px] origin-top scale-y-0 bg-seal transition-transform group-hover:scale-y-100" />
          </Link>
        ))}
      </nav>
      <div
        className="border-t border-ink/20 py-4 text-center text-[9px] font-bold uppercase tracking-[0.3em] text-ink/40"
        style={{ fontFamily: "var(--font-sans)" }}
      >
        MMXXVI
      </div>
    </aside>
  );
}