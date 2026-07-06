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
import { DossierMastheadBar } from "@/components/mobile/DossierMastheadBar";
import { LockPill } from "@/components/studio/LockPill";
import { TemplateMenu } from "@/components/studio/TemplateMenu";
import { useIsMobile } from "@/hooks/use-mobile";
import { AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { useHistory, useUndoRedoShortcuts } from "@/hooks/use-history";
import { useItineraryRefiner } from "@/hooks/use-itinerary-refiner";
import { hardenItineraryAi } from "@/lib/itinerary/harden.functions";

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
  validateSearch: z.object({
    mode: z.enum(["edit", "view"]).optional(),
    mint: z.union([z.literal("1"), z.literal(1), z.boolean()]).optional(),
    // Additive + shareable: layout survives reload and cross-device handoff.
    view: z.enum(["vertical", "horizontal", "grid"]).optional(),
  }),
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
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [layout, setLayoutState] = useState<SkinView>(search.view ?? "vertical");
  // Reflect layout into ?view= so the choice is shareable; replace history so
  // back doesn't step through layout toggles.
  const setLayout = useCallback(
    (next: SkinView) => {
      setLayoutState(next);
      void navigate({
        to: ".",
        search: (prev: Record<string, unknown>) => ({ ...prev, view: next === "vertical" ? undefined : next }),
        replace: true,
        resetScroll: false,
      });
    },
    [navigate],
  );
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
  const [justMinted, setJustMinted] = useState(false);
  const save = useServerFn(updateDossier);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const tripOwner = (trip as { user_id?: string }).user_id;
    // Fast path: read the locally cached session synchronously so
    // canEdit flips to true on the very first client render for the
    // owner — otherwise scaffold plus-signs stay dead until the
    // async getUser round-trip resolves and the user's early clicks
    // silently drop.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user && tripOwner && tripOwner === data.session.user.id) {
        setIsOwner(true);
      }
    });
    // Authoritative confirmation.
    supabase.auth.getUser().then(({ data }) => {
      if (data.user && tripOwner && tripOwner === data.user.id) setIsOwner(true);
      else setIsOwner(false);
    });
  }, [trip]);

  // Re-open the mint modal after the login round-trip. Users who click
  // "Compose Dossier" while signed out are bounced through /login with
  // ?mint=1 preserved; on return we auto-open the modal (once they're
  // actually signed in) and strip the flag so a manual close sticks.
  useEffect(() => {
    if (!search.mint) return;
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled || !data.user) return;
      setMintOpen(true);
      navigate({
        to: "/t/$slug",
        params: { slug: trip.slug },
        search: { mode: search.mode },
        replace: true,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [search.mint, search.mode, trip.slug, navigate]);

  const phase = getTemporalPhase(trip.start_date, trip.end_date);
  const canEdit = isOwner && phase !== "archive" && !expired;

  // Global Lock/Unlock — mobile locks by default so a stray finger can't
  // grab a card; desktop unlocks so clicking straight into a field just
  // works. Persisted per-trip for the session so a refresh keeps intent.
  const isMobile = useIsMobile();
  const lockKey = `td:lock:${trip.slug}`;
  const [locked, setLocked] = useState<boolean>(true);
  const lockInitRef = useRef(false);
  useEffect(() => {
    if (lockInitRef.current) return;
    lockInitRef.current = true;
    let stored: string | null = null;
    try {
      stored = sessionStorage.getItem(lockKey);
    } catch {
      /* ignore */
    }
    if (stored === "0") setLocked(false);
    else if (stored === "1") setLocked(true);
    else setLocked(isMobile);
  }, [isMobile, lockKey]);
  const toggleLock = useCallback(() => {
    setLocked((prev) => {
      const next = !prev;
      try {
        sessionStorage.setItem(lockKey, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, [lockKey]);
  const isEditing = canEdit && !locked;

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
        // Move the trip out of the "Sample Trip" state on mint so a refresh
        // doesn't reset the dossier back to sample/preview mode. Prefer the
        // AI-parsed destination; otherwise use a neutral placeholder the
        // owner can rename inline.
        const resolved =
          (nextDestination && nextDestination.trim()) ||
          (s.destination !== "Sample Trip" ? s.destination : "Untitled Trip");
        if (resolved !== s.destination) {
          next.destination = resolved;
          patch.destination = resolved;
        }
        return next;
      });
      queueSave(patch);
      setMintOpen(false);
      setJustMinted(true);
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

  // Background hardening pipeline: once per trip load when blocks exist
  // and the user can edit, run search → logic confirm → re-harden → final
  // completeness pass server-side and silently merge the result.
  const hardenFn = useServerFn(hardenItineraryAi);
  const hardenedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!canEdit) return;
    if (!blocks.length) return;
    if (hardenedFor.current === trip.id) return;
    hardenedFor.current = trip.id;
    const handle = setTimeout(() => {
      hardenFn({
        data: {
          blocks,
          destination: destination || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          meta,
        },
      })
        .then((res) => {
          if (!res?.blocks?.length) return;
          setSnap(
            (s) => ({ ...s, blocks: res.blocks as Block[] }),
            { coalesceKey: "harden:initial" },
          );
          queueSave({ blocks: res.blocks as Block[] });
        })
        .catch((err) => console.error("[harden] background pass failed", err));
    }, 2500);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.id, canEdit, blocks.length]);

  const editingCtx = useMemo(
    () => ({
      editing: isEditing,
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
      onBlockAdd: (afterIndex: number, kind: Block["kind"], seed?: Partial<Block>) => {
        const base: Block =
          kind === "day"
            ? { kind: "day", n: 1, label: "New day" }
            : kind === "place"
            ? { kind: "place", name: "New place", category: "other" }
            : kind === "section"
            ? { kind: "section", title: "New section" }
            : kind === "note"
            ? { kind: "note", text: "" }
            : { kind: "paragraph", text: "" };
        const fresh = { ...(base as object), ...(seed as object) } as Block;
        setSnap((s) => {
          const next = s.blocks.slice();
          next.splice(Math.max(0, afterIndex + 1), 0, fresh);
          return { ...s, blocks: next };
        });
      },
      onBlocksReplace: (next: Block[]) => {
        setSnap((s) => ({ ...s, blocks: next }));
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
    [isEditing, setSnap],
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

  // Layout switching with a canvas-level transition where supported
  // (Kinetic Minimalism); shared by the desktop pills and the mobile sheet.
  const changeLayout = (next: SkinView) => {
    const apply = () => setLayout(next);
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
  };

  return (
    <EditingProvider value={editingCtx}>
      {skin.tokens.fontUrl && <link rel="stylesheet" href={skin.tokens.fontUrl} />}
      {phase === "active" && <CompanionToday blocks={blocks} />}
      {phase === "archive" && (
        <div className="sticky top-14 z-30 border-b border-ink/15 bg-paper/85 px-6 py-3 text-center text-[10px] uppercase tracking-[0.4em] text-ink-soft backdrop-blur-md md:top-0">
          {phaseCopy("archive").label} · {phaseCopy("archive").tagline}
        </div>
      )}
      {/* Mobile top chrome: one bar replaces the floating back pill, the
          top view pills, and gives the day-jump entry point. */}
      <DossierMastheadBar
        title={destination}
        blocks={blocks}
        canEdit={canEdit}
        locked={locked}
        onToggleLock={toggleLock}
        tokens={skin.tokens}
        layout={layout}
        onLayoutChange={changeLayout}
      />
      <div
        aria-hidden
        className="md:hidden"
        style={{ height: "calc(56px + env(safe-area-inset-top, 0px))" }}
      />
      <skin.Render trip={view} blocks={blocks} view={layout} />
      <div className="mx-auto max-w-3xl px-6 pb-24" data-print="hide">
        {canEdit && <TripDocPreviews tripId={trip.id} />}
        {canEdit && <GmailImportPanel tripId={trip.id} />}
        {canEdit && import.meta.env.DEV && <DebugReportsPanel tripId={trip.id} />}
      </div>
      <Link
        to="/"
        data-print="hide"
        className="fixed left-3 top-3 z-50 hidden min-h-11 items-center gap-2 rounded-full border border-white/15 bg-paper/85 px-3 py-2 text-[10px] font-medium uppercase tracking-[0.35em] text-ink backdrop-blur-md transition-colors hover:border-seal hover:text-seal md:inline-flex md:left-4 md:top-4 md:px-3.5"
        aria-label="Back to TravelDoss"
      >
        <span aria-hidden>←</span>
        <span className="hidden sm:inline">TravelDoss</span>
      </Link>
      <ViewSwitch value={layout} onChange={changeLayout} tokens={skin.tokens} />
      {/* Mobile view switching now lives inline in the DossierMastheadBar
          (matches desktop's top-center pills) — no separate floating pill. */}
      {canEdit && (
        <>
          <LockPill locked={locked} onToggle={toggleLock} />
          <TemplateMenu
            templateId={templateId}
            onTemplateChange={onTemplateChange}
            onRegenerate={() => {
              if (blocks.length > 0) {
                const ok = window.confirm(
                  "Regenerate this dossier from a new source? Your current blocks will be overwritten. (Undo with ⌘Z afterwards.)",
                );
                if (!ok) return;
              }
              setMintOpen(true);
            }}
          />
          <AnimatePresence>
            {isEditing ? (
              <StudioBar
                key="studio-minimal"
                variant="minimal"
                templateId={templateId}
                saving={saving}
                savedAt={savedAt}
                onTemplateChange={onTemplateChange}
                onUndo={undo}
                onRedo={redo}
                canUndo={canUndo}
                canRedo={canRedo}
                refineStatus={refiner.status}
                refineHistory={refineHistory}
                onRestoreRefine={restoreRefine}
              />
            ) : null}
          </AnimatePresence>
        </>
      )}
      {blocks.length > 0 && (
        <ExportMenu slug={trip.slug} trip={view} blocks={blocks} isOwner={isOwner} />
      )}
      <PrintScheduleGrid trip={view} blocks={blocks} />
      <IngestionModal
        open={mintOpen}
        onOpenChange={setMintOpen}
        template={getSkin(templateId) ?? FALLBACK_SKIN}
        onGenerate={handleMint}
        tripId={trip.id}
        tripCreatedAt={(trip as { created_at?: string }).created_at ?? null}
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
      className="fixed left-1/2 top-3 z-50 hidden -translate-x-1/2 gap-1 rounded-full p-1 backdrop-blur-sm sm:top-4 md:flex"
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