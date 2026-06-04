import type { Itinerary } from "./itinerary";
import { ActivityCard } from "./views/parts";

/**
 * Shadow Itinerary — the Plan-B rail pinned at the bottom of every skin.
 * Lists shadow-tier blocks grouped by their associated day so users can
 * find backups without scrolling the primary plan. Renders nothing when
 * no shadow blocks exist (no empty section, no visual noise).
 */
export function ShadowItinerary({ itinerary }: { itinerary: Itinerary }) {
  if (!itinerary.hasShadows) return null;
  return (
    <section
      id="tds-shadow-itinerary"
      className="tds-shadow"
      aria-label="Shadow itinerary — backup plans"
      data-print="hide-empty"
    >
      <header className="tds-shadow-head">
        <span className="tds-shadow-eyebrow">Plan B</span>
        <h2 className="tds-shadow-title">Shadow itinerary</h2>
        <p className="tds-shadow-dek">
          Backup options for any day, ready to swap in.
        </p>
      </header>
      <div className="tds-shadow-grid">
        {itinerary.days
          .filter((d) => d.shadows.length > 0)
          .map((d) => (
            <div key={d.dayIndex} className="tds-shadow-day">
              <div className="tds-shadow-day-head">
                <span className="tds-shadow-day-no">
                  Day {String(d.day.n).padStart(2, "0")}
                </span>
                <span className="tds-shadow-day-label">{d.day.label}</span>
              </div>
              <div className="tds-shadow-cards">
                {d.shadows.map(({ activity, index }) => (
                  <ActivityCard key={index} activity={activity} index={index} />
                ))}
              </div>
            </div>
          ))}
      </div>
    </section>
  );
}

/** Inline cue rendered inside a primary day header when a Plan B exists. */
export function PlanBCue({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <a
      href="#tds-shadow-itinerary"
      className="tds-planb-cue"
      aria-label={`${count} backup option${count === 1 ? "" : "s"} for this day`}
    >
      Plan B available ↓
    </a>
  );
}