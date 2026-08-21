import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { ArrowLeft, Search, X } from "lucide-react";
import { SKINS, type SkinModule } from "@/lib/skins/registry";
import { TiltCard } from "@/components/motion/Tilt";
import { InertRender } from "@/lib/skins/shared/views/parts";
import { SkinPeek } from "@/components/mobile/SkinPeek";
import { IngestionModal } from "@/components/flow/IngestionModal";
import {
  AtelierTable,
  MobileCoverRail,
  VerticalCoverStack,
} from "@/components/flow/AtelierTable";
import { GenerationLoader } from "@/components/GenerationLoader";
import { SandHero } from "@/components/landing/SandHero";
import { TopoBackground } from "@/components/landing/TopoBackground";
import { Ribbon } from "@/components/landing/Ribbon";
import { MobileNavBar } from "@/components/mobile/MobileNavBar";
import { createTripFromIngestion } from "@/lib/trips.functions";
import type { Block } from "@/lib/skins/types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PRICE_WORDS, SITE_URL } from "@/lib/site";
import { peekPendingComposer } from "@/lib/mint-pending";
import { capture } from "@/lib/analytics";
import { MintTermsGate, type MintTermsGateHandle } from "@/components/legal/MintTermsGate";

function TemplatesSkeleton() {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>\")",
        }}
      />

      <header className="relative z-10 mx-auto flex max-w-[1600px] items-center justify-between border-b border-ink/10 px-6 py-6 md:px-12">
        <div className="h-3 w-32 animate-pulse rounded bg-ink/10" />
        <div className="h-3 w-24 animate-pulse rounded bg-ink/10" />
      </header>

      <main className="relative z-10 mx-auto max-w-[1600px] px-5 pb-16 sm:px-6 sm:pb-24 md:px-12">
        <div className="mt-8 h-3 w-16 animate-pulse rounded bg-ink/10" />

        <div className="mt-16 h-[14vw] w-3/4 animate-pulse rounded bg-ink/10 md:h-[7vw]" />
        <div className="mt-6 h-4 w-full max-w-xl animate-pulse rounded bg-ink/10" />
        <div className="mt-2 h-4 w-48 animate-pulse rounded bg-ink/10" />
        <div className="mt-3 h-3 w-32 animate-pulse rounded bg-ink/10" />

        <div className="mt-10 flex flex-col gap-6">
          <div className="h-12 w-full max-w-md animate-pulse rounded bg-ink/10" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-7 w-20 animate-pulse rounded-full bg-ink/10" />
            ))}
          </div>
          <div className="h-3 w-24 animate-pulse rounded bg-ink/10" />
        </div>

        <div className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex h-full flex-col border border-ink/10 bg-surface"
            >
              <div className="h-[420px] w-full animate-pulse bg-ink/5" />
              <div className="flex flex-1 flex-col p-7 md:p-8">
                <div className="h-2 w-16 animate-pulse rounded bg-ink/10" />
                <div className="mt-3 h-10 w-3/4 animate-pulse rounded bg-ink/10" />
                <div className="mt-3 h-4 w-full animate-pulse rounded bg-ink/10" />
                <div className="mt-4 flex flex-wrap gap-2">
                  <div className="h-5 w-14 animate-pulse rounded-full bg-ink/10" />
                  <div className="h-5 w-16 animate-pulse rounded-full bg-ink/10" />
                </div>
                <div className="mt-auto h-10 w-full animate-pulse rounded bg-ink/10" style={{ marginTop: 28 }} />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

export const Route = createFileRoute("/templates")({
  component: TemplatesPage,
  pendingComponent: TemplatesSkeleton,
  validateSearch: (search: Record<string, unknown>): { pick?: string } => ({
    pick: typeof search.pick === "string" ? search.pick : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Travel Itinerary Templates — TravelDoss" },
      {
        name: "description",
        content: `Pick from ${SKINS.length} beautiful travel itinerary templates. Each dossier design maps your trip day by day — one URL, ${PRICE_WORDS}, one month.`,
      },
      {
        property: "og:title",
        content: "Travel Itinerary Templates — Editorial Dossier Designs | TravelDoss",
      },
      {
        property: "og:description",
        content: `${SKINS.length} editorial dossier templates for your trip. ${PRICE_WORDS.charAt(0).toUpperCase() + PRICE_WORDS.slice(1)}, one URL, one month — composed like a magazine.`,
      },
      { property: "og:url", content: `${SITE_URL}/templates` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/templates` }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "TravelDoss Travel Itinerary Templates",
          description:
            "Gallery of editorial travel itinerary and dossier templates for TravelDoss trips.",
          url: `${SITE_URL}/templates`,
        }),
      },
    ],
  }),
});

function SkinPreview({ skin }: { skin: SkinModule }) {
  const { Render, previewFixture, tokens } = skin;
  // Measured scale: desktops shrink the 1400px page to the tile; phones
  // render the skin's own 390px mobile layout near-legible. (CSS cqw math
  // can't produce a unitless scale factor cross-browser yet.)
  const tileRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ basis: 1400, scale: 0.32 });
  useEffect(() => {
    const el = tileRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      if (w <= 0) return;
      const basis = window.matchMedia("(max-width: 767px)").matches ? 390 : 1400;
      setFit({ basis, scale: w / basis });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div
      ref={tileRef}
      className="relative h-[420px] w-full overflow-hidden border"
      style={{ borderColor: "rgba(255,255,255,0.08)", background: tokens.bg }}
    >
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{
          width: `${fit.basis}px`,
          transform: `scale(${fit.scale})`,
          transformOrigin: "top left",
          pointerEvents: "none",
        }}
      >
        {skin.tokens.fontUrl && (
          <link rel="stylesheet" href={skin.tokens.fontUrl} />
        )}
        <InertRender>
          <Render trip={previewFixture.trip} blocks={previewFixture.blocks} />
        </InertRender>
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
  onOpen,
  onPrefetch,
  picking,
}: {
  skin: SkinModule;
  onPick: (id: string) => void;
  /** When set (mobile), tapping the card opens the peek instead of minting. */
  onOpen?: (id: string) => void;
  onPrefetch: (id: string) => void;
  picking: boolean;
}) {
  const activate = onOpen ?? onPick;
  return (
    <TiltCard intensity={5} className="h-full">
    <article
      id={skin.meta.id}
      role="button"
      tabIndex={picking ? -1 : 0}
      aria-disabled={picking}
      aria-busy={picking}
      onClick={() => !picking && activate(skin.meta.id)}
      onMouseEnter={() => onPrefetch(skin.meta.id)}
      onFocus={() => onPrefetch(skin.meta.id)}
      onKeyDown={(e) => {
        if (picking) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activate(skin.meta.id);
        }
      }}
      className="group flex h-full cursor-pointer flex-col border border-ink/10 bg-paper transition-colors duration-500 hover:border-seal/50 focus:outline-none focus-visible:border-seal focus-visible:ring-2 focus-visible:ring-seal/40"
    >
      <SkinPreview skin={skin} />

      <div className="flex flex-1 flex-col p-7 md:p-8">
        <div className="flex items-center gap-2 text-[9px] font-medium uppercase tracking-[0.45em] text-ink/55">
          <span
            className="h-1 w-1 rounded-full"
            style={{ background: skin.tokens.accent }}
          />
          Dossier Template
        </div>
        <h2
          className="mt-3 text-4xl font-normal leading-[1.05] tracking-tight text-ink md:text-5xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {/* A real link to the template's own spread page: crawlable,
              middle-clickable — the card's JS activation stays for taps. */}
          <Link
            to="/templates/$id"
            params={{ id: skin.meta.id }}
            onClick={(e) => e.stopPropagation()}
            className="transition-colors hover:text-seal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seal/40"
          >
            {skin.meta.codename}
          </Link>
        </h2>
        <p
          className="mt-3 text-sm italic leading-relaxed text-ink-soft md:text-base"
          style={{ fontFamily: "var(--font-display)" }}
        >
          "{skin.meta.personality}"
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {skin.meta.tags.map((tag) => (
            <span
              key={tag}
              className="inline-block rounded-full border border-ink/10 px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.2em] text-ink/60"
            >
              {tag}
            </span>
          ))}
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onPick(skin.meta.id);
          }}
          onMouseEnter={() => onPrefetch(skin.meta.id)}
          onFocus={() => onPrefetch(skin.meta.id)}
          disabled={picking}
          className="mt-auto inline-flex items-center justify-between gap-4 border-y border-ink/20 pt-7 pb-7 text-[10px] font-medium uppercase tracking-[0.4em] text-ink transition-colors duration-500 hover:border-seal hover:text-seal disabled:cursor-wait disabled:opacity-50"
          style={{ marginTop: 28 }}
        >
          <span className="inline-flex items-center gap-2">
            {picking && (
              <span
                aria-hidden
                className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent"
              />
            )}
            {picking ? "Minting your dossier…" : "Mint this dossier"}
          </span>
          <span className="text-ink/40 group-hover:text-seal">→</span>
        </button>
      </div>
    </article>
    </TiltCard>
  );
}

/** The three ways to browse the selection area. */
type BrowseMode = "grid" | "horizontal" | "vertical";

function TemplatesPage() {
  const [picking, setPicking] = useState<string | null>(null);
  const [peekId, setPeekId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  // Browse mode: horizontal cover rail / coverflow, a vertical stack of the
  // same covers, or the classic grid. Deterministic initial value keeps SSR
  // and the first client render identical; the saved preference applies
  // after mount.
  const [browse, setBrowse] = useState<BrowseMode>("horizontal");
  useEffect(() => {
    const saved = window.localStorage.getItem("templates:browse");
    // "table" is the pre-three-view name for the horizontal rail.
    if (saved === "table") setBrowse("horizontal");
    else if (saved === "grid" || saved === "horizontal" || saved === "vertical")
      setBrowse(saved);
  }, []);
  const setBrowseMode = (mode: BrowseMode) => {
    if (mode === browse) return;
    setBrowse(mode);
    window.localStorage.setItem("templates:browse", mode);
    capture("template_browse_mode_changed", { mode, from_mode: browse });
  };
  const navigate = useNavigate();
  const { pick: pickParam } = Route.useSearch();
  const create = useServerFn(createTripFromIngestion);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSkin, setModalSkin] = useState<SkinModule | null>(null);
  const [minting, setMinting] = useState(false);
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);
  const termsGateRef = useRef<MintTermsGateHandle>(null);

  useEffect(() => {
    if (!pendingSlug) return;
    navigate({ to: "/t/$slug", params: { slug: pendingSlug }, search: { mode: "edit" } });
    setMinting(false);
    setPendingSlug(null);
  }, [pendingSlug, navigate]);

  // No route preload here: the destination /t/$slug depends on the freshly
  // minted slug, and there's no template-side chunk to warm anymore.
  const prefetch = (_id: string) => {};

  const allTags = useMemo(
    () => Array.from(new Set(SKINS.flatMap((s) => s.meta.tags))).sort(),
    []
  );

  const filteredSkins = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SKINS.filter((skin) => {
      const matchesSearch =
        !q ||
        skin.meta.codename.toLowerCase().includes(q) ||
        skin.meta.personality.toLowerCase().includes(q) ||
        skin.meta.tags.some((t) => t.toLowerCase().includes(q));
      const matchesTag = !activeTag || skin.meta.tags.includes(activeTag);
      return matchesSearch && matchesTag;
    });
  }, [query, activeTag]);

  // Auto-jump when arriving with ?pick=<id> (e.g. from the homepage rail):
  // open the PREVIEW on every pointer type — the rail promises "preview ·
  // tap to open" and desktop used to break that promise by jumping straight
  // to the mint modal. One exception: a login round-trip with a stashed
  // composer draft goes straight to the modal so the draft restores.
  const autoPickedRef = useRef(false);
  useEffect(() => {
    if (autoPickedRef.current) return;
    if (!pickParam) return;
    if (!SKINS.some((s) => s.meta.id === pickParam)) return;
    autoPickedRef.current = true;
    if (peekPendingComposer()?.templateId === pickParam) {
      handlePick(pickParam);
    } else {
      setPeekId(pickParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickParam]);

  // Restore + persist scroll position across navigations
  useEffect(() => {
    const KEY = "templates:scrollY";
    const raw = sessionStorage.getItem(KEY);
    const target = raw ? parseInt(raw, 10) : NaN;
    let restoring = !Number.isNaN(target) && target > 0;
    let cancelled = false;

    if (restoring) {
      // Prevent browser's own restoration from fighting ours
      const prevBehavior =
        "scrollRestoration" in window.history
          ? window.history.scrollRestoration
          : "auto";
      if ("scrollRestoration" in window.history) {
        window.history.scrollRestoration = "manual";
      }

      // Poll until the document is tall enough to actually land at `target`,
      // then snap once. This waits out the skeleton→content swap and async
      // image/font layout without producing a visible scroll animation.
      const start = performance.now();
      const MAX_WAIT = 1500;
      const tryRestore = () => {
        if (cancelled) return;
        const maxY =
          document.documentElement.scrollHeight - window.innerHeight;
        if (maxY >= target || performance.now() - start > MAX_WAIT) {
          const y = Math.min(target, Math.max(0, maxY));
          // Instant jump — no smooth behavior, so the user doesn't see a
          // post-render scroll animation. The skeleton hid the transition.
          window.scrollTo({ top: y, left: 0, behavior: "auto" });
          // One more frame in case a late layout nudged things by a pixel
          requestAnimationFrame(() => {
            if (!cancelled) window.scrollTo({ top: y, behavior: "auto" });
            restoring = false;
            if ("scrollRestoration" in window.history) {
              window.history.scrollRestoration = prevBehavior;
            }
          });
        } else {
          requestAnimationFrame(tryRestore);
        }
      };
      requestAnimationFrame(tryRestore);
    }

    let ticking = false;
    const onScroll = () => {
      // Don't overwrite the saved value with intermediate positions while
      // we're still snapping back to the user's previous offset.
      if (restoring) return;
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        sessionStorage.setItem(KEY, String(window.scrollY));
        ticking = false;
      });
    };
    const persistNow = () =>
      sessionStorage.setItem(KEY, String(window.scrollY));
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", persistNow);
    window.addEventListener("beforeunload", persistNow);
    return () => {
      cancelled = true;
      persistNow();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", persistNow);
      window.removeEventListener("beforeunload", persistNow);
    };
  }, []);

  const handlePick = async (id: string) => {
    if (picking) return;
    const skin = SKINS.find((s) => s.meta.id === id);
    if (!skin) return;
    setModalSkin(skin);
    setModalOpen(true);
  };

  async function handleGenerate(
    blocks: Block[],
    firstStep: string,
    destination: string | null,
    // The modal's 4th argument: trip-brief's deterministically resolved
    // calendar. This signature used to omit it, so trips minted from
    // /templates silently lost their start/end dates.
    dates?: { startDate: string | null; endDate: string | null },
  ) {
    if (!modalSkin) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      toast.message("Sign in to compose your dossier", {
        description: "We'll bring you right back to mint this template.",
      });
      await navigate({
        to: "/login",
        search: { redirect: `/templates?pick=${modalSkin.meta.id}` },
      });
      return;
    }
    // Clickwrap: block the mint until the current Terms & Privacy are accepted.
    const ok = await termsGateRef.current?.ensureAccepted();
    if (!ok) return;
    setModalOpen(false);
    setPicking(modalSkin.meta.id);
    setMinting(true);
    try {
      const r = await create({
        data: {
          templateId: modalSkin.meta.id,
          blocks,
          ...(destination ? { destination } : {}),
          ...(dates?.startDate ? { startDate: dates.startDate } : {}),
          ...(dates?.endDate ? { endDate: dates.endDate } : {}),
        },
      });
      setPendingSlug(r.slug);
    } catch (e) {
      console.error(e);
      toast.error("Couldn't create your dossier", {
        description: e instanceof Error ? e.message : String(e),
      });
      setMinting(false);
      setPicking(null);
    }
  };

  return (
    <div className="relative min-h-dvh overflow-hidden bg-background text-foreground selection:bg-seal/40">
      <TopoBackground />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>\")",
        }}
      />

      <header className="relative z-10 mx-auto flex max-w-[1600px] items-center justify-between gap-3 border-b border-ink/10 px-4 py-4 sm:px-6 sm:py-6 md:px-12">
        <Link
          to="/"
          aria-label="Back to the TravelDoss home page"
          className="tap inline-flex min-h-11 items-center gap-3 text-[10px] font-medium uppercase tracking-[0.4em] text-ink/70 underline decoration-ink/30 decoration-dotted underline-offset-4 transition-colors hover:text-seal hover:decoration-seal"
        >
          TravelDoss<span className="text-ink/30">®</span>
        </Link>
        <span className="inline-flex items-center gap-3 text-right text-[9px] font-medium uppercase tracking-[0.35em] text-ink/60 sm:text-[10px] sm:tracking-[0.4em]">
          <span aria-hidden className="hidden h-px w-6 bg-ink/30 sm:block" />
          The Dossier Templates
        </span>
      </header>

      {/* md:pl-28 clears the fixed Ribbon rail (its right edge sits ~82px in). */}
      <main className="relative z-10 mx-auto max-w-[1600px] px-4 pb-16 sm:px-6 sm:pb-24 md:pl-28 md:pr-12">
        <button
          onClick={() => window.history.back()}
          className="tap mt-6 inline-flex min-h-11 items-center gap-2 text-[10px] font-medium uppercase tracking-[0.4em] text-ink/60 transition-colors hover:text-seal sm:mt-8"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>

        <h1 className="sr-only">Pick your dossier template.</h1>
        <SandHero
          className="mt-4 h-[44vw] max-h-[250px] min-h-[170px] w-full md:mt-14 md:h-[18vw] md:max-h-[360px] md:w-[min(96vw,780px)]"
          lines={[
            { text: "Pick your" },
            { text: "dossier template", italic: true, accent: "." },
          ]}
          accessibleText="Pick your dossier template."
          align="left"
        />
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink-soft sm:text-sm md:text-base">
          Select an elegant dossier template from the studio. Furnish it with automation, AI, or manually. Finally, <em className="italic">mint</em> it — it will go live for the duration of your trip.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[9px] font-medium uppercase tracking-[0.35em] text-ink/40 sm:text-[10px] sm:tracking-[0.4em]">
          <span>{SKINS.length} templates</span>
          <span aria-hidden className="h-px w-3 bg-ink/20 sm:w-4" />
          <span>New designs added often</span>
        </div>

        {/* Search + Filter */}
        <div className="mt-6 flex flex-col gap-4 sm:mt-10 sm:gap-6">
          {/* Search bar */}
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/30" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, mood, or style…"
              className="w-full rounded-none border border-ink/10 bg-surface py-3.5 pl-10 pr-11 text-base text-ink placeholder:text-ink/30 focus:border-seal/50 focus:outline-none sm:py-3 sm:text-sm"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="tap absolute right-1 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center text-ink/30 hover:text-ink"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Tag chips — single swipeable row on phones, wrapping on desktop */}
          <div className="scroll-x edge-fade-x -mx-1 items-center gap-2 px-1 pb-1 md:mx-0 md:flex md:flex-wrap md:overflow-visible md:px-0 md:pb-0 md:[mask-image:none] md:[-webkit-mask-image:none]">
            {allTags.map((tag) => {
              const active = activeTag === tag;
              return (
                <button
                  key={tag}
                  onClick={() => setActiveTag(active ? null : tag)}
                  className={`tap shrink-0 rounded-full border px-3.5 py-2 text-[10px] font-medium uppercase tracking-[0.25em] transition-colors duration-300 ${
                    active
                      ? "border-seal bg-seal/10 text-seal"
                      : "border-ink/10 text-ink/50 hover:border-ink/30 hover:text-ink"
                  }`}
                >
                  {tag}
                </button>
              );
            })}
            {(query || activeTag) && (
              <button
                onClick={() => {
                  setQuery("");
                  setActiveTag(null);
                }}
                className="tap ml-2 inline-flex min-h-11 shrink-0 items-center text-[10px] font-medium uppercase tracking-[0.25em] text-ink/40 underline-offset-4 transition-colors hover:text-seal"
              >
                Clear
              </button>
            )}
          </div>

          {/* Result count + browse-mode toggle (all sizes: the table has a
              phone-native sibling, the swipeable cover rail) */}
          <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between">
            <p className="min-w-0 text-[10px] uppercase tracking-[0.4em] text-ink/60">
              {filteredSkins.length} dossier template{filteredSkins.length !== 1 ? "s" : ""}
              {activeTag || query ? (
                <span className="text-seal">
                  {` · ${(activeTag ? 1 : 0) + (query.trim() ? 1 : 0)} filter${
                    (activeTag ? 1 : 0) + (query.trim() ? 1 : 0) !== 1 ? "s" : ""
                  } active`}
                </span>
              ) : null}
            </p>
          </div>
        </div>

        {/* Mobile: every mode is the same sideways swipe — only the cover's
            placeholder art changes, so the layout's benefit reads before you
            commit and the switcher is never a scroll away. */}
        {filteredSkins.length > 0 ? (
          <div className="mt-6 md:hidden">
            <MobileCoverRail
              key={browse}
              skins={filteredSkins}
              onPick={handlePick}
              pickingId={picking}
              variant={browse}
            />
          </div>
        ) : null}

        {browse === "horizontal" && filteredSkins.length > 0 ? (
          <div className="mt-8 hidden md:block">
            <AtelierTable
              skins={filteredSkins}
              onPick={handlePick}
              pickingId={picking}
            />
          </div>
        ) : null}

        {browse === "vertical" && filteredSkins.length > 0 ? (
          <div className="mt-8 hidden md:block">
            <VerticalCoverStack
              skins={filteredSkins}
              onPick={handlePick}
              pickingId={picking}
            />
          </div>
        ) : null}

        <div
          className={`mt-8 grid grid-cols-1 gap-6 sm:mt-10 sm:gap-8 md:grid-cols-2 lg:grid-cols-3 ${
            filteredSkins.length === 0
              ? ""
              : browse === "grid"
                ? "hidden md:grid"
                : "hidden"
          }`}
        >
          {filteredSkins.map((skin) => (
            <SkinCard
              key={skin.meta.id}
              skin={skin}
              onPick={handlePick}
              onOpen={setPeekId}
              onPrefetch={prefetch}
              picking={picking === skin.meta.id}
            />
          ))}
          {filteredSkins.length === 0 && (
            <div className="col-span-full py-20 text-center">
              <p className="text-sm text-ink-soft">
                No dossier templates match your search.
              </p>
              <button
                onClick={() => {
                  setQuery("");
                  setActiveTag(null);
                }}
                className="mt-4 text-[10px] font-medium uppercase tracking-[0.4em] text-seal underline-offset-4 hover:underline"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
        {/* View switcher — sits at the very bottom of the selection area so
            the covers stay the first thing you touch. */}
        {filteredSkins.length > 0 ? (
          <div
            className="mt-8 grid grid-cols-3 gap-1 rounded-full border border-ink/10 p-1 sm:mx-auto sm:w-[420px]"
            role="group"
            aria-label="Browse mode"
          >
            {(
              [
                ["grid", "Grid"],
                ["horizontal", "Horizontal"],
                ["vertical", "Vertical"],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setBrowseMode(mode)}
                aria-pressed={browse === mode}
                className={`tap inline-flex min-h-11 items-center justify-center rounded-full px-2 text-[10px] font-medium uppercase tracking-[0.2em] transition-colors duration-300 motion-reduce:transition-none ${
                  browse === mode ? "bg-seal/12 text-seal" : "text-ink/50 hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}
        {/* Clearance for the floating mobile nav pill. */}
        <div aria-hidden className="h-28 md:hidden" />
      </main>

      <Ribbon />
      <MobileNavBar />
      {peekId ? (
        <SkinPeek
          skins={filteredSkins.length > 0 ? filteredSkins : SKINS}
          startId={peekId}
          onClose={() => setPeekId(null)}
          onMint={(id) => {
            setPeekId(null);
            handlePick(id);
          }}
          mintingId={picking}
        />
      ) : null}

      <IngestionModal
        open={modalOpen}
        onOpenChange={(v) => {
          setModalOpen(v);
          if (!v) setModalSkin(null);
        }}
        template={modalSkin}
        onGenerate={handleGenerate}
        onTemplateChange={setModalSkin}
      />

      <GenerationLoader open={minting} label="Composing your dossier" />
      <MintTermsGate ref={termsGateRef} />
    </div>
  );
}