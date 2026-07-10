import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { ArrowLeft, Search, X } from "lucide-react";
import { SKINS, type SkinModule } from "@/lib/skins/registry";
import { TiltCard } from "@/components/motion/Tilt";
import { InertRender } from "@/lib/skins/shared/views/parts";
import { SkinPeek } from "@/components/mobile/SkinPeek";
import { usePointerCoarse } from "@/components/mobile/PlaceSheet";
import { IngestionModal } from "@/components/flow/IngestionModal";
import { GenerationLoader } from "@/components/GenerationLoader";
import { createTripFromIngestion } from "@/lib/trips.functions";
import type { Block } from "@/lib/skins/types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SITE_URL } from "@/lib/site";

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
        content:
          "Pick from 10 beautiful travel itinerary templates. Each dossier design maps your trip day by day — one URL, one dollar, one month.",
      },
      {
        property: "og:title",
        content: "Travel Itinerary Templates — Editorial Dossier Designs | TravelDoss",
      },
      {
        property: "og:description",
        content:
          "Ten editorial dossier templates for your trip. One dollar, one URL, one month — composed like a magazine.",
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
        <div className="flex items-center gap-2 text-[9px] font-medium uppercase tracking-[0.45em] text-ink/40">
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
          {skin.meta.codename}
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
              className="inline-block rounded-full border border-ink/10 px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.2em] text-ink/50"
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

function TemplatesPage() {
  const [picking, setPicking] = useState<string | null>(null);
  const [peekId, setPeekId] = useState<string | null>(null);
  const mobileRead = usePointerCoarse();
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const navigate = useNavigate();
  const { pick: pickParam } = Route.useSearch();
  const create = useServerFn(createTripFromIngestion);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSkin, setModalSkin] = useState<SkinModule | null>(null);
  const [genSteps, setGenSteps] = useState<string[] | null>(null);
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingSlug) return;
    navigate({ to: "/t/$slug", params: { slug: pendingSlug }, search: { mode: "edit" } });
    setGenSteps(null);
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

  // Auto-jump to preview when arriving with ?pick=<id> (e.g. from the homepage rail).
  const autoPickedRef = useRef(false);
  useEffect(() => {
    if (autoPickedRef.current) return;
    if (!pickParam) return;
    if (!SKINS.some((s) => s.meta.id === pickParam)) return;
    autoPickedRef.current = true;
    if (mobileRead) {
      setPeekId(pickParam);
    } else {
      handlePick(pickParam);
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
    setModalOpen(false);
    setPicking(modalSkin.meta.id);
    setGenSteps([firstStep, "Crafting your dossier…", "Designing the pages…"]);
    try {
      const r = await create({
        data: {
          templateId: modalSkin.meta.id,
          blocks,
          ...(destination ? { destination } : {}),
        },
      });
      setPendingSlug(r.slug);
    } catch (e) {
      console.error(e);
      toast.error("Couldn't create your dossier", {
        description: e instanceof Error ? e.message : String(e),
      });
      setGenSteps(null);
      setPicking(null);
    }
  };

  return (
    <div className="relative min-h-dvh overflow-hidden bg-background text-foreground selection:bg-seal/40">
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
          TravelDoss<span className="text-ink/30">®</span>
        </Link>
        <span className="inline-flex items-center gap-3 text-[10px] font-medium uppercase tracking-[0.4em] text-ink/60">
          <span className="h-px w-6 bg-ink/30" />
          The Dossier Templates
        </span>
      </header>

      <main className="relative z-10 mx-auto max-w-[1600px] px-5 pb-16 sm:px-6 sm:pb-24 md:px-12">
        <button
          onClick={() => window.history.back()}
          className="mt-8 inline-flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.4em] text-ink/60 transition-colors hover:text-seal"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mt-16 text-[14vw] font-normal leading-[0.95] tracking-[-0.03em] md:text-[7vw]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          <span className="text-ink">Pick your </span>
          <span className="italic text-ink/85">dossier template<span className="text-seal">.</span></span>
        </motion.h1>
        <p className="mt-6 max-w-xl text-sm leading-relaxed text-ink-soft md:text-base">
          Select an elegant dossier template from the studio. Furnish it with automation, AI, or manually. Finally, <em className="italic">mint</em> it it will go live for the duration of your trip.
        </p>
        <p className="mt-3 max-w-xl text-[10px] uppercase tracking-[0.4em] text-ink/40">
          We are always crafting new Dossiers and evolving the product
        </p>

        {/* Search + Filter */}
        <div className="mt-10 flex flex-col gap-6">
          {/* Search bar */}
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/30" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, mood, or style…"
              className="w-full rounded-none border border-ink/10 bg-surface py-3 pl-10 pr-10 text-sm text-ink placeholder:text-ink/30 focus:border-seal/50 focus:outline-none"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/30 hover:text-ink"
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
                className="ml-2 shrink-0 text-[10px] font-medium uppercase tracking-[0.25em] text-ink/40 underline-offset-4 transition-colors hover:text-seal"
              >
                Clear
              </button>
            )}
          </div>

          {/* Result count */}
          <p className="text-[10px] uppercase tracking-[0.4em] text-ink/60">
            {filteredSkins.length} dossier template{filteredSkins.length !== 1 ? "s" : ""}
            {activeTag ? ` · ${activeTag}` : ""}
            {query ? ` · “${query.trim()}”` : ""}
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {filteredSkins.map((skin) => (
            <SkinCard
              key={skin.meta.id}
              skin={skin}
              onPick={handlePick}
              onOpen={mobileRead ? setPeekId : undefined}
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
      </main>
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
        }}
      />
    </div>
  );
}