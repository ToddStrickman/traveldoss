import type { Block } from "../types";
import { useEditing } from "./Editable";
import { CategoryIcon } from "./CategoryIcon";
import { Plane, Plus } from "lucide-react";

type GhostPlace = {
  category: NonNullable<Extract<Block, { kind: "place" }>["category"]>;
  partOfDay: "morning" | "afternoon" | "evening";
  label: string;
  hint: string;
  guide: string;
};

/**
 * Rendered inside the skin canvas when an editable dossier has no real
 * place/flight content. Every slot is a clickable ghost — clicking one
 * calls onBlockAdd with a seeded patch so the fresh block lands in the
 * right day + part-of-day with the right category. The scaffold unmounts
 * as soon as the first real place or flight exists.
 */
export function BlankDayScaffold({ blocks }: { blocks: Block[] }) {
  const { onBlocksReplace, editing } = useEditing();

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
    { category: "accommodation", partOfDay: "morning", label: "Where you're staying",
      hint: "Hotel · check-in time",
      guide: "Click to add your hotel or rental — name, address, and check-in time." },
    { category: "transit", partOfDay: "morning", label: "Rental car or transfer",
      hint: "Vendor · pickup",
      guide: "Click to log a rental car, taxi, ferry, or private transfer." },
    { category: "culture", partOfDay: "afternoon", label: "Museum, gallery, or landmark",
      hint: "Ticket · hours",
      guide: "Click to add a museum, exhibit, or cultural stop with ticket details." },
    { category: "walk", partOfDay: "afternoon", label: "Neighborhood walk or hike",
      hint: "Trailhead · distance",
      guide: "Click to plan a walk or hike — trailhead, distance, difficulty." },
    { category: "restaurant", partOfDay: "evening", label: "Dinner reservation",
      hint: "Time · dress code",
      guide: "Click to book a dinner — restaurant, time, party size, dress code." },
    { category: "event", partOfDay: "evening", label: "Concert, theater, or nightlife",
      hint: "Doors · seat",
      guide: "Click to add a show, concert, or nightlife stop — venue, doors, seat." },
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
      data-editing={editing ? "true" : "false"}
      aria-label="Blank dossier — click a slot to start filling it in"
      data-print="hide"
    >
      {!editing ? (
        <p className="tds-scaffold-locked-hint" role="status">
          Editing is locked. Tap the lock in the top bar (or press ⌘/Ctrl+E) to start filling in your dossier.
        </p>
      ) : null}
      <div className="tds-scaffold-intro-block">
        <p className="tds-scaffold-eyebrow">Start here</p>
        <h2 className="tds-scaffold-headline">
          Your dossier is empty. Fill it in, one slot at a time.
        </h2>
        <p className="tds-scaffold-intro">
          Each dashed tile below is a real slot in your dossier. Click any
          one to open its editor — the scaffold disappears the moment your
          first entry lands, and everything you add stays in your dossier.
        </p>
        <ol className="tds-scaffold-steps">
          <li><span className="tds-scaffold-step-n">1</span> Log your flights — outbound above, return below.</li>
          <li><span className="tds-scaffold-step-n">2</span> Anchor Day 01 with where you're staying.</li>
          <li><span className="tds-scaffold-step-n">3</span> Add what you're doing morning, afternoon, and evening.</li>
        </ol>
      </div>

      <button
        type="button"
        className="tds-ghost tds-ghost-flight tap"
        onClick={() => addFlightGhost("outbound")}
      >
        <span className="tds-ghost-step" aria-hidden>1</span>
        <span className="tds-ghost-icon" aria-hidden>
          <Plane size={16} />
        </span>
        <span className="tds-ghost-body">
          <span className="tds-ghost-label">Add outbound flight</span>
          <span className="tds-ghost-hint">Airline · confirmation · seat</span>
          <span className="tds-ghost-guide">
            Click to log the flight that gets you there — airline, flight
            number, confirmation, seat, and gate.
          </span>
        </span>
        <span className="tds-ghost-plus" aria-hidden>
          <Plus size={14} />
        </span>
      </button>

      <section className="tds-scaffold-day">
        <header className="tds-scaffold-day-head">
          <div className="tds-day-no">Day 01</div>
          <div className="tds-day-label tds-scaffold-day-label">
            Rename this day when you know the plan
          </div>
        </header>

        {(["morning", "afternoon", "evening"] as const).map((part, partIdx) => (
          <div key={part} className="tds-scaffold-part">
            <div className="tds-scaffold-part-heading">
              <span className="tds-scaffold-part-n">{partIdx + 2}</span>
              <span>{part}</span>
              <span className="tds-scaffold-part-caption">
                {part === "morning"
                  ? "How the day opens"
                  : part === "afternoon"
                    ? "The middle stretch"
                    : "How the day closes"}
              </span>
            </div>
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
                    <span className="tds-ghost-guide">{g.guide}</span>
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
        className="tds-ghost tds-ghost-flight tap"
        onClick={() => addFlightGhost("inbound")}
      >
        <span className="tds-ghost-step" aria-hidden>5</span>
        <span className="tds-ghost-icon" aria-hidden>
          <Plane size={16} style={{ transform: "scaleX(-1)" }} />
        </span>
        <span className="tds-ghost-body">
          <span className="tds-ghost-label">Add inbound flight</span>
          <span className="tds-ghost-hint">Return leg · seat · baggage</span>
          <span className="tds-ghost-guide">
            Click to log the return leg — carrier, time, seat, and any
            baggage confirmations you'll want at the gate.
          </span>
        </span>
        <span className="tds-ghost-plus" aria-hidden>
          <Plus size={14} />
        </span>
      </button>

    </section>
  );
}

/**
 * Show the blank scaffold when the dossier is genuinely empty
 * (no place/flight yet) OR when it's still a pre-mint "Sample Trip"
 * seeded with demo blocks — in both cases the owner needs the
 * clickable cues, not sample content masquerading as their plan.
 */
export function isScaffoldTriggered(
  blocks: Block[],
  opts?: { destination?: string },
): boolean {
  if (opts?.destination === "Sample Trip") return true;
  return !blocks.some((b) => b.kind === "place" || b.kind === "flight");
}