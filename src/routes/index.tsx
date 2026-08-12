import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { InViewLazy } from "@/components/landing/InViewLazy";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "motion/react";
import { Ribbon } from "@/components/landing/Ribbon";
import { SandHero } from "@/components/landing/SandHero";
import { TopoBackground } from "@/components/landing/TopoBackground";
// Lazy: the composer (and the @dnd-kit tree it drags in — ~60 kB gzip) is
// only needed after a click; keeping it out of the landing chunk shortens
// time-to-interactive on the highest-traffic page. Once opened it stays
// mounted so closing the modal keeps any typed draft, same as before.
const IngestionModal = lazy(() =>
  import("@/components/flow/IngestionModal").then((m) => ({ default: m.IngestionModal })),
);
// Below-the-fold sections are gated behind IntersectionObserver via
// <InViewLazy>: the chunk network fetch starts when the section is
// within ~1200px of the viewport (prefetch) and React mounts it once
// it's within ~300px (mount). Rendering a plain React.lazy in JSX would
// have fetched all three chunks on landing paint, which was the whole
// reason the page felt slow. Each import factory is stable (module
// scope) so InViewLazy's effect never re-tears its observers.
const loadInfiniteDocs = () =>
  import("@/components/landing/InfiniteDocs").then((m) => ({ default: m.InfiniteDocs }));
const loadFlowScroller = () =>
  import("@/components/landing/FlowScroller").then((m) => ({ default: m.FlowScroller }));
const loadTemplateGallery = () =>
  import("@/components/flow/TemplateGallery").then((m) => ({ default: m.TemplateGallery }));
import { GenerationLoader } from "@/components/GenerationLoader";
import { ActionDock } from "@/components/landing/ActionDock";
import { Parallax } from "@/components/motion/Tilt";
import { SKINS, type SkinModule } from "@/lib/skins/registry";
import type { Block } from "@/lib/skins/types";
import { createTripFromIngestion, listTrips } from "@/lib/trips.functions";
import { getTemporalPhase } from "@/lib/itinerary/temporal";
import { MobileNavBar } from "@/components/mobile/MobileNavBar";
import { SiteFooter } from "@/components/legal/SiteFooter";
import { LegalDocDialog } from "@/components/legal/LegalDocDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SITE_URL } from "@/lib/site";
import { clearPendingComposer, peekPendingComposer } from "@/lib/mint-pending";

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
  // Session-aware Login pill: signed-in visitors already have the rail
  // identity chip (with matching shimmer), so the hero pill is redundant
  // — and worse, tapping it bounces off /login's already-signed-in
  // redirect and reads as broken.
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data }) => {
      if (alive) setSignedIn(!!data.user);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setSignedIn(!!session?.user);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  // Mount-on-first-open for the lazy composer: never unmount afterwards,
  // so a closed-then-reopened modal keeps its draft state.
  const [modalMounted, setModalMounted] = useState(false);
  useEffect(() => {
    if (modalOpen) setModalMounted(true);
  }, [modalOpen]);
  const [initialTab, setInitialTab] = useState<"paste" | "transcript">("paste");
  const [minting, setMinting] = useState(false);
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);
  const create = useServerFn(createTripFromIngestion);
  const navigate = useNavigate();

  // Signed-in visitors get trip-aware CTAs: a LIVE trip outranks an
  // upcoming one outranks minting something new. Failures degrade to the
  // signed-out layout — the landing never blocks on this fetch.
  type TripLite = {
    slug: string;
    destination: string;
    start_date: string | null;
    end_date: string | null;
  };
  const fetchTrips = useServerFn(listTrips);
  const [myTrips, setMyTrips] = useState<TripLite[] | null>(null);
  useEffect(() => {
    if (!signedIn) {
      setMyTrips(null);
      return;
    }
    let alive = true;
    fetchTrips()
      .then((r) => {
        if (alive) setMyTrips((r.trips ?? []) as TripLite[]);
      })
      .catch(() => {
        if (alive) setMyTrips([]);
      });
    return () => {
      alive = false;
    };
  }, [signedIn, fetchTrips]);
  const tripCtas = useMemo(() => {
    if (!myTrips) return null;
    let live: TripLite | null = null;
    let upcoming: TripLite | null = null;
    // Local-day string (toISOString is UTC and misclassifies for part of
    // the day). ">= today" — not ">" — so a trip starting today that the
    // (UTC-parsed) phase check hasn't flipped to active yet still shows as
    // Upcoming instead of falling into neither bucket.
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    for (const t of myTrips) {
      const phase = getTemporalPhase(t.start_date, t.end_date);
      if (phase === "active") {
        if (!live) live = t;
      } else if (t.start_date && t.start_date >= today) {
        if (!upcoming || t.start_date < (upcoming.start_date ?? "")) upcoming = t;
      }
    }
    return { live, upcoming };
  }, [myTrips]);

  // As soon as the server returns a slug, navigate — don't wait on the
  // loader's cosmetic step timing. The loader unmounts on route change.
  useEffect(() => {
    if (!pendingSlug) return;
    navigate({ to: "/t/$slug", params: { slug: pendingSlug }, search: { mode: "edit" } });
    setMinting(false);
    setPendingSlug(null);
  }, [pendingSlug, navigate]);

  useEffect(() => {
    const pendingTemplateId = window.sessionStorage.getItem("td_pending_template");

    // A composer draft (paste/generate text stashed by the mint modal's
    // auth gate) reopens the modal; the modal hydrates and consumes it.
    // The blocks-resume path below wins when both somehow exist.
    if (!pendingTemplateId) {
      const draft = peekPendingComposer();
      if (!draft) return;
      const draftSkin = SKINS.find((item) => item.meta.id === draft.templateId);
      if (!draftSkin) {
        clearPendingComposer();
        return;
      }
      setPicked(draftSkin);
      setModalOpen(true);
      return;
    }

    const skin = SKINS.find((item) => item.meta.id === pendingTemplateId);
    const clearPending = () => {
      window.sessionStorage.removeItem("td_pending_template");
      window.sessionStorage.removeItem("td_pending_blocks");
      window.sessionStorage.removeItem("td_pending_step");
      window.sessionStorage.removeItem("td_pending_destination");
      window.sessionStorage.removeItem("td_pending_dates");
    };
    if (!skin) {
      clearPending();
      return;
    }

    const pendingBlocks = window.sessionStorage.getItem("td_pending_blocks");
    const pendingStep =
      window.sessionStorage.getItem("td_pending_step") ?? "Reading your itinerary…";
    const pendingDestination = window.sessionStorage.getItem("td_pending_destination");
    const pendingDatesRaw = window.sessionStorage.getItem("td_pending_dates");
    let pendingDates: { startDate: string | null; endDate: string | null } | null = null;
    try {
      pendingDates = pendingDatesRaw ? JSON.parse(pendingDatesRaw) : null;
    } catch {
      pendingDates = null;
    }

    if (!pendingBlocks) {
      clearPending();
      setPicked(skin);
      setModalOpen(true);
      return;
    }

    const resume = async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        // Still signed out (they backed out of login): keep the pending
        // payload for a later authed visit — clearing here used to discard
        // the parsed blocks entirely — and show them where they were.
        setPicked(skin);
        setModalOpen(true);
        return;
      }
      setMinting(true);
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
        clearPending();
        setPendingSlug(r.slug);
      } catch (e) {
        // Keep the payload: the next visit retries instead of losing work.
        console.error(e);
        toast.error("Couldn't create your dossier", { description: String(e) });
        setMinting(false);
      }
    };
    void resume();
  }, [create]);

  function openWithTemplate(skin: SkinModule) {
    setInitialTab("paste");
    setPicked(skin);
    setModalOpen(true);
  }

  // Dock actions default to the first skin in the registry so visitors
  // can enter the compose flow without picking a template first — they
  // can still switch templates from inside the modal / studio later.
  function openDock(tab: "paste" | "transcript") {
    setInitialTab(tab);
    setPicked((prev) => prev ?? SKINS[0] ?? null);
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
      toast.message("Sign in to compose your dossier", {
        description: "Your studio, your journeys — quiet and owned.",
      });
      navigate({ to: "/login", search: { redirect: "/" } });
      return;
    }
    setModalOpen(false);
    setMinting(true);
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
      setMinting(false);
    }
  }

  return (
    <div className="relative min-h-dvh overflow-x-clip text-foreground selection:bg-seal/40">
      <TopoBackground />
      {/* Film grain + vignette */}
      <Parallax depth={28} className="pointer-events-none fixed inset-0 z-0">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.05] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>\")",
          }}
        />
      </Parallax>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.55) 100%)",
        }}
      />

      <Ribbon />

      {/* Under Construction banner */}
      <div className="relative z-20 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 bg-seal/10 px-4 py-2 text-center text-[10px] font-medium uppercase tracking-[0.2em] text-seal backdrop-blur-sm border-b border-seal/10 sm:text-[11px] sm:tracking-[0.3em]">
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-seal" />
          Under Construction — Things may change.
        </span>
        <span className="normal-case tracking-normal text-[11px] text-ink/70">
          By using TravelDoss, you agree to the{" "}
          <LegalDocDialog
            slug="terms"
            label="Terms and Conditions"
            className="tap underline decoration-seal/60 underline-offset-2 transition-colors hover:text-seal"
          />{" "}
          as well as the{" "}
          <LegalDocDialog
            slug="privacy"
            label="Privacy Policy"
            className="tap underline decoration-seal/60 underline-offset-2 transition-colors hover:text-seal"
          />
          .
        </span>
      </div>

      {/* Center stage */}
      <main className="relative z-10 mx-auto flex min-h-[82dvh] max-w-[1400px] flex-col items-center justify-center px-6 py-10 text-center md:min-h-[76dvh] md:py-8 md:pl-32 md:pr-[340px]">
        <Parallax depth={-6}>
          {signedIn === false && (
            <Link
              to="/login"
              className="td-shimmer tap mb-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-ink/20 bg-surface/70 px-4 py-1.5 text-[10px] font-medium uppercase tracking-[0.4em] text-ink/70 shadow-[var(--highlight-inset)] backdrop-blur-sm transition-colors hover:border-seal hover:text-seal"
            >
              Login
            </Link>
          )}
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

        {/* Editorial CTAs. Signed-out: the single template invitation.
            Signed-in: the journey ladder — a LIVE trip outranks an upcoming
            one outranks minting anew; buttons only exist when their trip
            does. All share the numbered surface-card language (no pills). */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          // The wordmark's em-box carries dead font padding below the
          // descenders — measured at ~21.5% of the hero's height, which is
          // clamp(240px, 24vw, 460px). Subtracting it keeps the VISIBLE gap
          // to the inscription at ~40px on every viewport; a fixed margin
          // reads too loose on small screens and too tight on large ones.
          className="relative mt-[calc(40px_-_clamp(52px,5.2vw,99px))] flex flex-col items-center gap-3"
        >
          {(() => {
            const arrow = (
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-white/10 bg-paper/40 transition-elegant group-hover:border-seal group-hover:bg-seal group-hover:text-paper">
                <svg
                  className="h-3.5 w-3.5 transition-transform duration-500 group-hover:translate-x-0.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            );
            const ctaCls =
              "group surface-card relative inline-flex w-full max-w-md items-center gap-5 rounded-md py-5 pl-5 pr-3 text-[11px] font-medium uppercase tracking-[0.4em] text-ink transition-elegant hover:text-seal sm:w-auto sm:min-w-[380px]";
            const rows: ReactNode[] = [];
            let n = 0;
            const num = () => String(++n).padStart(2, "0");
            if (tripCtas?.live) {
              rows.push(
                <Link
                  key="live"
                  to="/t/$slug"
                  params={{ slug: tripCtas.live.slug }}
                  className={`${ctaCls} td-live-glow`}
                  aria-label={`Open your live trip to ${tripCtas.live.destination}`}
                >
                  <span className="text-seal/70 transition-elegant group-hover:text-seal">
                    {num()}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col items-start gap-1 text-left normal-case tracking-normal">
                    <span className="inline-flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.4em] text-seal">
                      <span
                        aria-hidden
                        className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-seal"
                      />
                      Live now
                    </span>
                    <span className="truncate font-serif text-lg normal-case tracking-normal">
                      {tripCtas.live.destination}
                    </span>
                  </span>
                  {arrow}
                </Link>,
              );
            }
            if (tripCtas?.upcoming) {
              rows.push(
                <Link
                  key="upcoming"
                  to="/t/$slug"
                  params={{ slug: tripCtas.upcoming.slug }}
                  className={ctaCls}
                  aria-label={`Open your upcoming trip to ${tripCtas.upcoming.destination}`}
                >
                  <span className="text-seal/70 transition-elegant group-hover:text-seal">
                    {num()}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col items-start gap-1 text-left">
                    <span className="text-[9px] font-semibold uppercase tracking-[0.4em] text-ink/50">
                      Upcoming
                      {tripCtas.upcoming.start_date
                        ? ` · ${new Date(`${tripCtas.upcoming.start_date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                        : ""}
                    </span>
                    <span className="truncate font-serif text-lg normal-case tracking-normal">
                      {tripCtas.upcoming.destination}
                    </span>
                  </span>
                  {arrow}
                </Link>,
              );
            }
            rows.push(
              <Link key="new" to="/templates" className={ctaCls}>
                <span className="text-seal/70 transition-elegant group-hover:text-seal">
                  {num()}
                </span>
                <span className="flex-1 text-left">
                  {rows.length > 0 ? "Mint a new dossier" : "Pick a dossier template"}
                </span>
                {arrow}
              </Link>,
            );
            return rows;
          })()}
        </motion.div>

        {/* Dictionary definition — the site's quotable, extractable answer to
            "what is a travel dossier?" (also the AEO citation target). */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.55 }}
          className="mt-12 w-full max-w-xl"
        >
          {/* /45 not /30: this eyebrow carries the page's key question and
              was the least-legible text on the landing (≈2:1 on the navy). */}
          <p className="text-center text-[9px] font-medium uppercase tracking-[0.45em] text-ink/45">
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
                  A beautifully composed itinerary of your trip, day by day: where you're going,
                  what you're doing, and what to know when you arrive. A designed artifact you'll
                  keep long after the journey ends.
                </span>
              </li>
              <li className="flex gap-4">
                <span className="shrink-0 font-serif italic text-seal/60">2.</span>
                <span>
                  Transform scattered plans into a beautifully organized travel dossier, complete
                  with <em className="not-italic text-ink">mapped routes</em>,{" "}
                  <em className="not-italic text-ink">reservations</em>, and{" "}
                  <em className="not-italic text-ink">a day-by-day journey</em>.
                </span>
              </li>
              <li className="flex gap-4">
                <span className="shrink-0 font-serif italic text-seal/60">3.</span>
                <span className="italic text-ink/55">The cure for the common itinerary.</span>
              </li>
            </ol>
          </div>
        </motion.section>

        <div className="mt-8 flex items-center gap-4 text-[9px] font-medium uppercase tracking-[0.45em] text-ink/45">
          <div className="h-px w-10 bg-ink/15" />
          Do your itinerary justice.
          <div className="h-px w-10 bg-ink/15" />
        </div>

        {/* Mobile-only quick chips. The md:hidden must live on a plain
            wrapper: .scroll-x is unlayered CSS whose display:flex beats
            Tailwind's layered md:hidden on the same element. */}
        <div className="md:hidden">
          <div className="scroll-x edge-fade-x mt-10 items-center gap-3 px-1">
            {/* /app chips are members-only destinations: for signed-out
              visitors the label promises browsing but delivers the login
              wall, so they only render once a session is confirmed. */}
            {[
              ...(signedIn ? [{ to: "/app" as const, label: "Browse Places" }] : []),
              { to: "/templates" as const, label: "Dossier Templates" },
              ...(signedIn ? [{ to: "/app" as const, label: "Past Trips" }] : []),
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
        </div>
        {/* Clearance for the fixed mobile nav bar. */}
        <div aria-hidden className="h-16 md:hidden" />
      </main>

      <MobileNavBar />

      <InViewLazy
        load={loadInfiniteDocs}
        componentProps={{ onPickTemplate: openWithTemplate }}
        minHeight={240}
      />

      <div id="flow" />
      <InViewLazy load={loadFlowScroller} componentProps={{}} minHeight={480} />

      <div id="templates" className="sr-only" />
      <InViewLazy
        load={loadTemplateGallery}
        componentProps={{ onPick: openWithTemplate }}
        minHeight={600}
      />

      <SiteFooter mobileNavClearance />

      {modalMounted && (
        <Suspense fallback={null}>
          <IngestionModal
            open={modalOpen}
            onOpenChange={setModalOpen}
            template={picked}
            onGenerate={handleGenerate}
            initialTab={initialTab}
          />
        </Suspense>
      )}

      <GenerationLoader open={minting} label="Composing your dossier" />

      <ActionDock
        onCompose={() => openDock("paste")}
        onPaste={() => openDock("paste")}
        onImport={() => openDock("transcript")}
      />
    </div>
  );
}
