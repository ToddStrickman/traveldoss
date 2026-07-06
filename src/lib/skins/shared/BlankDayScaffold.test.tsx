import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { BlankDayScaffold, isScaffoldTriggered } from "./BlankDayScaffold";
import { EditingProvider, type EditingCtx } from "./Editable";
import type { Block } from "../types";

function renderScaffold(blocks: Block[] = []) {
  const onBlocksReplace = vi.fn();
  const ctx: EditingCtx = {
    editing: true,
    onBlockChange: vi.fn(),
    onBlockRemove: vi.fn(),
    onBlockAdd: vi.fn(),
    onBlocksReplace,
    onReorder: vi.fn(),
    onTripChange: vi.fn(),
    onMoveActivity: vi.fn(),
  };
  render(
    <EditingProvider value={ctx}>
      <BlankDayScaffold blocks={blocks} />
    </EditingProvider>,
  );
  return { onBlocksReplace };
}

describe("BlankDayScaffold", () => {
  it("isScaffoldTriggered is true for empty blocks and false once a place/flight exists", () => {
    expect(isScaffoldTriggered([])).toBe(true);
    expect(isScaffoldTriggered([{ kind: "day", n: 1, label: "Day 01" }])).toBe(true);
    expect(
      isScaffoldTriggered([{ kind: "place", name: "x", category: "other" }]),
    ).toBe(false);
    expect(
      isScaffoldTriggered([{ kind: "flight", direction: "outbound" }]),
    ).toBe(false);
  });

  it("renders 8 ghost + buttons (outbound, 6 place slots, inbound)", () => {
    renderScaffold([]);
    expect(document.querySelectorAll(".tds-ghost").length).toBe(8);
  });

  it("clicking outbound flight ghost seeds an outbound flight + Day 01 skeleton", () => {
    const { onBlocksReplace } = renderScaffold([]);
    fireEvent.click(screen.getByText("Add outbound flight").closest("button")!);
    expect(onBlocksReplace).toHaveBeenCalledTimes(1);
    const next = onBlocksReplace.mock.calls[0][0] as Block[];
    expect(next[0]).toMatchObject({ kind: "flight", direction: "outbound" });
    expect(next.some((b) => b.kind === "day")).toBe(true);
    expect(
      next.filter((b) => b.kind === "section").map((b) => (b as { partOfDay: string }).partOfDay),
    ).toEqual(["morning", "afternoon", "evening"]);
  });

  it("clicking inbound flight ghost appends an inbound flight after the sections", () => {
    const { onBlocksReplace } = renderScaffold([]);
    fireEvent.click(screen.getByText("Add inbound flight").closest("button")!);
    const next = onBlocksReplace.mock.calls[0][0] as Block[];
    expect(next[next.length - 1]).toMatchObject({ kind: "flight", direction: "inbound" });
  });

  it("each place ghost seeds a place block in the correct part-of-day", () => {
    const cases: Array<{ label: string; part: "morning" | "afternoon" | "evening"; category: string }> = [
      { label: "Where you're staying", part: "morning", category: "accommodation" },
      { label: "Rental car or transfer", part: "morning", category: "transit" },
      { label: "Museum, gallery, or landmark", part: "afternoon", category: "culture" },
      { label: "Neighborhood walk or hike", part: "afternoon", category: "walk" },
      { label: "Dinner reservation", part: "evening", category: "restaurant" },
      { label: "Concert, theater, or nightlife", part: "evening", category: "event" },
    ];
    for (const c of cases) {
      const { onBlocksReplace } = renderScaffold([]);
      fireEvent.click(screen.getByText(c.label).closest("button")!);
      expect(onBlocksReplace).toHaveBeenCalledTimes(1);
      const next = onBlocksReplace.mock.calls[0][0] as Block[];
      // Find the section for this part; the following block must be the seeded place.
      const sectionIdx = next.findIndex(
        (b) => b.kind === "section" && (b as { partOfDay: string }).partOfDay === c.part,
      );
      expect(sectionIdx).toBeGreaterThanOrEqual(0);
      const seeded = next[sectionIdx + 1];
      expect(seeded).toMatchObject({ kind: "place", category: c.category });
    }
  });
});