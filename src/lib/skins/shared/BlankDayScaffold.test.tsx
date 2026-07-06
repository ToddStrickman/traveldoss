import { afterEach, describe, it, expect, mock } from "bun:test";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { BlankDayScaffold, isScaffoldTriggered } from "./BlankDayScaffold";
import { EditingProvider, type EditingCtx } from "./Editable";
import type { Block } from "../types";

function renderScaffold(blocks: Block[] = []) {
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
  };
  const utils = render(
    <EditingProvider value={ctx}>
      <BlankDayScaffold blocks={blocks} />
    </EditingProvider>,
  );
  return { onBlocksReplace, ...utils };
}

describe("BlankDayScaffold", () => {
  afterEach(() => cleanup());
  it("isScaffoldTriggered flips off once a place or flight exists", () => {
    expect(isScaffoldTriggered([])).toBe(true);
    expect(isScaffoldTriggered([{ kind: "day", n: 1, label: "Day 01" }])).toBe(true);
    expect(isScaffoldTriggered([{ kind: "place", name: "x", category: "other" }])).toBe(false);
    expect(isScaffoldTriggered([{ kind: "flight", direction: "outbound" }])).toBe(false);
  });

  it("renders 8 clickable ghost + buttons", () => {
    const { container } = renderScaffold([]);
    expect(container.querySelectorAll(".tds-ghost").length).toBe(8);
  });

  it("outbound flight ghost seeds outbound flight + Day 01 skeleton", () => {
    const { onBlocksReplace, getByText } = renderScaffold([]);
    fireEvent.click(getByText("Add outbound flight").closest("button")!);
    expect(onBlocksReplace).toHaveBeenCalledTimes(1);
    const next = onBlocksReplace.mock.calls[0][0] as Block[];
    expect(next[0]).toMatchObject({ kind: "flight", direction: "outbound" });
    expect(next.some((b) => b.kind === "day")).toBe(true);
    expect(
      next.filter((b) => b.kind === "section").map((b) => (b as { partOfDay: string }).partOfDay),
    ).toEqual(["morning", "afternoon", "evening"]);
  });

  it("inbound flight ghost appends an inbound flight last", () => {
    const { onBlocksReplace, getByText } = renderScaffold([]);
    fireEvent.click(getByText("Add inbound flight").closest("button")!);
    const next = onBlocksReplace.mock.calls[0][0] as Block[];
    expect(next[next.length - 1]).toMatchObject({ kind: "flight", direction: "inbound" });
  });

  it("every place ghost seeds a place block in the correct part-of-day", () => {
    const cases: Array<{ label: string; part: "morning" | "afternoon" | "evening"; category: string }> = [
      { label: "Where you're staying", part: "morning", category: "accommodation" },
      { label: "Rental car or transfer", part: "morning", category: "transit" },
      { label: "Museum, gallery, or landmark", part: "afternoon", category: "culture" },
      { label: "Neighborhood walk or hike", part: "afternoon", category: "walk" },
      { label: "Dinner reservation", part: "evening", category: "restaurant" },
      { label: "Concert, theater, or nightlife", part: "evening", category: "event" },
    ];
    for (const c of cases) {
      const { onBlocksReplace, getByText } = renderScaffold([]);
      fireEvent.click(getByText(c.label).closest("button")!);
      expect(onBlocksReplace).toHaveBeenCalledTimes(1);
      const next = onBlocksReplace.mock.calls[0][0] as Block[];
      const sectionIdx = next.findIndex(
        (b) => b.kind === "section" && (b as { partOfDay: string }).partOfDay === c.part,
      );
      expect(sectionIdx).toBeGreaterThanOrEqual(0);
      expect(next[sectionIdx + 1]).toMatchObject({ kind: "place", category: c.category });
      cleanup();
    }
  });
});
