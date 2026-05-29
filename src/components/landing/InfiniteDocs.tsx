import { Link } from "@tanstack/react-router";
import { TEMPLATES } from "@/lib/templates";

function DocThumb({ title, days, accent }: { title: string; days: number; accent: string }) {
  return (
    <article
      className="relative h-[240px] w-full overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] p-4 shadow-[0_8px_32px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl transition-all duration-500 hover:scale-[1.04] hover:bg-white/[0.1]"
    >
      <div
        className="absolute left-0 top-0 h-full w-[3px] rounded-r-full"
        style={{ background: `linear-gradient(180deg, ${accent}, transparent)` }}
        aria-hidden
      />
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[9px] font-medium uppercase tracking-[0.3em] text-ink/40">
          Google Doc
        </span>
        <span className="rounded-full border border-white/10 px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.2em]"
              style={{ color: accent }}>
          {days}d
        </span>
      </div>
      <h4
        className="mb-3 text-base font-semibold leading-tight tracking-tight text-ink"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {title}
      </h4>
      <div className="space-y-1.5">
        {[100, 88, 74, 92, 60, 80, 70].map((w, i) => (
          <div
            key={i}
            className="h-[3px] rounded-full bg-white/15"
            style={{ width: `${w}%` }}
          />
        ))}
      </div>
      <div className="absolute bottom-3 left-4 right-4 flex justify-between text-[8px] uppercase tracking-[0.3em] text-ink/30">
        <span>draft</span>
        <span>edited just now</span>
      </div>
    </article>
  );
}

export function InfiniteDocs() {
  const loop = [...TEMPLATES, ...TEMPLATES];
  return (
    <aside
      className="fixed right-0 top-0 z-10 hidden h-screen w-[320px] overflow-hidden border-l border-white/5 md:block"
      aria-label="Template previews"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-32 bg-gradient-to-b from-background via-background/80 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-32 bg-gradient-to-t from-background via-background/80 to-transparent" />
      <div className="absolute right-5 top-6 z-30 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[9px] font-medium uppercase tracking-[0.3em] text-ink/70 backdrop-blur-xl">
        <span className="h-1.5 w-1.5 rounded-full bg-seal" />
        Live Templates
      </div>
      <div
        className="td-marquee-track flex flex-col gap-5 px-5 py-20"
        style={{ animation: "td-scroll-up 50s linear infinite" }}
      >
        {loop.map((t, i) => (
          <Link
            key={`${t.id}-${i}`}
            to="/templates"
            hash={t.id}
            className="td-marquee-item block"
          >
            <DocThumb title={t.title} days={t.days} accent={t.accent} />
          </Link>
        ))}
      </div>
      <style>{`
        @keyframes td-scroll-up {
          from { transform: translateY(0); }
          to   { transform: translateY(-50%); }
        }
        .td-marquee-item { filter: blur(1.5px); opacity: 0.6; transition: filter 0.4s, opacity 0.4s, transform 0.4s; }
        .td-marquee-item:hover { filter: blur(0); opacity: 1; }
        aside:hover .td-marquee-track { animation-play-state: paused; }
        aside:hover .td-marquee-item { filter: blur(0); opacity: 1; }
      `}</style>
    </aside>
  );
}