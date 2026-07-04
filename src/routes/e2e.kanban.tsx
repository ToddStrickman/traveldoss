import { useEffect, useMemo, useState } from "react";
import { createFileRoute, notFound } from "@tanstack/react-router";
import type { Block, SkinView } from "@/lib/skins/types";
import { DEMO_BLOCKS, DEMO_TRIP } from "@/lib/skins/demo";
import { getSkin, FALLBACK_SKIN } from "@/lib/skins/registry";
import {
  EditingProvider,
  arrayMove,
  type EditingCtx,
} from "@/lib/skins/shared/Editable";
import { moveActivity } from "@/lib/skins/shared/itinerary";

/**
 * E2E harness for kanban drag-and-drop.
 *
 * Only mounted in dev. It renders any skin's HorizontalView with editing
 * enabled against the in-memory DEMO_BLOCKS fixture, so Playwright can drive
 * real pointer drags without auth, database, or autosave noise.
 *
 * Query params:
 *   ?skin=<id>       (default: first registered skin)
 *   ?fixture=full|sparse|unsectioned
 */
export const Route = createFileRoute("/e2e/kanban")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound();
  },
  validateSearch: (
    s: Record<string, unknown>,
  ): { skin?: string; fixture: "sparse" | "unsectioned" | "full" } => ({
    skin: typeof s.skin === "string" ? s.skin : undefined,
    fixture:
      s.fixture === "sparse" || s.fixture === "unsectioned" ? s.fixture : "full",
  }),
  component: KanbanHarness,
});

function KanbanHarness() {
  const { skin: skinId, fixture } = Route.useSearch();
  const skin = getSkin(skinId ?? "") ?? FALLBACK_SKIN;
  const storageKey = `tds:e2e:kanban:${skin.meta.id}:${fixture}`;
  const [blocks, setBlocks] = useState<Block[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(storageKey);
        if (raw) return JSON.parse(raw) as Block[];
      } catch {
        /* ignore corrupt storage */
      }
    }
    return pickFixture(fixture);
  });

  // Persist every change. The harness is dev-only and the key is scoped per
  // skin+fixture so Playwright can reset by clearing storage.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(blocks));
    } catch {
      /* quota or disabled storage — non-fatal */
    }
  }, [blocks, storageKey]);

  const ctx: EditingCtx = useMemo(
    () => ({
      editing: true,
      onBlockChange: (i, patch) =>
        setBlocks((s) => {
          const next = s.slice();
          next[i] = { ...(next[i] as object), ...(patch as object) } as Block;
          return next;
        }),
      onBlockRemove: (i) => setBlocks((s) => s.filter((_, j) => j !== i)),
      onBlockAdd: () => {},
      onReorder: (from, to) => setBlocks((s) => arrayMove(s, from, to)),
      onMoveActivity: (src, dayIndex, part, before) =>
        setBlocks((s) => moveActivity(s, src, dayIndex, part, before)),
      onTripChange: () => {},
    }),
    [],
  );

  const view: SkinView = "horizontal";

  return (
    <EditingProvider value={ctx}>
      <div data-testid="kanban-harness" data-skin={skin.meta.id} data-fixture={fixture}>
        <skin.Render trip={DEMO_TRIP} blocks={blocks} view={view} />
        {/* Serialized state for Playwright assertions. */}
        <script
          type="application/json"
          data-testid="kanban-state"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(blocks) }}
        />
        <button
          type="button"
          data-testid="kanban-reset"
          onClick={() => {
            if (typeof window !== "undefined") window.localStorage.removeItem(storageKey);
            setBlocks(pickFixture(fixture));
          }}
          style={{ position: "fixed", left: -9999, top: -9999 }}
        >
          reset
        </button>
      </div>
    </EditingProvider>
  );
}

function pickFixture(name: "full" | "sparse" | "unsectioned"): Block[] {
  if (name === "sparse") return SPARSE_FIXTURE.map((b) => ({ ...b }));
  if (name === "unsectioned") return UNSECTIONED_FIXTURE.map((b) => ({ ...b }));
  return JSON.parse(JSON.stringify(DEMO_BLOCKS));
}

const SPARSE_FIXTURE: Block[] = [
  { kind: "day", n: 1, label: "Arrival" },
  { kind: "section", title: "Morning", partOfDay: "morning" },
  { kind: "place", name: "Coffee", category: "eat" },
  { kind: "section", title: "Afternoon", partOfDay: "afternoon" },
  { kind: "place", name: "Lunch", category: "eat" },
  { kind: "section", title: "Evening", partOfDay: "evening" },
  { kind: "place", name: "Dinner", category: "eat" },
  { kind: "day", n: 2, label: "Wander" },
  { kind: "section", title: "Afternoon", partOfDay: "afternoon" },
  { kind: "place", name: "Museum", category: "see" },
  { kind: "section", title: "Evening", partOfDay: "evening" },
  { kind: "place", name: "Fado", category: "do" },
];

const UNSECTIONED_FIXTURE: Block[] = [
  { kind: "day", n: 1, label: "Open" },
  { kind: "place", name: "Float A", category: "see" },
  { kind: "place", name: "Float B", category: "see" },
  { kind: "day", n: 2, label: "Structured" },
  { kind: "section", title: "Morning", partOfDay: "morning" },
  { kind: "place", name: "Brunch", category: "eat" },
];