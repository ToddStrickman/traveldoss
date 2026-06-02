import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getDossierBySlug } from "@/lib/templates.functions";
import { updateDossier } from "@/lib/trips.functions";
import { FALLBACK_SKIN, getSkin } from "@/lib/skins/registry";
import type { Block, SkinView, TripView } from "@/lib/skins/types";
import { supabase } from "@/integrations/supabase/client";
import { StudioDrawer } from "@/components/studio/StudioDrawer";
import { ExportMenu } from "@/components/studio/ExportMenu";
import { CompanionToday } from "@/components/studio/CompanionToday";
import { getTemporalPhase, phaseCopy } from "@/lib/itinerary/temporal";

type DossierContent = {
  blocks?: Block[];
  skin?: string;
};

export const Route = createFileRoute("/t/$slug")({
  validateSearch: z.object({ mode: z.enum(["edit", "view"]).optional() }),
  loader: async ({ params }) => {
    const { trip, expired } = await getDossierBySlug({ data: { slug: params.slug } });
    if (!trip) throw notFound();
    return { trip, expired: !!expired };
  },
  head: ({ loaderData }) => {
    const trip = loaderData?.trip;
    if (!trip) return { meta: [{ title: "Dossier — TravelDoss" }] };
    const title = `${trip.destination} — A TravelDoss Dossier`;
    const description =
      trip.subtitle ?? `A travel dossier for ${trip.destination}.`;
    const url = `https://traveldoss.lovable.app/t/${trip.slug}`;
    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "article" },
      { property: "og:url", content: url },
      { name: "twitter:card", content: "summary_large_image" },
    ];
    if (trip.hero_image_url) {
      meta.push({ property: "og:image", content: trip.hero_image_url });
      meta.push({ name: "twitter:image", content: trip.hero_image_url });
    }
    const ldImage = trip.hero_image_url ? { image: trip.hero_image_url } : {};
    return {
      meta,
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: trip.destination,
            description,
            url,
            ...ldImage,
          }),
        },
      ],
    };
  },
  component: DossierPage,
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
      <div>
        <p className="text-[10px] uppercase tracking-[0.4em] text-ink/45">404</p>
        <h1
          className="mt-4 text-5xl text-ink"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Dossier not found
        </h1>
        <p className="mt-3 text-sm text-ink-soft">
          This trip URL doesn't exist, or it has been made private.
        </p>
        <Link
          to="/"
          className="mt-8 inline-block border-y border-ink/20 py-3 text-[10px] uppercase tracking-[0.4em] text-ink hover:border-seal hover:text-seal"
        >
          ← TravelDoss
        </Link>
      </div>
    </div>
  ),
  errorComponent: () => (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
      <div>
        <h1 className="text-2xl text-ink">Couldn't load this dossier</h1>
        <p className="mt-2 text-sm text-ink-soft">Please try again later.</p>
      </div>
    </div>
  ),
});

function DossierPage() {
  const { trip, expired } = Route.useLoaderData();
  const { mode } = Route.useSearch();
  const [layout, setLayout] = useState<SkinView>("vertical");
  const initial = (trip.content ?? {}) as { blocks?: Block[]; skin?: string };
  const [blocks, setBlocks] = useState<Block[]>(initial.blocks ?? []);
  const [templateId, setTemplateId] = useState<string>(trip.template_id ?? FALLBACK_SKIN.meta.id);
  const [isOwner, setIsOwner] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(mode === "edit");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const save = useServerFn(updateDossier);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user && trip && (trip as { user_id?: string }).user_id === data.user.id) setIsOwner(true);
      else if (data.user) setIsOwner(true); // RLS will reject if not actually owner
    });
  }, [trip]);

  const phase = getTemporalPhase(trip.start_date, trip.end_date);
  const canEdit = isOwner && phase !== "archive" && !expired;

  function queueSave(nextBlocks: Block[], nextTemplate: string) {
    if (!canEdit) return;
    if (debounce.current) clearTimeout(debounce.current);
    setSaving(true);
    debounce.current = setTimeout(async () => {
      try {
        const r = await save({ data: { slug: trip.slug, blocks: nextBlocks, templateId: nextTemplate } });
        if (r.savedAt) setSavedAt(r.savedAt);
      } catch (e) {
        console.error("[autosave]", e);
      } finally {
        setSaving(false);
      }
    }, 1000);
  }

  function onBlocksChange(next: Block[]) {
    setBlocks(next);
    queueSave(next, templateId);
  }
  function onTemplateChange(id: string) {
    setTemplateId(id);
    queueSave(blocks, id);
  }

  if (expired) return <ExpiredDossier slug={trip.slug} destination={trip.destination} />;

  const skin = getSkin(templateId) ?? FALLBACK_SKIN;

  const view: TripView = {
    destination: trip.destination,
    subtitle: trip.subtitle,
    slug: trip.slug,
    start_date: trip.start_date,
    end_date: trip.end_date,
    hero_image_url: trip.hero_image_url,
  };

  return (
    <>
      {skin.tokens.fontUrl && <link rel="stylesheet" href={skin.tokens.fontUrl} />}
      {phase === "active" && <CompanionToday blocks={blocks} />}
      {phase === "archive" && (
        <div className="sticky top-0 z-30 border-b border-ink/15 bg-paper/85 px-6 py-3 text-center text-[10px] uppercase tracking-[0.4em] text-ink-soft backdrop-blur-md">
          {phaseCopy("archive").label} · {phaseCopy("archive").tagline}
        </div>
      )}
      <skin.Render trip={view} blocks={blocks} view={layout} />
      <Link
        to="/"
        className="fixed left-4 top-4 z-50 inline-flex items-center gap-2 border border-black/15 bg-white/85 px-3 py-2 text-[10px] font-medium uppercase tracking-[0.3em] text-black backdrop-blur-sm transition-colors hover:border-black hover:bg-white"
        aria-label="Back to TravelDoss"
      >
        ← TravelDoss
      </Link>
      <ViewSwitch value={layout} onChange={setLayout} tokens={skin.tokens} />
      {canEdit && !drawerOpen && (
        <button
          onClick={() => setDrawerOpen(true)}
          className="fixed left-4 bottom-4 z-40 rounded-full border border-seal/40 bg-paper/90 px-4 py-2 text-[10px] uppercase tracking-[0.3em] text-seal backdrop-blur-md hover:bg-seal hover:text-paper"
        >
          Edit
        </button>
      )}
      {canEdit && drawerOpen && (
        <StudioDrawer
          blocks={blocks}
          templateId={templateId}
          savedAt={savedAt}
          saving={saving}
          onBlocksChange={onBlocksChange}
          onTemplateChange={onTemplateChange}
          onClose={() => setDrawerOpen(false)}
        />
      )}
      <ExportMenu slug={trip.slug} />
    </>
  );
}

/** Live Vertical · Horizontal · Grid control. Styled from the active skin's
 *  tokens; fixed, centered at the top. Switching never mutates content. */
function ViewSwitch({
  value,
  onChange,
  tokens,
}: {
  value: SkinView;
  onChange: (v: SkinView) => void;
  tokens: { bg: string; ink: string; accent: string; rule: string };
}) {
  const opts: SkinView[] = ["vertical", "horizontal", "grid"];
  return (
    <div
      role="radiogroup"
      aria-label="Layout"
      className="fixed left-1/2 top-4 z-50 flex -translate-x-1/2 gap-1 rounded-full p-1 backdrop-blur-sm"
      style={{ background: `${tokens.bg}d9`, border: `1px solid ${tokens.rule}` }}
    >
      {opts.map((o) => {
        const on = o === value;
        return (
          <button
            key={o}
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o)}
            className="rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] transition-colors"
            style={{ color: on ? tokens.bg : tokens.ink, background: on ? tokens.accent : "transparent" }}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

function ExpiredDossier({ slug, destination }: { slug: string; destination: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
      <div className="max-w-md">
        <p className="text-[10px] uppercase tracking-[0.4em] text-ink/45">Expired</p>
        <h1
          className="mt-4 text-4xl text-ink md:text-5xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {destination} has come and gone<span className="text-seal">.</span>
        </h1>
        <p className="mt-4 text-sm text-ink-soft">
          This dossier's month is up. The owner can re-publish it for another $1.
        </p>
        <p className="mt-6 text-[10px] uppercase tracking-[0.4em] text-ink/35">
          /t/{slug}
        </p>
        <Link
          to="/"
          className="mt-10 inline-block border-y border-ink/20 py-3 text-[10px] uppercase tracking-[0.4em] text-ink hover:border-seal hover:text-seal"
        >
          ← TravelDoss
        </Link>
      </div>
    </div>
  );
}