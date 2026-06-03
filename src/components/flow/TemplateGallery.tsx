import { motion } from "motion/react";
import { SKINS, type SkinModule } from "@/lib/skins/registry";

export function TemplateGallery({ onPick }: { onPick: (skin: SkinModule) => void }) {
  return (
    <section className="relative z-10 mx-auto w-full max-w-[1200px] px-6 pb-32 md:pl-32 md:pr-[340px]">
      <div className="mb-10 flex items-baseline justify-between">
        <div className="flex items-center gap-3 text-[10px] font-medium uppercase tracking-[0.45em] text-ink/55">
          <span className="h-px w-8 bg-ink/30" />
          The Templates
        </div>
        <p className="hidden text-[11px] uppercase tracking-[0.3em] text-ink/40 md:block">
          Begin your journey
        </p>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {SKINS.map((skin, i) => (
          <motion.button
            key={skin.meta.id}
            onClick={() => onPick(skin)}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
            className="surface-card group relative flex flex-col overflow-hidden rounded-lg text-left transition-elegant hover:-translate-y-1 hover:ring-1 hover:ring-seal/60"
          >
            <div
              className="absolute left-0 top-0 h-full w-px"
              style={{ background: skin.tokens.accent }}
              aria-hidden
            />
            <div
              className="relative h-[180px] w-full overflow-hidden"
              style={{ background: skin.tokens.bg }}
              aria-hidden
            >
              <div
                className="absolute left-0 top-0 origin-top-left"
                style={{ width: 1400, transform: "scale(0.22)", pointerEvents: "none" }}
              >
                {skin.tokens.fontUrl && <link rel="stylesheet" href={skin.tokens.fontUrl} />}
                <skin.Render trip={skin.previewFixture.trip} blocks={skin.previewFixture.blocks} />
              </div>
              <div
                className="absolute inset-0"
                style={{ background: "linear-gradient(180deg, transparent 45%, rgba(0,0,0,0.55) 100%)" }}
              />
            </div>
            <div className="flex flex-1 flex-col gap-2 p-5">
              <span className="text-[9px] font-medium uppercase tracking-[0.4em] text-ink/35">
                Template
              </span>
              <h3
                className="text-2xl font-normal tracking-tight text-ink"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {skin.meta.codename}
              </h3>
              <p
                className="text-xs italic leading-relaxed text-ink-soft"
                style={{ fontFamily: "var(--font-display)" }}
              >
                "{skin.meta.personality}"
              </p>
              <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 text-[10px] uppercase tracking-[0.35em] text-ink/40">
                <span>Use this template</span>
                <span className="text-seal/70 transition-elegant group-hover:text-seal">→</span>
              </div>
            </div>
          </motion.button>
        ))}
      </div>
    </section>
  );
}