import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "motion/react";
import { Ribbon } from "@/components/landing/Ribbon";
import { SandHero } from "@/components/landing/SandHero";
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
import { SITE_URL } from "@/lib/site";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "TravelDoss — Create beautiful dossiers for unforgettable journeys" },
      {
        name: "description",
        content:
          "Create beautiful dossiers for unforgettable journeys. Paste or write your trip — every place pinned, categorized, and routed by day on a live map, offline-ready.",
      },
      {
        property: "og:title",
        content: "TravelDoss — Create beautiful dossiers for unforgettable journeys",
      },
      {
        property: "og:description",
        content:
          "Create beautiful dossiers for unforgettable journeys. Paste or write your trip — every place pinned, categorized, and routed by day on a live map, offline-ready.",
      },
      { property: "og:url", content: `${SITE_URL}/` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/` }],
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
    const pendingDatesRaw = window.sessionStorage.getItem("td_pending_dates");
    window.sessionStorage.removeItem("td_pending_template");
    window.sessionStorage.removeItem("td_pending_blocks");
    window.sessionStorage.removeItem("td_pending_step");
    window.sessionStorage.removeItem("td_pending_destination");
    window.sessionStorage.removeItem("td_pending_dates");
    let pendingDates: { startDate: string | null; endDate: string | null } | null = null;
    try {
      pendingDates = pendingDatesRaw ? JSON.parse(pendingDatesRaw) : null;
    } catch {
      pendingDates = null;
    }

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
            ...(pendingDates?.startDate ? { startDate: pendingDates.startDate } : {}),
            ...(pendingDates?.endDate ? { endDate: pendingDates.endDate } : {}),
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

  async function handleGenerate(
    blocks: Block[],
    firstStep: string,
    destination: string | null,
    dates?: { startDate: string | null; endDate: string | null },
  ) {
    if (!picked) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      window.sessionStorage.setItem("td_pending_template", picked.meta.id);
      window.sessionStorage.setItem("td_pending_blocks", JSON.stringify(blocks));
      window.sessionStorage.setItem("td_pending_step", firstStep);
      if (destination) window.sessionStorage.setItem("td_pending_destination", destination);
      if (dates) window.sessionStorage.setItem("td_pending_dates", JSON.stringify(dates));
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
          ...(dates?.startDate ? { startDate: dates.startDate } : {}),
          ...(dates?.endDate ? { endDate: dates.endDate } : {}),
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
      <div className="relative z-20 flex items-center justify-center gap-2 bg-seal/10 px-4 py-2 text-center text-[10px] font-medium uppercase tracking-[0.2em] text-seal backdrop-blur-sm border-b border-seal/10 sm:text-[11px] sm:tracking-[0.3em]">
        <span className="inline-block h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-seal" />
        <span className="truncate">Under Construction — Things may change.</span>
      </div>

      {/* Center stage */}
      <main className="relative z-10 mx-auto flex min-h-[82dvh] max-w-[1400px] flex-col items-center justify-center px-6 py-10 text-center md:min-h-[76dvh] md:py-8 md:pl-32 md:pr-[340px]">
        <Parallax depth={-6}>
        <Link
          to="/login"
          className="td-shimmer tap mb-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-ink/20 bg-paper/40 px-4 py-1.5 text-[10px] font-medium uppercase tracking-[0.4em] text-ink/70 backdrop-blur-sm transition-colors hover:border-seal hover:text-seal"
        >
          Login
        </Link>
        <motion.span
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mb-4 inline-flex flex-col items-center gap-3 text-[10px] font-medium uppercase tracking-[0.4em] text-ink/55"
        >
          <span className="inline-flex items-center gap-3">
            <span className="h-px w-8 bg-ink/30" />
            Travel Better.
            <span className="h-px w-8 bg-ink/30" />
          </span>
        </motion.span>
        </Parallax>

        <Parallax depth={-14}>
        {/* The headline is a living excavation: ~30k sand grains forming
            "Travel Doss.", uncovered by wind and the visitor's cursor. */}
        <SandHero
          className="h-[44vw] max-h-[460px] min-h-[240px] w-[min(94vw,1100px)] md:h-[24vw]"
          accessibleText="Travel Doss."
        />
        </Parallax>

        {/* Editorial CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="relative mt-10"
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

        {/* Dictionary definition — the site's quotable, extractable answer to
            "what is a travel dossier?" (also the AEO citation target). */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.55 }}
          className="mt-12 w-full max-w-xl"
        >
          <p className="text-center text-[9px] font-medium uppercase tracking-[0.45em] text-ink/30">
            Definition · What is a travel dossier?
          </p>
          <div className="mt-5 border-y border-ink/10 px-2 py-7 text-left sm:px-6">
            <p className="font-serif text-[22px] leading-tight text-ink sm:text-[26px]">
              trav·el dos·si·er
              <span className="ml-3 inline-block whitespace-nowrap align-middle font-sans text-[12px] tracking-wide text-ink/40 sm:text-[13px]">
                /ˈtra-vəl ˈdä-sē-ˌā/
              </span>
              <span className="ml-2.5 align-middle font-serif text-[13px] italic text-seal/80 sm:text-sm">
                noun
              </span>
            </p>
            <ol className="mt-6 space-y-5 font-serif text-[15px] leading-relaxed text-ink-soft sm:text-base">
              <li className="flex gap-4">
                <span className="shrink-0 font-serif italic text-seal/60">1.</span>
                <span>
                  A beautifully composed itinerary of your trip, day by day:
                  where you're going, what you're doing, and what to know when
                  you arrive. A designed artifact you'll keep long after the
                  journey ends.
                </span>
              </li>
              <li className="flex gap-4">
                <span className="shrink-0 font-serif italic text-seal/60">2.</span>
                <span>
                  Transform scattered plans into a beautifully organized travel
                  dossier, complete with <em className="not-italic text-ink">mapped routes</em>,{" "}
                  <em className="not-italic text-ink">reservations</em>, and{" "}
                  <em className="not-italic text-ink">a day-by-day journey</em>.
                </span>
              </li>
              <li className="flex gap-4">
                <span className="shrink-0 font-serif italic text-seal/60">3.</span>
                <span className="italic text-ink/55">
                  The cure for the common itinerary.
                </span>
              </li>
            </ol>
          </div>
        </motion.section>

        <div className="mt-8 flex items-center gap-4 text-[9px] font-medium uppercase tracking-[0.45em] text-ink/35">
          <div className="h-px w-10 bg-ink/15" />
          Do your itinerary justice.
          <div className="h-px w-10 bg-ink/15" />
        </div>

        {/* Mobile-only quick chips */}
        <div className="scroll-x edge-fade-x mt-10 items-center gap-3 px-1 md:hidden">
          {[
            { to: "/app" as const, label: "Browse Places" },
            { to: "/templates" as const, label: "Dossier Templates" },
            { to: "/app" as const, label: "Past Trips" },
          ].map((c) => (
            <Link
              key={c.label}
              to={c.to}
              className="shrink-0 border border-ink/15 px-4 py-3 text-[10px] font-medium uppercase tracking-[0.3em] text-ink/70 transition-colors hover:border-seal hover:text-seal"
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
