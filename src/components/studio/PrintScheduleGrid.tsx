import type { Block, TripView } from "@/lib/skins/types";

/**
 * Print-only schedule grid appended to the dossier in PDF export
 * (`body.td-print-mode` is set by ExportMenu just before window.print()).
 * Renders each day as Morning / Afternoon / Evening columns with venue
 * links — a clean reference grid that prints well even when the live
 * dossier is image-heavy.
 */

type Slot = "morning" | "afternoon" | "evening";

function bucketFor(time?: string): Slot {
  if (!time) return "morning";
  const m = /^(\d{1,2})(?::(\d{2}))?/.exec(time.trim());
  if (!m) return "morning";
  const h = Number(m[1]);
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

type Day = { label: string; slots: Record<Slot, Block[]> };

function bucketDays(blocks: Block[]): Day[] {
  const days: Day[] = [];
  let cur: Day | null = null;
  const ensure = () => {
    if (!cur) {
      cur = { label: "Day 1", slots: { morning: [], afternoon: [], evening: [] } };
      days.push(cur);
    }
    return cur;
  };
  for (const b of blocks) {
    if (b.kind === "day") {
      const n = b.n ?? days.length + 1;
      const label = b.label?.trim() || `Day ${n}`;
      cur = { label: `Day ${n} — ${label}`, slots: { morning: [], afternoon: [], evening: [] } };
      days.push(cur);
    } else if (b.kind === "place") {
      ensure().slots[bucketFor(b.time)].push(b);
    } else if (b.kind === "flight") {
      ensure().slots.morning.push(b);
    }
  }
  return days;
}

export function PrintScheduleGrid({ trip, blocks }: { trip: TripView; blocks: Block[] }) {
  const days = bucketDays(blocks);
  if (!days.length) return null;

  return (
    <section
      aria-hidden
      data-print="only"
      className="td-print-grid"
      style={{
        display: "none",
        pageBreakBefore: "always",
        breakBefore: "page",
        padding: "24px 28px",
        color: "#111",
        background: "#fff",
        fontFamily: "var(--font-display), Georgia, serif",
      }}
    >
      <header style={{ borderBottom: "1px solid #111", paddingBottom: 12, marginBottom: 18 }}>
        <div style={{ fontSize: 10, letterSpacing: "0.35em", textTransform: "uppercase", color: "#666" }}>
          Schedule Grid
        </div>
        <h2 style={{ fontSize: 22, margin: "6px 0 0", fontWeight: 500 }}>
          {trip.destination || "Itinerary"}
        </h2>
      </header>
      {days.map((d, i) => (
        <div key={i} style={{ marginBottom: 22, breakInside: "avoid", pageBreakInside: "avoid" }}>
          <h3 style={{ fontSize: 13, letterSpacing: "0.2em", textTransform: "uppercase", margin: "0 0 8px" }}>
            {d.label}
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, border: "1px solid #ddd" }}>
            {(["morning", "afternoon", "evening"] as const).map((slot) => (
              <div key={slot} style={{ padding: 10, borderRight: slot !== "evening" ? "1px solid #eee" : undefined }}>
                <div style={{ fontSize: 9, letterSpacing: "0.35em", textTransform: "uppercase", color: "#888", marginBottom: 6 }}>
                  {slot}
                </div>
                {d.slots[slot].length === 0 ? (
                  <div style={{ fontSize: 11, color: "#bbb", fontStyle: "italic" }}>—</div>
                ) : (
                  d.slots[slot].map((b, j) => (
                    <div key={j} style={{ marginBottom: 8, fontSize: 11, lineHeight: 1.4 }}>
                      {b.kind === "place" ? (
                        <>
                          <div style={{ fontWeight: 600 }}>
                            {b.time ? <span style={{ color: "#666", marginRight: 6 }}>{b.time}</span> : null}
                            {b.name}
                          </div>
                          {b.address ? <div style={{ color: "#444" }}>{b.address}</div> : null}
                          {b.website ? (
                            <div>
                              <a href={b.website} style={{ color: "#0a4", textDecoration: "underline" }}>
                                {b.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                              </a>
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <div style={{ fontWeight: 600 }}>
                          {[b.airline, b.flightNumber].filter(Boolean).join(" ")} —{" "}
                          {[b.fromCity ?? b.from, b.toCity ?? b.to].filter(Boolean).join(" → ")}
                          {b.departTime ? <span style={{ color: "#666" }}> · {b.departTime}</span> : null}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}