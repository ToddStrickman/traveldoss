import type { Block } from "../types";
import { useEditing } from "./Editable";
import { CategoryIcon } from "./CategoryIcon";
import { Plane, Plus } from "lucide-react";

type GhostPlace = {
  category: NonNullable<Extract<Block, { kind: "place" }>["category"]>;
  partOfDay: "morning" | "afternoon" | "evening";
  label: string;
  hint: string;
};

/**
 * Rendered inside the skin canvas when an editable dossier has no real
 * place/flight content. Every slot is a clickable ghost — clicking one
 * calls onBlockAdd with a seeded patch so the fresh block lands in the
 * right day + part-of-day with the right category. The scaffold unmounts
 * as soon as the first real place or flight exists.
 */
export function BlankDayScaffold({ blocks }: { blocks: Block[] }) {
  const { onBlocksReplace } = useEditing();

  /** Build a full day skeleton: [outbound?, day, morning, afternoon, evening, place?, inbound?] */
  function materialize(opts: {
    place?: { category: GhostPlace["category"]; partOfDay: GhostPlace["partOfDay"] };
    flight?: "outbound" | "inbound";
  }) {
    const existingDay = blocks.find((b) => b.kind === "day") as
      | Extract<Block, { kind: "day" }>
      | undefined;
    const day: Block = existingDay ?? { kind: "day", n: 1, label: "Day 01" };
    const sections: Block[] = [
      { kind: "section", title: "Morning", partOfDay: "morning" },
      { kind: "section", title: "Afternoon", partOfDay: "afternoon" },
      { kind: "section", title: "Evening", partOfDay: "evening" },
    ];
    const next: Block[] = [];
    if (opts.flight === "outbound") {
      next.push({ kind: "flight", direction: "outbound" });
    }
    next.push(day);
    for (const s of sections) {
      next.push(s);
      if (opts.place && (s as Extract<Block, { kind: "section" }>).partOfDay === opts.place.partOfDay) {
        next.push({ kind: "place", name: "", category: opts.place.category });
      }
    }
    if (opts.flight === "inbound") {
      next.push({ kind: "flight", direction: "inbound" });
    }
    onBlocksReplace?.(next);
  }

  const ghosts: GhostPlace[] = [
    { category: "accommodation", partOfDay: "morning", label: "Where you're staying", hint: "Hotel · check-in time" },
    { category: "transit", partOfDay: "morning", label: "Rental car or transfer", hint: "Vendor · pickup" },
    { category: "culture", partOfDay: "afternoon", label: "Museum, gallery, or landmark", hint: "Ticket · hours" },
    { category: "walk", partOfDay: "afternoon", label: "Neighborhood walk or hike", hint: "Trailhead · distance" },
    { category: "restaurant", partOfDay: "evening", label: "Dinner reservation", hint: "Time · dress code" },
    { category: "event", partOfDay: "evening", label: "Concert, theater, or nightlife", hint: "Doors · seat" },
  ];

  const addPlaceGhost = (g: GhostPlace) => materialize({ place: g });
  const addFlightGhost = (direction: "outbound" | "inbound") =>
    materialize({ flight: direction });

  const grouped: Record<GhostPlace["partOfDay"], GhostPlace[]> = {
    morning: ghosts.filter((g) => g.partOfDay === "morning"),
    afternoon: ghosts.filter((g) => g.partOfDay === "afternoon"),
    evening: ghosts.filter((g) => g.partOfDay === "evening"),
  };

  return (
    <section
      className="tds-scaffold"
      aria-label="Blank dossier — click a slot to start filling it in"
      data-print="hide"
    >
      <p className="tds-scaffold-intro">
        This is your blank canvas. Tap any slot to add real details — flights,
        stays, meals, walks. The scaffold disappears the moment your first
        entry lands.
      </p>

      <button
        type="button"
        className="tds-ghost tds-ghost-flight"
        onClick={() => addFlightGhost("outbound")}
      >
        <span className="tds-ghost-icon" aria-hidden>
          <Plane size={16} />
        </span>
        <span className="tds-ghost-body">
          <span className="tds-ghost-label">Add outbound flight</span>
          <span className="tds-ghost-hint">Airline · confirmation · seat</span>
        </span>
      </button>

      <section className="tds-scaffold-day">
        <header className="tds-scaffold-day-head">
          <div className="tds-day-no">Day 01</div>
          <div className="tds-day-label tds-scaffold-day-label">
            Rename this day when you know the plan
          </div>
        </header>

        {(["morning", "afternoon", "evening"] as const).map((part) => (
          <div key={part} className="tds-scaffold-part">
            <div className="tds-scaffold-part-heading">{part}</div>
            <div className="tds-scaffold-part-rows">
              {grouped[part].map((g) => (
                <button
                  key={g.category + g.label}
                  type="button"
                  className="tds-ghost tds-ghost-place tap"
                  onClick={() => addPlaceGhost(g)}
                >
                  <span className="tds-ghost-icon" aria-hidden>
                    <CategoryIcon category={g.category} />
                  </span>
                  <span className="tds-ghost-body">
                    <span className="tds-ghost-label">{g.label}</span>
                    <span className="tds-ghost-hint">{g.hint}</span>
                  </span>
                  <span className="tds-ghost-plus" aria-hidden>
                    <Plus size={14} />
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>

      <button
        type="button"
        className="tds-ghost tds-ghost-flight"
        onClick={() => addFlightGhost("inbound")}
      >
        <span className="tds-ghost-icon" aria-hidden>
          <Plane size={16} style={{ transform: "scaleX(-1)" }} />
        </span>
        <span className="tds-ghost-body">
          <span className="tds-ghost-label">Add inbound flight</span>
          <span className="tds-ghost-hint">Return leg · seat · baggage</span>
        </span>
      </button>

    </section>
  );
}

export function isScaffoldTriggered(blocks: Block[]): boolean {
  return !blocks.some((b) => b.kind === "place" || b.kind === "flight");
}