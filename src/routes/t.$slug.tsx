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
import { PrintScheduleGrid } from "@/components/studio/PrintScheduleGrid";
import { CompanionToday } from "@/components/studio/CompanionToday";
import { getTemporalPhase, phaseCopy } from "@/lib/itinerary/temporal";
import { EditingProvider, arrayMove } from "@/lib/skins/shared/Editable";
import { moveActivity } from "@/lib/skins/shared/itinerary";
import { IngestionModal } from "@/components/flow/IngestionModal";
import { GmailImportPanel } from "@/components/flow/GmailImportPanel";
import { TripDocPreviews } from "@/components/flow/TripDocPreviews";
import { DebugReportsPanel } from "@/components/studio/DebugReportsPanel";
import { toast } from "sonner";
import { useHistory, useUndoRedoShortcuts } from "@/hooks/use-history";
import { useItineraryRefiner } from "@/hooks/use-itinerary-refiner";

type RefineHistoryEntry = {
  id: string;
  at: number;
  reason: string;
  blocks: Block[];
};

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
    <div className="flex min-h-dvh items-center justify-center bg-background px-6 text-center">
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
    <div className="flex min-h-dvh items-center justify-center bg-background px-6 text-center">
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
  const initial = (trip.content ?? {}) as {
    blocks?: Block[];
    skin?: string;
    meta?: import("@/lib/skins/types").TripMeta;
  };
  type Snapshot = {
    blocks: Block[];
    templateId: string;
    destination: string;
    subtitle: string;
    startDate: string;
    endDate: string;
    meta: import("@/lib/skins/types").TripMeta;
  };
  const history = useHistory<Snapshot>({
    blocks: initial.blocks ?? [],
    templateId: trip.template_id ?? FALLBACK_SKIN.meta.id,
    destination: trip.destination,
    subtitle: trip.subtitle ?? "",
    startDate: trip.start_date ?? "",
    endDate: trip.end_date ?? "",
    meta: initial.meta ?? {},
  });
  const { state: snap, set: setSnap, undo, redo, canUndo, canRedo } = history;
  const { blocks, templateId, destination, subtitle, startDate, endDate, meta } = snap;
  const [isOwner, setIsOwner] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [mintOpen, setMintOpen] = useState(false);
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
    startDate?: string;
    endDate?: string;
    meta?: import("@/lib/skins/types").TripMeta;
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

  const onTemplateChange = useCallback(
    (id: string) => {
      setSnap((s) => ({ ...s, templateId: id }));
      queueSave({ blocks, templateId: id });
    },
    [setSnap, queueSave, blocks],
  );

  const handleMint = useCallback(
    (
      nextBlocks: Block[],
      _sourceLabel: string,
      nextDestination: string | null,
    ) => {
      const patch: Parameters<typeof queueSave>[0] = {
        blocks: nextBlocks,
        templateId,
      };
      setSnap((s) => {
        const next: Snapshot = { ...s, blocks: nextBlocks };
        if (nextDestination && nextDestination !== s.destination) {
          next.destination = nextDestination;
          patch.destination = nextDestination;
        }
        return next;
      });
      queueSave(patch);
      setMintOpen(false);
      toast.success("Trip minted — your dossier is live.");
    },
    [setSnap, queueSave, templateId],
  );

  // After undo/redo, push the resulting snapshot to the server.
  const lastSyncedRef = useRef(snap);
  useEffect(() => {
    if (lastSyncedRef.current === snap) return;
    lastSyncedRef.current = snap;
    if (!canEdit) return;
    queueSave({
      blocks: snap.blocks,
      templateId: snap.templateId,
      destination: snap.destination,
      subtitle: snap.subtitle,
      startDate: snap.startDate,
      endDate: snap.endDate,
      meta: snap.meta,
    });
  }, [snap, canEdit, queueSave]);

  useUndoRedoShortcuts(canEdit, undo, redo);

  const [refineHistory, setRefineHistory] = useState<RefineHistoryEntry[]>([]);

  const refiner = useItineraryRefiner(
    {
      blocks,
      destination,
      startDate,
      endDate,
      meta,
    },
    {
      enabled: canEdit && blocks.length > 0,
      onRefined: (nextBlocks, reason) => {
        // Silent merge: replace blocks with the refined set. The history
        // entry coalesces under a single key so the user can undo a
        // sharpening pass with one Cmd-Z.
        setSnap(
          (s) => ({ ...s, blocks: nextBlocks }),
          { coalesceKey: `refine:${reason}` },
        );
        queueSave({ blocks: nextBlocks });
        setRefineHistory((prev) => {
          const entry: RefineHistoryEntry = {
            id:
              typeof crypto !== "undefined" && "randomUUID" in crypto
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            at: Date.now(),
            reason: reason || "Sharpened",
            blocks: nextBlocks,
          };
          // Cap to last 20 refinements to keep memory bounded.
          const next = [entry, ...prev];
          return next.slice(0, 20);
        });
      },
    },
  );

  const restoreRefine = useCallback(
    (id: string) => {
      const entry = refineHistory.find((e) => e.id === id);
      if (!entry) return;
      setSnap((s) => ({ ...s, blocks: entry.blocks }));
      queueSave({ blocks: entry.blocks });
      toast.success("Restored a previous refined version.");
    },
    [refineHistory, setSnap, queueSave],
  );

  const editingCtx = useMemo(
    () => ({
      editing: canEdit,
      onBlockChange: (index: number, patch: Partial<Block>) => {
        const field = Object.keys(patch)[0] ?? "_";
        setSnap(
          (s) => {
            const next = s.blocks.slice();
            next[index] = {
              ...(next[index] as object),
              ...(patch as object),
            } as Block;
            return { ...s, blocks: next };
          },
          { coalesceKey: `block:${index}:${field}` },
        );
      },
      onBlockRemove: (index: number) => {
        setSnap((s) => ({
          ...s,
          blocks: s.blocks.filter((_, i) => i !== index),
        }));
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
        setSnap((s) => {
          const next = s.blocks.slice();
          next.splice(Math.max(0, afterIndex + 1), 0, fresh);
          return { ...s, blocks: next };
        });
      },
      onReorder: (from: number, to: number) => {
        setSnap((s) => ({ ...s, blocks: arrayMove(s.blocks, from, to) }));
      },
      onMoveActivity: (
        srcIndex: number,
        dayIndex: number,
        part: "morning" | "afternoon" | "evening",
        beforeIndex?: number,
      ) => {
        setSnap((s) => ({
          ...s,
          blocks: moveActivity(s.blocks, srcIndex, dayIndex, part, beforeIndex),
        }));
      },
      onTripChange: (field: "destination" | "subtitle", value: string) => {
        setSnap(
          (s) => ({ ...s, [field]: value }),
          { coalesceKey: `trip:${field}` },
        );
      },
      onTripDatesChange: (start: string, end: string) => {
        setSnap(
          (s) => ({ ...s, startDate: start, endDate: end }),
          { coalesceKey: "trip:dates" },
        );
      },
      onMetaChange: (patch: Partial<import("@/lib/skins/types").TripMeta>) => {
        setSnap(
          (s) => ({ ...s, meta: { ...s.meta, ...patch } }),
          { coalesceKey: `trip:meta:${Object.keys(patch)[0] ?? "_"}` },
        );
      },
    }),
    [canEdit, setSnap],
  );

  if (expired) return <ExpiredDossier slug={trip.slug} destination={trip.destination} />;

  const skin = getSkin(templateId) ?? FALLBACK_SKIN;

  const view: TripView = {
    destination,
    subtitle,
    slug: trip.slug,
    start_date: startDate || null,
    end_date: endDate || null,
    hero_image_url: trip.hero_image_url,
    meta,
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
      <div className="mx-auto max-w-3xl px-6 pb-24" data-print="hide">
        <TripDocPreviews tripId={trip.id} />
        {canEdit && <GmailImportPanel tripId={trip.id} />}
        {canEdit && <DebugReportsPanel tripId={trip.id} />}
      </div>
      <Link
        to="/"
        data-print="hide"
        className="fixed left-3 top-3 z-50 inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 bg-paper/85 px-3 py-2 text-[10px] font-medium uppercase tracking-[0.35em] text-ink backdrop-blur-md transition-colors hover:border-seal hover:text-seal sm:left-4 sm:top-4 sm:px-3.5"
        aria-label="Back to TravelDoss"
      >
        <span aria-hidden>←</span>
        <span className="hidden sm:inline">TravelDoss</span>
      </Link>
      <ViewSwitch
        value={layout}
        onChange={(next) => {
          const apply = () => setLayout(next);
          // Kinetic Minimalism: smooth canvas-level transition where supported.
          const doc = document as Document & {
            startViewTransition?: (cb: () => void) => unknown;
          };
          const reduce =
            typeof window !== "undefined" &&
            window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
          if (doc.startViewTransition && !reduce) {
            doc.startViewTransition(apply);
          } else {
            apply();
          }
        }}
        tokens={skin.tokens}
      />
      {canEdit && (
        <StudioBar
          templateId={templateId}
          saving={saving}
          savedAt={savedAt}
          onTemplateChange={onTemplateChange}
          onMint={() => setMintOpen(true)}
          onUndo={undo}
          onRedo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
          refineStatus={refiner.status}
          refineHistory={refineHistory}
          onRestoreRefine={restoreRefine}
        />
      )}
      <ExportMenu slug={trip.slug} trip={view} blocks={blocks} />
      <PrintScheduleGrid trip={view} blocks={blocks} />
      <IngestionModal
        open={mintOpen}
        onOpenChange={setMintOpen}
        template={getSkin(templateId) ?? FALLBACK_SKIN}
        onGenerate={handleMint}
      />
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
      className="fixed left-1/2 top-3 z-50 flex -translate-x-1/2 gap-1 rounded-full p-1 backdrop-blur-sm sm:top-4"
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
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.15em] transition-colors sm:px-4 sm:py-2.5"
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
    <div className="flex min-h-dvh items-center justify-center bg-background px-6 text-center">
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