import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getDossierBySlug } from "@/lib/templates.functions";
import { updateDossier } from "@/lib/trips.functions";
import { FALLBACK_SKIN, getSkin } from "@/lib/skins/registry";
import type { Block, SkinView, TripView } from "@/lib/skins/types";
import { supabase } from "@/integrations/supabase/client";
import { StudioBar } from "@/components/studio/StudioBar";
import { ExportMenu } from "@/components/studio/ExportMenu";
import { CompanionToday } from "@/components/studio/CompanionToday";
import { getTemporalPhase, phaseCopy } from "@/lib/itinerary/temporal";
import { EditingProvider, arrayMove } from "@/lib/skins/shared/Editable";

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
  useNavigate();
  const [layout, setLayout] = useState<SkinView>("vertical");
  const initial = (trip.content ?? {}) as { blocks?: Block[]; skin?: string };
  const [blocks, setBlocks] = useState<Block[]>(initial.blocks ?? []);
  const [templateId, setTemplateId] = useState<string>(trip.template_id ?? FALLBACK_SKIN.meta.id);
  const [destination, setDestination] = useState<string>(trip.destination);
  const [subtitle, setSubtitle] = useState<string>(trip.subtitle ?? "");
  const [isOwner, setIsOwner] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const save = useServerFn(updateDossier);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const tripOwner = (trip as { user_id?: string }).user_id;
      if (data.user && tripOwner && tripOwner === data.user.id) setIsOwner(true);
      else setIsOwner(false);
    });
  }, [trip]);

  const phase = getTemporalPhase(trip.start_date, trip.end_date);
  const canEdit = isOwner && phase !== "archive" && !expired;

  const queueSave = useCallback((patch: {
    blocks?: Block[];
    templateId?: string;
    destination?: string;
    subtitle?: string;
  }) => {
    if (!canEdit) return;
    if (debounce.current) clearTimeout(debounce.current);
    setSaving(true);
    debounce.current = setTimeout(async () => {
      try {
        const r = await save({ data: { slug: trip.slug, ...patch } });
        if (r.savedAt) setSavedAt(r.savedAt);
      } catch (e) {
        console.error("[autosave]", e);
      } finally {
        setSaving(false);
      }
    }, 800);
  }, [canEdit, save, trip.slug]);

  function onTemplateChange(id: string) {
    setTemplateId(id);
    queueSave({ blocks, templateId: id });
  }

  const editingCtx = useMemo(
    () => ({
      editing: canEdit,
      onBlockChange: (index: number, patch: Partial<Block>) => {
        setBlocks((curr) => {
          const next = curr.slice();
          next[index] = { ...(next[index] as object), ...(patch as object) } as Block;
          queueSave({ blocks: next, templateId });
          return next;
        });
      },
      onBlockRemove: (index: number) => {
        setBlocks((curr) => {
          const next = curr.filter((_, i) => i !== index);
          queueSave({ blocks: next, templateId });
          return next;
        });
      },
      onBlockAdd: (afterIndex: number, kind: Block["kind"]) => {
        const fresh: Block =
          kind === "day"
            ? { kind: "day", n: 1, label: "New day" }
            : kind === "place"
            ? { kind: "place", name: "New place", category: "other" }
            : kind === "section"
            ? { kind: "section", title: "New section" }
            : kind === "note"
            ? { kind: "note", text: "" }
            : { kind: "paragraph", text: "" };
        setBlocks((curr) => {
          const next = curr.slice();
          next.splice(Math.max(0, afterIndex + 1), 0, fresh);
          queueSave({ blocks: next, templateId });
          return next;
        });
      },
      onReorder: (from: number, to: number) => {
        setBlocks((curr) => {
          const next = arrayMove(curr, from, to);
          queueSave({ blocks: next, templateId });
          return next;
        });
      },
      onTripChange: (field: "destination" | "subtitle", value: string) => {
        if (field === "destination") {
          setDestination(value);
          queueSave({ destination: value });
        } else {
          setSubtitle(value);
          queueSave({ subtitle: value });
        }
      },
    }),
    [canEdit, queueSave, templateId],
  );

  if (expired) return <ExpiredDossier slug={trip.slug} destination={trip.destination} />;

  const skin = getSkin(templateId) ?? FALLBACK_SKIN;

  const view: TripView = {
    destination,
    subtitle,
    slug: trip.slug,
    start_date: trip.start_date,
    end_date: trip.end_date,
    hero_image_url: trip.hero_image_url,
  };

  return (
    <EditingProvider value={editingCtx}>
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
        data-print="hide"
        className="fixed left-4 top-4 z-50 inline-flex items-center gap-2 rounded-full border border-white/15 bg-paper/85 px-3.5 py-2 text-[10px] font-medium uppercase tracking-[0.35em] text-ink backdrop-blur-md transition-colors hover:border-seal hover:text-seal"
        aria-label="Back to TravelDoss"
      >
        ← TravelDoss
      </Link>
      <ViewSwitch value={layout} onChange={setLayout} tokens={skin.tokens} />
      {canEdit && (
        <StudioBar
          templateId={templateId}
          saving={saving}
          savedAt={savedAt}
          onTemplateChange={onTemplateChange}
        />
      )}
      <ExportMenu slug={trip.slug} canPushToDocs={isOwner} />
    </EditingProvider>
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
      data-print="hide"
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