import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "motion/react";
import { Ribbon } from "@/components/landing/Ribbon";
import { InfiniteDocs } from "@/components/landing/InfiniteDocs";
import { TemplateGallery } from "@/components/flow/TemplateGallery";
import { IngestionModal } from "@/components/flow/IngestionModal";
import { GenerationLoader } from "@/components/GenerationLoader";
import type { SkinModule } from "@/lib/skins/registry";
import type { Block } from "@/lib/skins/types";
import { createTripFromIngestion } from "@/lib/trips.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "TravelDoss — Plan trips in a Google Doc, see them on a map" },
      {
        name: "description",
        content:
          "Write your trip in a Google Doc. TravelDoss pins, categorizes, and routes every place by day on a live Google Map.",
      },
      {
        property: "og:title",
        content: "TravelDoss — Plan trips in a Google Doc, see them on a map",
      },
      {
        property: "og:description",
        content:
          "Write your trip in a Google Doc. TravelDoss pins, categorizes, and routes every place by day on a live Google Map.",
      },
      { property: "og:url", content: "https://traveldoss.lovable.app/" },
    ],
    links: [{ rel: "canonical", href: "https://traveldoss.lovable.app/" }],
  }),
});

function Landing() {
  const [picked, setPicked] = useState<SkinModule | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [genSteps, setGenSteps] = useState<string[] | null>(null);
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);
  const create = useServerFn(createTripFromIngestion);
  const navigate = useNavigate();

  function openWithTemplate(skin: SkinModule) {
    setPicked(skin);
    setModalOpen(true);
  }

  async function handleGenerate(blocks: Block[], firstStep: string) {
    if (!picked) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      toast.message("Sign in to compose your dossier", { description: "Your studio, your journeys — quiet and owned." });
      navigate({ to: "/login" });
      return;
    }
    setModalOpen(false);
    setGenSteps([firstStep, "Crafting your dossier…", "Designing the pages…"]);
    try {
      const r = await create({ data: { templateId: picked.meta.id, blocks } });
      setPendingSlug(r.slug);
    } catch (e) {
      console.error(e);
      toast.error("Couldn't create your dossier", { description: String(e) });
      setGenSteps(null);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground selection:bg-seal/40">
      {/* Film grain + vignette */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 opacity-[0.05] mix-blend-overlay"
           style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>\")" }} />
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0"
           style={{ background: "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.55) 100%)" }} />

      <Ribbon />

      {/* Center stage */}
      <main className="relative z-10 mx-auto flex min-h-screen max-w-[1400px] flex-col items-center justify-center px-6 py-16 text-center md:pl-32 md:pr-[340px]">
        <motion.span
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mb-10 inline-flex flex-col items-center gap-3 text-[10px] font-medium uppercase tracking-[0.4em] text-ink/55"
        >
          <span className="inline-flex items-center gap-3">
            <span className="h-px w-8 bg-ink/30" />
            TravelDoss<span className="text-ink/30">®</span>
            <span className="h-px w-8 bg-ink/30" />
          </span>
          <span className="border border-ink/10 px-2.5 py-1 text-[9px] tracking-[0.35em] text-ink/35">
            Under Construction
          </span>
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          className="text-[18vw] font-normal leading-[0.95] tracking-[-0.03em] md:text-[9vw]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          <span className="text-ink">The art of</span>
          <br />
          <span className="italic text-ink/90">arriving well<span className="text-seal">.</span></span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.3 }}
          className="mt-10 max-w-md text-[13px] leading-relaxed text-ink-soft md:text-sm"
        >
          A quiet studio for travel. Transform scattered plans into a beautifully
          organized dossier, complete with mapped routes, reservations, and a
          day-by-day journey.
        </motion.p>

        {/* Editorial CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="relative mt-14"
        >
          <a
            href="#templates"
            className="group surface-card relative inline-flex items-center gap-5 rounded-md py-5 pl-5 pr-3 text-[11px] font-medium uppercase tracking-[0.4em] text-ink transition-elegant hover:text-seal"
          >
            <span className="text-seal/70 transition-elegant group-hover:text-seal">01</span>
            <span>Pick a TravelDoss Template</span>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-sm border border-white/10 bg-paper/40 transition-elegant group-hover:border-seal group-hover:bg-seal group-hover:text-paper">
              <svg className="h-3.5 w-3.5 transition-transform duration-500 group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </a>
        </motion.div>

        <div className="mt-16 flex items-center gap-4 text-[9px] font-medium uppercase tracking-[0.45em] text-ink/35">
          <div className="h-px w-10 bg-ink/15" />
          Do your itinerary justice.
          <div className="h-px w-10 bg-ink/15" />
        </div>

        {/* Mobile-only quick chips */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3 md:hidden">
          {[
            { to: "/app" as const, label: "Browse Places" },
            { to: "/templates" as const, label: "Templates" },
            { to: "/app" as const, label: "Past Trips" },
          ].map((c) => (
            <Link
              key={c.label}
              to={c.to}
              className="border border-ink/15 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.3em] text-ink/70 transition-colors hover:border-seal hover:text-seal"
            >
              {c.label}
            </Link>
          ))}
        </div>
      </main>

      <InfiniteDocs onPickTemplate={openWithTemplate} />

      <div id="templates" />
      <TemplateGallery onPick={openWithTemplate} />

      <IngestionModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        template={picked}
        onGenerate={handleGenerate}
      />

      <GenerationLoader
        open={genSteps !== null}
        steps={genSteps ?? []}
        onDone={() => {
          if (pendingSlug) {
            navigate({ to: "/t/$slug", params: { slug: pendingSlug }, search: { mode: "edit" } });
          }
          setGenSteps(null);
          setPendingSlug(null);
        }}
      />
    </div>
  );
}
