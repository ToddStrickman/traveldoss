import { afterEach, describe, it, expect, mock } from "bun:test";
import { render, cleanup } from "@testing-library/react";
import { EditingProvider, type EditingCtx } from "../src/lib/skins/shared/Editable";
import { VerticalView } from "../src/lib/skins/shared/views/VerticalView";
import { HorizontalView } from "../src/lib/skins/shared/views/HorizontalView";
import { GridView } from "../src/lib/skins/shared/views/GridView";
import { DEMO_TRIP, DEMO_BLOCKS } from "../src/lib/skins/demo";

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

function renderView(View: React.ComponentType<{ trip: typeof DEMO_TRIP; blocks: typeof DEMO_BLOCKS }>) {
  return render(
    <EditingProvider value={makeCtx()}>
      <View trip={DEMO_TRIP} blocks={DEMO_BLOCKS} />
    </EditingProvider>,
  );
}

const views: Array<[string, React.ComponentType<{ trip: typeof DEMO_TRIP; blocks: typeof DEMO_BLOCKS }>]> = [
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
        const { container } = renderView(View);
        // AddActivitySlot adds `tds-open-slot-inline` for filled buckets
        // (add-another) and omits it for empty buckets (open-slot editor).
        const slots = Array.from(container.querySelectorAll(".tds-open-slot"));
        const inline = slots.filter((s) => s.classList.contains("tds-open-slot-inline"));
        const empty = slots.filter((s) => !s.classList.contains("tds-open-slot-inline"));
        expect(empty.length).toBeGreaterThan(0);
        expect(inline.length).toBeGreaterThan(0);
      });
    });
  }
});