import { Link } from "@tanstack/react-router";
import { TEMPLATES } from "@/lib/templates";

function DocThumb({ title, days, accent }: { title: string; days: number; accent: string }) {
  return (
    <article
      className="relative h-[260px] w-full overflow-hidden border border-ink/20 bg-[oklch(0.97_0.012_85)] p-4 shadow-[6px_6px_0_rgba(26,26,26,0.12)] transition-transform hover:scale-[1.02]"
    >
      <div
        className="absolute left-0 top-0 h-full w-1"
        style={{ background: accent }}
        aria-hidden
      />
      <div className="mb-3 flex items-center justify-between">
        <span
          className="text-[9px] font-bold uppercase tracking-[0.3em] text-ink/40"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          Google Doc
        </span>
        <span
          className="text-[9px] font-bold uppercase tracking-[0.3em]"
          style={{ color: accent, fontFamily: "var(--font-sans)" }}
        >
          {days}d
        </span>
      </div>
      <h4
        className="mb-3 text-lg leading-tight text-ink"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {title.toUpperCase()}
      </h4>
      <div className="space-y-1.5">
        {[100, 88, 74, 92, 60, 80, 70].map((w, i) => (
          <div
            key={i}
            className="h-[3px] rounded-full bg-ink/15"
            style={{ width: `${w}%` }}
          />
        ))}
      </div>
      <div className="absolute bottom-3 left-4 right-4 flex justify-between text-[8px] uppercase tracking-[0.3em] text-ink/30"
           style={{ fontFamily: "var(--font-sans)" }}>
        <span>untitled</span>
        <span>·</span>
        <span>edited now</span>
      </div>
    </article>
  );
}

export function InfiniteDocs() {
  const loop = [...TEMPLATES, ...TEMPLATES];
  return (
    <aside
      className="relative hidden h-screen w-[300px] shrink-0 overflow-hidden border-l border-ink/20 bg-paper/20 lg:block"
      aria-label="Template previews"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-16 bg-gradient-to-b from-paper to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-16 bg-gradient-to-t from-paper to-transparent" />
      <div className="absolute left-4 top-4 z-20 text-[10px] font-bold uppercase tracking-[0.4em] text-seal"
           style={{ fontFamily: "var(--font-sans)" }}>
        Chronicles
      </div>
      <div
        className="td-marquee-track flex flex-col gap-5 px-5 py-20"
        style={{ animation: "td-scroll-up 60s linear infinite" }}
      >
        {loop.map((t, i) => (
          <Link key={`${t.id}-${i}`} to="/templates" hash={t.id} className="block">
            <DocThumb title={t.title} days={t.days} accent={t.accent} />
          </Link>
        ))}
      </div>
      <style>{`
        @keyframes td-scroll-up {
          from { transform: translateY(0); }
          to   { transform: translateY(-50%); }
        }
        aside:hover .td-marquee-track { animation-play-state: paused; }
      `}</style>
    </aside>
  );
}