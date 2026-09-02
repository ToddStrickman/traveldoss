/**
 * /templates/$id — the Design Annual spread. One full editorial page per
 * dossier template: live preview large, codename in the skin's own display
 * face, personality line, tags, mint CTA, and prev/next leafing through
 * the annual. Also the crawlable per-template URL the gallery links to.
 */
import { useEffect, useRef, useState } from "react";
import {
  createFileRoute,
  Link,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { SKINS, getSkin } from "@/lib/skins/registry";
import type { SkinView } from "@/lib/skins/types";
import { ViewSwitch } from "@/components/ViewSwitch";
import { SkinCoverTile } from "@/components/flow/AtelierTable";
import { IngestionModal } from "@/components/flow/IngestionModal";
import { GenerationLoader } from "@/components/GenerationLoader";
import { createTripFromIngestion } from "@/lib/trips.functions";
import type { Block } from "@/lib/skins/types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SITE_URL } from "@/lib/site";
import { MintTermsGate, type MintTermsGateHandle } from "@/components/legal/MintTermsGate";

/** Day blocks only — the funnel's "how big was this dossier" measure. */
function dayCount(blocks: Block[]): number {
  return blocks.filter((b) => (b as { kind?: string }).kind === "day").length;
}

export const Route = createFileRoute("/templates_/$id")({
  component: TemplateSpread,
  beforeLoad: ({ params }) => {
    if (!getSkin(params.id)) throw redirect({ to: "/templates" });
  },
  head: ({ params }) => {
    const skin = getSkin(params.id);
    const name = skin?.meta.codename ?? "Template";
    const personality = skin?.meta.personality ?? "";
    const title = `${name} — Travel Dossier Template | TravelDoss`;
    const description = `${name}: "${personality}". An editorial travel dossier template — map your trip day by day, then mint it live for the length of your journey.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: `${SITE_URL}/templates/${params.id}` },
      ],
      links: [{ rel: "canonical", href: `${SITE_URL}/templates/${params.id}` }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CreativeWork",
            name: `${name} travel dossier template`,
            description,
            url: `${SITE_URL}/templates/${params.id}`,
            isPartOf: { "@type": "CollectionPage", url: `${SITE_URL}/templates` },
          }),
        },
      ],
    };
  },
});

function TemplateSpread() {
  const { id } = Route.useParams();
  const skin = getSkin(id) ?? SKINS[0];
  const navigate = useNavigate();
  const create = useServerFn(createTripFromIngestion);

  const idx = SKINS.findIndex((s) => s.meta.id === skin.meta.id);
  const prev = idx > 0 ? SKINS[idx - 1] : null;
  const next = idx < SKINS.length - 1 ? SKINS[idx + 1] : null;

  const [modalOpen, setModalOpen] = useState(false);
  const [minting, setMinting] = useState(false);
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);
  const [view, setView] = useState<SkinView>("vertical");
  const termsGateRef = useRef<MintTermsGateHandle>(null);

  useEffect(() => {
    if (!pendingSlug) return;
    navigate({ to: "/t/$slug", params: { slug: pendingSlug }, search: { mode: "edit" } });
    setMinting(false);
    setPendingSlug(null);
  }, [pendingSlug, navigate]);

  // Leaf through the annual with the keyboard, like turning pages.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (modalOpen) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowRight" && next) {
        navigate({ to: "/templates/$id", params: { id: next.meta.id } });
      }
      if (e.key === "ArrowLeft" && prev) {
        navigate({ to: "/templates/$id", params: { id: prev.meta.id } });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, prev, next, modalOpen]);

  // Touch parity for the arrow keys: a horizontal swipe leafs prev/next.
  // The gesture must be decisively horizontal (2:1 over vertical) so
  // ordinary page scrolling never triggers a navigation.
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || modalOpen) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 2) return;
    const target = dx < 0 ? next : prev;
    if (target) {
      navigate({ to: "/templates/$id", params: { id: target.meta.id } });
    }
  };

  async function handleGenerate(
    blocks: Block[],
    _firstStep: string,
    destination: string | null,
    dates?: { startDate: string | null; endDate: string | null },
  ) {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      toast.message("Sign in to compose your dossier", {
        description: "We'll bring you right back to mint this template.",
      });
      await navigate({
        to: "/login",
        search: { redirect: `/templates?pick=${skin.meta.id}` },
      });
      return;
    }
    // Clickwrap: block the mint until the current Terms & Privacy are accepted.
    const ok = await termsGateRef.current?.ensureAccepted();
    if (!ok) return;
    setModalOpen(false);
    setMinting(true);
    try {
      const r = await create({
        data: {
          templateId: skin.meta.id,
          blocks,
          ...(destination ? { destination } : {}),
          ...(dates?.startDate ? { startDate: dates.startDate } : {}),
          ...(dates?.endDate ? { endDate: dates.endDate } : {}),
        },
      });
      trackMintCompleted(skin.meta.id, r.tripId, blocks.length, dayCount(blocks));
      setPendingSlug(r.slug);
    } catch (e) {
      console.error(e);
      trackMintFailed(skin.meta.id, e instanceof Error ? e.message : String(e));
      toast.error("Couldn't create your dossier", {
        description: e instanceof Error ? e.message : String(e),
      });
      setMinting(false);
    }
  }

  return (
    <div
      className="relative min-h-dvh bg-background text-foreground selection:bg-seal/40"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <header className="relative z-10 mx-auto flex max-w-[1600px] items-center justify-between gap-3 border-b border-ink/10 px-4 py-4 sm:px-6 sm:py-6 md:px-12">
        <Link
          to="/templates"
          className="tap inline-flex min-h-11 items-center gap-2 text-[10px] font-medium uppercase tracking-[0.4em] text-ink/70 transition-colors hover:text-seal"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          The dossier templates
        </Link>
        <span className="text-[10px] font-medium uppercase tracking-[0.35em] text-ink/50">
          Spread {String(idx + 1).padStart(2, "0")} / {String(SKINS.length).padStart(2, "0")}
        </span>
      </header>

      <main className="relative z-10 mx-auto grid max-w-[1600px] gap-10 px-4 py-10 sm:px-6 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:items-center md:gap-14 md:px-12 md:py-16">
        <section>
          <p className="text-[10px] font-medium uppercase tracking-[0.45em] text-ink/50">
            Dossier template
          </p>
          <h1
            className="mt-4 text-6xl font-normal leading-[0.95] tracking-tight text-ink md:text-7xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {skin.meta.codename}
            <span className="text-seal">.</span>
          </h1>
          <p
            className="mt-5 max-w-md text-xl italic leading-relaxed text-ink-soft"
            style={{ fontFamily: "var(--font-display)" }}
          >
            "{skin.meta.personality}"
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            {skin.meta.tags.map((tag) => (
              <span
                key={tag}
                className="inline-block rounded-full border border-ink/10 px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.2em] text-ink/60"
              >
                {tag}
              </span>
            ))}
          </div>

          <p className="mt-8 max-w-md text-[15px] leading-relaxed text-ink-soft">
            Furnish it with automation, AI, or by hand — every place pinned,
            categorized, and routed day by day. Mint it and it goes live for
            the duration of your trip.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="tap group inline-flex min-h-12 items-center gap-4 border border-seal/50 bg-seal/10 px-5 text-[11px] font-medium uppercase tracking-[0.35em] text-seal transition-colors hover:bg-seal hover:text-paper"
            >
              Mint this dossier
              <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-0.5">→</span>
            </button>
          </div>
        </section>

        <section aria-label={`${skin.meta.codename} live preview`}>
          {/* The three-layout pivot — the product's signature move — so the
              preview shows how this template composes a trip in every view. */}
          <ViewSwitch
            value={view}
            onChange={setView}
            tokens={skin.tokens}
            className="mb-3 inline-flex gap-1 rounded-full p-1"
          />
          <div className="border border-ink/20 shadow-[0_40px_80px_-40px_rgba(0,0,0,0.8)]">
            <SkinCoverTile skin={skin} height={560} view={view} />
          </div>
        </section>
      </main>

      {/* Leafing: previous / next spreads as real links. */}
      <nav
        aria-label="Leaf through the templates"
        className="relative z-10 mx-auto flex max-w-[1600px] items-center justify-between border-t border-ink/10 px-4 py-6 sm:px-6 md:px-12"
      >
        {prev ? (
          <Link
            to="/templates/$id"
            params={{ id: prev.meta.id }}
            className="tap inline-flex min-h-11 items-center gap-3 text-[10px] font-medium uppercase tracking-[0.3em] text-ink/60 transition-colors hover:text-seal"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {prev.meta.codename}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            to="/templates/$id"
            params={{ id: next.meta.id }}
            className="tap inline-flex min-h-11 items-center gap-3 text-[10px] font-medium uppercase tracking-[0.3em] text-ink/60 transition-colors hover:text-seal"
          >
            {next.meta.codename}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        ) : (
          <span />
        )}
      </nav>

      <IngestionModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        template={skin}
        onGenerate={handleGenerate}
      />
      <GenerationLoader open={minting} label="Composing your dossier" />
      <MintTermsGate ref={termsGateRef} />
    </div>
  );
}
