import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "motion/react";
import { Ribbon } from "@/components/landing/Ribbon";
import { InfiniteDocs } from "@/components/landing/InfiniteDocs";
import { FlowScroller } from "@/components/landing/FlowScroller";
import { TopoBackground } from "@/components/landing/TopoBackground";
import { TemplateGallery } from "@/components/flow/TemplateGallery";
import { IngestionModal } from "@/components/flow/IngestionModal";
import { GenerationLoader } from "@/components/GenerationLoader";
import { Parallax } from "@/components/motion/Tilt";
import { SKINS, type SkinModule } from "@/lib/skins/registry";
import type { Block } from "@/lib/skins/types";
import { createTripFromIngestion } from "@/lib/trips.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "TravelDoss — Plan trips, see them on a live map" },
      {
        name: "description",
        content:
          "Paste or write your trip in TravelDoss. Every place is pinned, categorized, and routed by day on a live map — and your dossier works offline.",
      },
      {
        property: "og:title",
        content: "TravelDoss — Plan trips, see them on a live map",
      },
      {
        property: "og:description",
        content:
          "Paste or write your trip in TravelDoss. Every place is pinned, categorized, and routed by day on a live map — and your dossier works offline.",
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

  // As soon as the server returns a slug, navigate — don't wait on the
  // loader's cosmetic step timing. The loader unmounts on route change.
  useEffect(() => {
    if (!pendingSlug) return;
    navigate({ to: "/t/$slug", params: { slug: pendingSlug }, search: { mode: "edit" } });
    setGenSteps(null);
    setPendingSlug(null);
  }, [pendingSlug, navigate]);

  useEffect(() => {
    const pendingTemplateId = window.sessionStorage.getItem("td_pending_template");
    if (!pendingTemplateId) return;

    const skin = SKINS.find((item) => item.meta.id === pendingTemplateId);
    if (!skin) {
      window.sessionStorage.removeItem("td_pending_template");
      return;
    }

    const pendingBlocks = window.sessionStorage.getItem("td_pending_blocks");
    const pendingStep = window.sessionStorage.getItem("td_pending_step") ?? "Reading your itinerary…";
    const pendingDestination = window.sessionStorage.getItem("td_pending_destination");
    window.sessionStorage.removeItem("td_pending_template");
    window.sessionStorage.removeItem("td_pending_blocks");
    window.sessionStorage.removeItem("td_pending_step");
    window.sessionStorage.removeItem("td_pending_destination");

    if (!pendingBlocks) {
      setPicked(skin);
      setModalOpen(true);
      return;
    }

    const resume = async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        setPicked(skin);
        setModalOpen(true);
        return;
      }
      setGenSteps([pendingStep, "Crafting your dossier…", "Designing the pages…"]);
      try {
        const r = await create({
          data: {
            templateId: skin.meta.id,
            blocks: JSON.parse(pendingBlocks) as Block[],
            ...(pendingDestination ? { destination: pendingDestination } : {}),
          },
        });
        setPendingSlug(r.slug);
      } catch (e) {
        console.error(e);
        toast.error("Couldn't create your dossier", { description: String(e) });
        setGenSteps(null);
      }
    };
    void resume();
  }, [create]);

  function openWithTemplate(skin: SkinModule) {
    setPicked(skin);
    setModalOpen(true);
  }

  async function handleGenerate(blocks: Block[], firstStep: string, destination: string | null) {
    if (!picked) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      window.sessionStorage.setItem("td_pending_template", picked.meta.id);
      window.sessionStorage.setItem("td_pending_blocks", JSON.stringify(blocks));
      window.sessionStorage.setItem("td_pending_step", firstStep);
      if (destination) window.sessionStorage.setItem("td_pending_destination", destination);
      toast.message("Sign in to compose your dossier", { description: "Your studio, your journeys — quiet and owned." });
      navigate({ to: "/login", search: { redirect: "/" } });
      return;
    }
    setModalOpen(false);
    setGenSteps([firstStep, "Crafting your dossier…", "Designing the pages…"]);
    try {
      const r = await create({
        data: {
          templateId: picked.meta.id,
          blocks,
          ...(destination ? { destination } : {}),
        },
      });
      setPendingSlug(r.slug);
    } catch (e) {
      console.error(e);
      toast.error("Couldn't create your dossier", { description: String(e) });
      setGenSteps(null);
    }
  }

  return (
    <div className="relative min-h-dvh overflow-x-clip text-foreground selection:bg-seal/40">
      <TopoBackground />
      {/* Film grain + vignette */}
      <Parallax depth={28} className="pointer-events-none fixed inset-0 z-0">
        <div aria-hidden className="absolute inset-0 opacity-[0.05] mix-blend-overlay"
             style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>\")" }} />
      </Parallax>
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0"
           style={{ background: "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.55) 100%)" }} />

      <Ribbon />

      {/* Under Construction banner */}
      <div className="relative z-20 flex items-center justify-center gap-2 bg-seal/10 px-4 py-2 text-center text-[11px] font-medium uppercase tracking-[0.3em] text-seal backdrop-blur-sm border-b border-seal/10">
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-seal" />
        Under Construction — Things may change.
      </div>

      {/* Center stage */}
      <main className="relative z-10 mx-auto flex min-h-[82dvh] max-w-[1400px] flex-col items-center justify-center px-6 py-10 text-center md:min-h-[76dvh] md:py-8 md:pl-32 md:pr-[340px]">
        <Parallax depth={-6}>
        <Link
          to="/login"
          className="td-shimmer mb-4 inline-flex items-center gap-2 rounded-full border border-ink/20 bg-paper/40 px-4 py-1.5 text-[10px] font-medium uppercase tracking-[0.4em] text-ink/70 backdrop-blur-sm transition-colors hover:border-seal hover:text-seal"
        >
          Login
        </Link>
        <motion.span
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mb-6 inline-flex flex-col items-center gap-3 text-[10px] font-medium uppercase tracking-[0.4em] text-ink/55"
        >
          <span className="inline-flex items-center gap-3">
            <span className="h-px w-8 bg-ink/30" />
            Travel Better.
            <span className="h-px w-8 bg-ink/30" />
          </span>
          <span className="border border-ink/10 px-2.5 py-1 text-[9px] tracking-[0.35em] text-ink/35">
            Itineraries suck.
          </span>
        </motion.span>
        </Parallax>

        <Parallax depth={-14}>
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          className="text-[18vw] font-normal leading-[0.95] tracking-[-0.03em] md:text-[9vw]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          <span className="text-ink">Travel</span>
          <br />
          <span className="italic text-ink/90">Doss<span className="text-seal">.</span></span>
        </motion.h1>
        </Parallax>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.3 }}
          className="mt-6 max-w-md text-[13px] leading-relaxed text-ink-soft md:text-sm"
        >
          Transform scattered plans into a beautifully organized dossier,
          complete with mapped routes, reservations, and a day-by-day journey.
        </motion.p>

        {/* Editorial CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="relative mt-8"
        >
          <Link
            to="/templates"
            className="group surface-card relative inline-flex items-center gap-5 rounded-md py-5 pl-5 pr-3 text-[11px] font-medium uppercase tracking-[0.4em] text-ink transition-elegant hover:text-seal"
          >
            <span className="text-seal/70 transition-elegant group-hover:text-seal">01</span>
            <span>Pick a dossier template</span>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-sm border border-white/10 bg-paper/40 transition-elegant group-hover:border-seal group-hover:bg-seal group-hover:text-paper">
              <svg className="h-3.5 w-3.5 transition-transform duration-500 group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </Link>
        </motion.div>

        <div className="mt-8 flex items-center gap-4 text-[9px] font-medium uppercase tracking-[0.45em] text-ink/35">
          <div className="h-px w-10 bg-ink/15" />
          Do your itinerary justice.
          <div className="h-px w-10 bg-ink/15" />
        </div>

        {/* Mobile-only quick chips */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3 md:hidden">
          {[
            { to: "/app" as const, label: "Browse Places" },
            { to: "/templates" as const, label: "Dossier Templates" },
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

      <div id="flow" />
      <FlowScroller />

      <div id="templates" className="sr-only" />
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
            setGenSteps(null);
            setPendingSlug(null);
          }
          // If slug isn't ready yet, keep the loader open until it arrives.
        }}
      />
    </div>
  );
}
