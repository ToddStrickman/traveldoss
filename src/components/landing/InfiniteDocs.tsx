import { Link } from "@tanstack/react-router";
import { SKINS } from "@/lib/skins/registry";

function DocThumb({ codename, personality, accent }: { codename: string; personality: string; accent: string }) {
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
          Skin
        </span>
        <span className="text-[8px] font-medium uppercase tracking-[0.4em] text-ink/35">
          $1 · 30d
        </span>
      </div>
      <h4
        className="mb-4 text-xl font-normal leading-tight tracking-tight text-ink"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {codename}
      </h4>
      <p className="text-xs italic leading-relaxed text-ink-soft" style={{ fontFamily: "var(--font-display)" }}>
        "{personality}"
      </p>
      <div className="absolute bottom-4 left-5 right-5 flex justify-between text-[8px] uppercase tracking-[0.4em] text-ink/25">
        <span>preview</span>
        <span>tap to open</span>
      </div>
    </article>
  );
}

export function InfiniteDocs() {
  const loop = [...SKINS, ...SKINS, ...SKINS, ...SKINS];
  return (
    <aside
      className="fixed right-0 top-0 z-10 hidden h-screen w-[320px] overflow-hidden border-l border-ink/10 md:block"
      aria-label="Skin previews"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-40 bg-gradient-to-b from-background via-background to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-40 bg-gradient-to-t from-background via-background to-transparent" />
      <div className="absolute right-5 top-6 z-30 inline-flex items-center gap-3 text-[9px] font-medium uppercase tracking-[0.45em] text-ink/55">
        <span className="h-px w-6 bg-ink/30" />
        The Skins
      </div>
      <div
        className="td-marquee-track flex flex-col gap-4 px-5 py-24"
        style={{ animation: "td-scroll-up 50s linear infinite" }}
      >
        {loop.map((s, i) => (
          <Link
            key={`${s.meta.id}-${i}`}
            to="/templates"
            hash={s.meta.id}
            className="td-marquee-item block"
          >
            <DocThumb
              codename={s.meta.codename}
              personality={s.meta.personality}
              accent={s.tokens.accent}
            />
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