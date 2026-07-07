import { afterEach, describe, it, expect, mock } from "bun:test";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { EditingProvider, type EditingCtx } from "../src/lib/skins/shared/Editable";
import { VerticalView } from "../src/lib/skins/shared/views/VerticalView";
import { HorizontalView } from "../src/lib/skins/shared/views/HorizontalView";
import { GridView } from "../src/lib/skins/shared/views/GridView";
import { DEMO_TRIP, DEMO_BLOCKS } from "../src/lib/skins/demo";
import type { Block } from "../src/lib/skins/types";

/** One day with morning filled and afternoon/evening empty — guarantees BOTH
 *  the empty-slot editor and the "add another" affordance render. */
const SPARSE_BLOCKS: Block[] = [
  { kind: "day", n: 1, label: "Day 01" },
  { kind: "section", part: "morning" },
  { kind: "place", name: "Cafe A Brasileira", category: "other" },
];

/**
 * Mobile edit-mode parity: EditableHero, EditableDayHeader, AddDayButton
 * (the sun-icon "add another day"), and the AddActivitySlot open-slot must
 * render in ALL THREE views when `editing` is true. Locks in the guarantee
 * that users can edit from any layout on mobile — no drift between views.
 */

function makeCtx(): EditingCtx {
  return {
    editing: true,
    onBlockChange: mock(() => {}),
    onBlockRemove: mock(() => {}),
    onBlockAdd: mock(() => {}),
    onBlocksReplace: mock(() => {}),
    onReorder: mock(() => {}),
    onTripChange: mock(() => {}),
    onMoveActivity: mock(() => {}),
    onMetaChange: mock(() => {}),
    onTripDatesChange: mock(() => {}),
  } as EditingCtx;
}

function renderView(
  View: React.ComponentType<{ trip: typeof DEMO_TRIP; blocks: Block[] }>,
  blocks: Block[] = DEMO_BLOCKS,
) {
  return render(
    <EditingProvider value={makeCtx()}>
      <View trip={DEMO_TRIP} blocks={blocks} />
    </EditingProvider>,
  );
}

const views: Array<[string, React.ComponentType<{ trip: typeof DEMO_TRIP; blocks: Block[] }>]> = [
  ["VerticalView", VerticalView],
  ["HorizontalView", HorizontalView],
  ["GridView", GridView],
];

describe("mobile edit-mode parity", () => {
  afterEach(() => cleanup());

  for (const [name, View] of views) {
    describe(name, () => {
      it("renders EditableHero (trip title)", () => {
        const { container } = renderView(View);
        expect(container.querySelector(".tds-trip-title")).not.toBeNull();
      });

      it("renders at least one EditableDayHeader", () => {
        const { container } = renderView(View);
        expect(container.querySelector(".tds-day-headline, .tds-grid-day-head")).not.toBeNull();
      });

      it("renders the sun-icon AddDayButton when editing", () => {
        const { container } = renderView(View);
        expect(container.querySelector(".tds-add-day")).not.toBeNull();
      });

      it("renders an AddActivitySlot open-slot when editing", () => {
        const { container } = renderView(View);
        expect(container.querySelector(".tds-open-slot-plus")).not.toBeNull();
      });

      it("renders BOTH an empty-slot editor and an 'add another' affordance", () => {
        const { container } = renderView(View, SPARSE_BLOCKS);
        // AddActivitySlot adds `tds-open-slot-inline` for filled buckets
        // (add-another) and omits it for empty buckets (open-slot editor).
        const slots = Array.from(container.querySelectorAll(".tds-open-slot"));
        const inline = slots.filter((s) => s.classList.contains("tds-open-slot-inline"));
        const empty = slots.filter((s) => !s.classList.contains("tds-open-slot-inline"));
        expect(empty.length).toBeGreaterThan(0);
        expect(inline.length).toBeGreaterThan(0);
      });

      it("renders day-reorder chevrons for each day when editing", () => {
        const { container } = renderView(View);
        // One .tds-day-reorder group per day; two buttons inside each.
        const groups = container.querySelectorAll(".tds-day-reorder");
        expect(groups.length).toBeGreaterThan(0);
        for (const g of groups) {
          // Up + down chevrons + delete = 3 buttons per day.
          expect(g.querySelectorAll(".tds-day-reorder-btn").length).toBe(3);
          expect(g.querySelectorAll(".tds-day-delete-btn").length).toBe(1);
        }
      });

      it("delete-day button removes the day (and its activities) via onBlocksReplace", () => {
        const onBlocksReplace = mock((_next: Block[]) => {});
        const ctx: EditingCtx = {
          editing: true,
          onBlockChange: mock(() => {}),
          onBlockRemove: mock(() => {}),
          onBlockAdd: mock(() => {}),
          onBlocksReplace,
          onReorder: mock(() => {}),
          onTripChange: mock(() => {}),
          onMoveActivity: mock(() => {}),
          onMetaChange: mock(() => {}),
          onTripDatesChange: mock(() => {}),
        } as EditingCtx;
        // Stub window.confirm — jsdom/happy-dom returns false by default.
        const originalConfirm = window.confirm;
        window.confirm = () => true;
        try {
          const { container } = render(
            <EditingProvider value={ctx}>
              <View trip={DEMO_TRIP} blocks={DEMO_BLOCKS} />
            </EditingProvider>,
          );
          const delBtn = container.querySelector(".tds-day-delete-btn") as HTMLButtonElement | null;
          expect(delBtn).not.toBeNull();
          fireEvent.click(delBtn!);
          expect(onBlocksReplace).toHaveBeenCalledTimes(1);
          const next = (onBlocksReplace as unknown as { mock: { calls: Block[][][] } }).mock.calls[0][0];
          // DEMO_BLOCKS has 3 days; deleting the first leaves 2.
          const remainingDays = next.filter((b) => b.kind === "day").length;
          expect(remainingDays).toBe(2);
        } finally {
          window.confirm = originalConfirm;
        }
      });

      it("clicking sun-icon Add Day calls onBlockAdd with a new day block", () => {
        const onBlockAdd = mock(() => {});
        const ctx: EditingCtx = {
          editing: true,
          onBlockChange: mock(() => {}),
          onBlockRemove: mock(() => {}),
          onBlockAdd,
          onBlocksReplace: mock(() => {}),
          onReorder: mock(() => {}),
          onTripChange: mock(() => {}),
          onMoveActivity: mock(() => {}),
          onMetaChange: mock(() => {}),
          onTripDatesChange: mock(() => {}),
        } as EditingCtx;
        const { container } = render(
          <EditingProvider value={ctx}>
            <View trip={DEMO_TRIP} blocks={DEMO_BLOCKS} />
          </EditingProvider>,
        );
        const btn = container.querySelector("button.tds-add-day") as HTMLButtonElement | null;
        expect(btn).not.toBeNull();
        fireEvent.click(btn!);
        expect(onBlockAdd).toHaveBeenCalledTimes(1);
        const call = (onBlockAdd as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
        // Signature: (insertAfter: number, kind: "day", payload: { n, label })
        expect(call[1]).toBe("day");
        const payload = call[2] as { n: number; label: string };
        // DEMO_BLOCKS spans day 1-3, so the next N must be 4.
        expect(payload.n).toBe(4);
        expect(payload.label).toBe("Day 04");
      });

      it("Add Day is hidden when editing is off", () => {
        const ctx: EditingCtx = {
          editing: false,
          onBlockChange: mock(() => {}),
          onBlockRemove: mock(() => {}),
          onBlockAdd: mock(() => {}),
          onBlocksReplace: mock(() => {}),
          onReorder: mock(() => {}),
          onTripChange: mock(() => {}),
          onMoveActivity: mock(() => {}),
        } as EditingCtx;
        const { container } = render(
          <EditingProvider value={ctx}>
            <View trip={DEMO_TRIP} blocks={DEMO_BLOCKS} />
          </EditingProvider>,
        );
        expect(container.querySelector(".tds-add-day")).toBeNull();
      });
    });
  }
});