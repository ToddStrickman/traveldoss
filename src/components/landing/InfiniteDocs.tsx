import { Link } from "@tanstack/react-router";
import { TEMPLATES } from "@/lib/templates";

function DocThumb({ title, days, accent }: { title: string; days: number; accent: string }) {
  return (
    <article
      className="relative h-[240px] w-full overflow-hidden border border-ink/10 bg-paper p-5 transition-all duration-500 hover:border-seal/40"
    >
      <div
        className="absolute left-0 top-0 h-full w-px"
        style={{ background: accent }}
        aria-hidden
      />
      <div className="mb-4 flex items-center justify-between">
        <span className="text-[8px] font-medium uppercase tracking-[0.4em] text-ink/35">
          Google Doc
        </span>
        <span className="text-[8px] font-medium uppercase tracking-[0.4em] text-ink/35">
          {String(days).padStart(2, "0")} days
        </span>
      </div>
      <h4
        className="mb-4 text-xl font-normal leading-tight tracking-tight text-ink"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {title}
      </h4>
      <div className="space-y-2">
        {[100, 88, 74, 92, 60, 80, 70].map((w, i) => (
          <div
            key={i}
            className="h-px bg-ink/12"
            style={{ width: `${w}%` }}
          />
        ))}
      </div>
      <div className="absolute bottom-4 left-5 right-5 flex justify-between text-[8px] uppercase tracking-[0.4em] text-ink/25">
        <span>draft</span>
        <span>edited · just now</span>
      </div>
    </article>
  );
}

export function InfiniteDocs() {
  const loop = [...TEMPLATES, ...TEMPLATES];
  return (
    <aside
      className="fixed right-0 top-0 z-10 hidden h-screen w-[320px] overflow-hidden border-l border-ink/10 md:block"
      aria-label="Template previews"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-40 bg-gradient-to-b from-background via-background to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-40 bg-gradient-to-t from-background via-background to-transparent" />
      <div className="absolute right-5 top-6 z-30 inline-flex items-center gap-3 text-[9px] font-medium uppercase tracking-[0.45em] text-ink/55">
        <span className="h-px w-6 bg-ink/30" />
        The Library
      </div>
      <div
        className="td-marquee-track flex flex-col gap-4 px-5 py-24"
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
        .td-marquee-item { opacity: 0.55; transition: opacity 0.5s; }
        .td-marquee-item:hover { opacity: 1; }
        aside:hover .td-marquee-track { animation-play-state: paused; }
        aside:hover .td-marquee-item { opacity: 1; }
      `}</style>
    </aside>
  );
}