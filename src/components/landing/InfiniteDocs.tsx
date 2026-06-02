import { Link } from "@tanstack/react-router";
import { SKINS, type SkinModule } from "@/lib/skins/registry";

function SkinMiniPreview({ skin }: { skin: SkinModule }) {
  const { Render, previewFixture, tokens } = skin;
  return (
    <div
      className="relative h-[110px] w-full overflow-hidden"
      style={{ background: tokens.bg }}
      aria-hidden
    >
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{
          width: "1400px",
          transform: "scale(0.18)",
          transformOrigin: "top left",
          pointerEvents: "none",
        }}
      >
        {tokens.fontUrl && <link rel="stylesheet" href={tokens.fontUrl} />}
        <Render trip={previewFixture.trip} blocks={previewFixture.blocks} />
      </div>
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.55) 100%)",
        }}
      />
    </div>
  );
}

function DocThumb({ skin }: { skin: SkinModule }) {
  const { codename, personality } = skin.meta;
  const accent = skin.tokens.accent;
  return (
    <article className="surface-card relative w-full overflow-hidden rounded-lg">
      <div
        className="absolute left-0 top-0 h-full w-px"
        style={{ background: accent }}
        aria-hidden
      />
      <SkinMiniPreview skin={skin} />
      <div className="flex items-center justify-between px-5 pt-4">
        <span className="text-[8px] font-medium uppercase tracking-[0.4em] text-ink/35">
          Skin
        </span>
        <span className="text-[8px] font-medium uppercase tracking-[0.4em] text-ink/35">
          $1 · 30d
        </span>
      </div>
      <h4
        className="mt-3 px-5 text-xl font-normal leading-tight tracking-tight text-ink"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {codename}
      </h4>
      <p
        className="mt-2 px-5 pb-10 text-xs italic leading-relaxed text-ink-soft"
        style={{ fontFamily: "var(--font-display)" }}
      >
        "{personality}"
      </p>
      <div className="absolute bottom-3 left-5 right-5 flex justify-between text-[8px] uppercase tracking-[0.4em] text-ink/25">
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
            <DocThumb skin={s} />
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