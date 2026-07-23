/**
 * Dev-only dossier harness (mirrors e2e.kanban): renders the full mobile
 * dossier chrome — masthead bar, day-jump sheet, view pill/sheet — around a
 * skin Render fed by the demo fixture, with no DB or auth. Used to develop
 * and design-review the mobile visitor path at phone widths.
 *
 * Query params:
 *   ?skin=<id>                      (default: fallback skin)
 *   ?view=vertical|horizontal|grid (default: vertical)
 *   ?edit=1                         in-memory editing mode: full EditingProvider
 *                                   over local state, no persistence. Every
 *                                   would-be autosave is appended to
 *                                   window.__tdsSaveLog so specs can assert
 *                                   "this edit produced a save intent".
 */
import { useMemo, useRef, useState } from "react";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { FALLBACK_SKIN, getSkin } from "@/lib/skins/registry";
import type { Block, SkinView, TripMeta, TripView } from "@/lib/skins/types";
import { DEMO_BLOCKS, DEMO_TRIP } from "@/lib/skins/demo";
import { DossierMastheadBar } from "@/components/mobile/DossierMastheadBar";
import { ViewPill } from "@/components/mobile/ViewSheet";
import { StudioBar } from "@/components/studio/StudioBar";
import { IngestionModal } from "@/components/flow/IngestionModal";
import { EditingProvider, arrayMove, type EditingCtx } from "@/lib/skins/shared/Editable";
import { moveActivity } from "@/lib/skins/shared/itinerary";
import { autofillDayDates, notifyDayDateAutofill, type DayDateAutofill } from "@/lib/itinerary/day-dates";

export const Route = createFileRoute("/e2e/dossier")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound();
  },
  validateSearch: (
    s: Record<string, unknown>,
  ): { skin?: string; view: SkinView; edit?: boolean } => ({
    skin: typeof s.skin === "string" ? s.skin : undefined,
    view:
      s.view === "horizontal" || s.view === "grid" ? s.view : "vertical",
    edit: s.edit === 1 || s.edit === "1" || s.edit === true ? true : undefined,
  }),
  component: DossierHarness,
});

declare global {
  interface Window {
    __tdsSaveLog?: Array<{ at: number; blocks: number }>;
  }
}

function DossierHarness() {
  const search = Route.useSearch();
  const skin = getSkin(search.skin ?? "") ?? FALLBACK_SKIN;
  const [layout, setLayout] = useState<SkinView>(search.view);
  const [mintOpen, setMintOpen] = useState(false);
  const [snap, setSnap] = useState<{ trip: TripView; blocks: Block[] }>({
    trip: DEMO_TRIP,
    blocks: DEMO_BLOCKS,
  });
  const snapRef = useRef(snap);
  snapRef.current = snap;
  const editingCtx = useMemo<EditingCtx | null>(() => {
    if (!search.edit) return null;
    // Mirrors the t.$slug editing context minus persistence: every block
    // mutation lands in local state and is journaled to window.__tdsSaveLog
    // (the harness's stand-in for queueSave) so tests can assert intent.
    // Compute from a ref and journal outside setSnap — StrictMode
    // double-invokes state updaters, which would double-count saves in specs.
    const commit = (updater: (prev: { trip: TripView; blocks: Block[] }) => { trip: TripView; blocks: Block[] }) => {
      const next = updater(snapRef.current);
      snapRef.current = next;
      (window.__tdsSaveLog ??= []).push({ at: Date.now(), blocks: next.blocks.length });
      setSnap(next);
    };
    return {
      editing: true,
      onBlockChange: (index, patch) =>
        commit((s) => {
          const blocks = s.blocks.slice();
          blocks[index] = { ...(blocks[index] as object), ...(patch as object) } as Block;
          return { ...s, blocks };
        }),
      onBlockRemove: (index) =>
        commit((s) => ({ ...s, blocks: s.blocks.filter((_, i) => i !== index) })),
      onBlockAdd: (afterIndex, kind, seed) => {
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
        commit((s) => {
          const blocks = s.blocks.slice();
          blocks.splice(Math.max(0, afterIndex + 1), 0, { ...(base as object), ...(seed as object) } as Block);
          return { ...s, blocks };
        });
      },
      onBlocksReplace: (next) => commit((s) => ({ ...s, blocks: next })),
      onReorder: (from, to) => commit((s) => ({ ...s, blocks: arrayMove(s.blocks, from, to) })),
      onMoveActivity: (srcIndex, dayIndex, part, beforeIndex) =>
        commit((s) => ({ ...s, blocks: moveActivity(s.blocks, srcIndex, dayIndex, part, beforeIndex) })),
      onTripChange: (field, value) =>
        commit((s) => ({ ...s, trip: { ...s.trip, [field === "destination" ? "destination" : "subtitle"]: value } })),
      onTripDatesChange: (start, end) => {
        let fill: DayDateAutofill | null = null;
        commit((s) => {
          fill = autofillDayDates(s.blocks, start, end);
          return {
            trip: { ...s.trip, start_date: start || null, end_date: end || null },
            blocks: fill.blocks ?? s.blocks,
          };
        });
        notifyDayDateAutofill(fill, start);
      },
      onMetaChange: (patch: Partial<TripMeta>) =>
        commit((s) => ({ ...s, trip: { ...s.trip, meta: { ...(s.trip.meta ?? {}), ...patch } } })),
    };
  }, [search.edit]);
  // ?bar=mint exercises the sample-mode bottom bar + mint sheet without a DB.
  const sampleBar =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("bar") === "mint";

  return (
    <>
      {skin.tokens.fontUrl && <link rel="stylesheet" href={skin.tokens.fontUrl} />}
      <DossierMastheadBar title={snap.trip.destination} blocks={snap.blocks} />
      <div
        aria-hidden
        className="md:hidden"
        style={{ height: "calc(56px + env(safe-area-inset-top, 0px))" }}
      />
      {editingCtx ? (
        <EditingProvider value={editingCtx}>
          <skin.Render trip={snap.trip} blocks={snap.blocks} view={layout} />
        </EditingProvider>
      ) : (
        <skin.Render trip={snap.trip} blocks={snap.blocks} view={layout} />
      )}
      {sampleBar ? (
        <StudioBar
          emphasis="mint"
          leadingSlot={<ViewPill variant="inline" value={layout} onChange={setLayout} />}
          templateId={skin.meta.id}
          saving={false}
          savedAt={null}
          onTemplateChange={() => {}}
          onMint={() => setMintOpen(true)}
          mintLabel="Mint"
        />
      ) : (
        <ViewPill value={layout} onChange={setLayout} />
      )}
      <IngestionModal
        open={mintOpen}
        onOpenChange={setMintOpen}
        template={skin}
        onGenerate={() => setMintOpen(false)}
      />
    </>
  );
}
