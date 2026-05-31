import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { SKINS, type SkinModule } from "@/lib/skins/registry";
import { pickTemplate } from "@/lib/templates.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/templates")({
  component: TemplatesPage,
  head: () => ({
    meta: [
      { title: "Skins — TravelDoss" },
      {
        name: "description",
        content:
          "Pick a TravelDoss skin. Each is a distinct editorial design for your trip's dossier — one URL, one dollar, one month.",
      },
    ],
  }),
});

function SkinPreview({ skin }: { skin: SkinModule }) {
  const { Render, previewFixture, tokens } = skin;
  return (
    <div
      className="relative h-[420px] w-full overflow-hidden border"
      style={{ borderColor: "rgba(255,255,255,0.08)", background: tokens.bg }}
    >
      {/* Scale the real skin render to fit the tile so users see actual design */}
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{
          width: "1400px",
          transform: "scale(0.32)",
          transformOrigin: "top left",
          pointerEvents: "none",
        }}
      >
        {skin.tokens.fontUrl && (
          <link rel="stylesheet" href={skin.tokens.fontUrl} />
        )}
        <Render trip={previewFixture.trip} blocks={previewFixture.blocks} />
      </div>
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, transparent 55%, rgba(0,0,0,0.55) 100%)",
        }}
      />
    </div>
  );
}

function SkinCard({
  skin,
  onPick,
  picking,
}: {
  skin: SkinModule;
  onPick: (id: string) => void;
  picking: boolean;
}) {
  return (
    <article
      id={skin.meta.id}
      className="group flex h-full flex-col border border-ink/10 bg-paper transition-colors duration-500 hover:border-seal/50"
    >
      <SkinPreview skin={skin} />

      <div className="flex flex-1 flex-col p-7 md:p-8">
        <div className="flex items-center gap-2 text-[9px] font-medium uppercase tracking-[0.45em] text-ink/40">
          <span
            className="h-1 w-1 rounded-full"
            style={{ background: skin.tokens.accent }}
          />
          Skin
        </div>
        <h3
          className="mt-3 text-4xl font-normal leading-[1.05] tracking-tight text-ink md:text-5xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {skin.meta.codename}
        </h3>
        <p
          className="mt-3 text-sm italic leading-relaxed text-ink-soft md:text-base"
          style={{ fontFamily: "var(--font-display)" }}
        >
          "{skin.meta.personality}"
        </p>

        <button
          onClick={() => onPick(skin.meta.id)}
          disabled={picking}
          className="mt-auto inline-flex items-center justify-between gap-4 border-y border-ink/20 pt-7 pb-7 text-[10px] font-medium uppercase tracking-[0.4em] text-ink transition-colors duration-500 hover:border-seal hover:text-seal disabled:cursor-wait disabled:opacity-50"
          style={{ marginTop: 28 }}
        >
          <span>{picking ? "Minting your dossier…" : "Use this skin · $1"}</span>
          <span className="text-ink/40 group-hover:text-seal">→</span>
        </button>
      </div>
    </article>
  );
}

function TemplatesPage() {
  const [picking, setPicking] = useState<string | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const pickFn = useServerFn(pickTemplate);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setAuthed(!!data.user);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handlePick = async (id: string) => {
    if (authed === false) {
      navigate({ to: "/login" });
      return;
    }
    setPicking(id);
    try {
      const result = await pickFn({ data: { templateId: id } });
      navigate({ to: "/t/$slug", params: { slug: result.slug } });
    } catch (e) {
      console.error(e);
      alert("Could not mint your dossier. Please try again.");
    } finally {
      setPicking(null);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground selection:bg-seal/40">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>\")",
        }}
      />

      <header className="relative z-10 mx-auto flex max-w-[1600px] items-center justify-between border-b border-ink/10 px-6 py-6 md:px-12">
        <Link
          to="/"
          className="inline-flex items-center gap-3 text-[10px] font-medium uppercase tracking-[0.4em] text-ink/60 transition-colors hover:text-seal"
        >
          ← TravelDoss<span className="text-ink/30">®</span>
        </Link>
        <span className="inline-flex items-center gap-3 text-[10px] font-medium uppercase tracking-[0.4em] text-ink/60">
          <span className="h-px w-6 bg-ink/30" />
          The Skins
        </span>
      </header>

      <main className="relative z-10 mx-auto max-w-[1600px] px-6 pb-24 md:px-12">
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mt-16 text-[14vw] font-normal leading-[0.95] tracking-[-0.03em] md:text-[7vw]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          <span className="text-ink">Pick your </span>
          <span className="italic text-ink/85">skin<span className="text-seal">.</span></span>
        </motion.h1>
        <p className="mt-6 max-w-xl text-sm leading-relaxed text-ink-soft md:text-base">
          Eight named designs for your trip's microsite. One dollar mints a
          private URL for a month. Fill it yourself, scan your inbox, or paste
          in what ChatGPT gave you — the skin makes it look like a magazine
          either way.
        </p>
        <p className="mt-3 max-w-xl text-[10px] uppercase tracking-[0.4em] text-ink/40">
          {SKINS.length} of 8 live · more landing this week
        </p>

        <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {SKINS.map((skin) => (
            <SkinCard
              key={skin.meta.id}
              skin={skin}
              onPick={handlePick}
              picking={picking === skin.meta.id}
            />
          ))}
        </div>
      </main>
    </div>
  );
}