import type { CSSProperties } from "react";
import type { Block } from "../../types";
import { CategoryIcon, AirfareIcon, categoryLabel } from "../CategoryIcon";
import { EditableText, useEditing } from "../Editable";
import type { FlightBlock, ActivityBlock, PartOfDay } from "../itinerary";
import { PART_LABEL } from "../itinerary";

/** Compact flight row used at the top of every view. */
export function FlightStrip({
  outbound,
  inbound,
}: {
  outbound?: FlightBlock;
  inbound?: FlightBlock;
}) {
  if (!outbound && !inbound) return null;
  return (
    <div className="tds-flightstrip" data-block="flightstrip" data-print="hide-empty">
      {outbound ? <FlightRow flight={outbound} label="Outbound" /> : null}
      {inbound ? <FlightRow flight={inbound} label="Inbound" /> : null}
    </div>
  );
}

function FlightRow({ flight, label }: { flight: FlightBlock; label: string }) {
  const route = [flight.from, flight.to].filter(Boolean).join(" → ");
  const carrier = [flight.airline, flight.flightNumber].filter(Boolean).join(" ");
  return (
    <div className="tds-flightstrip-row">
      <span className="tds-flightstrip-icon" aria-hidden>
        <AirfareIcon />
      </span>
      <span className="tds-flightstrip-label">{label}</span>
      <span className="tds-flightstrip-route">{route || "—"}</span>
      <span className="tds-flightstrip-meta">
        {carrier ? <span>{carrier}</span> : null}
        {flight.date ? <span>{flight.date}</span> : null}
        {flight.departTime ? <span>{flight.departTime}</span> : null}
        {flight.arriveTime ? <span>→ {flight.arriveTime}</span> : null}
        {flight.confirmation ? <span>· {flight.confirmation}</span> : null}
      </span>
    </div>
  );
}

/** A single editable activity row for the vertical reading view. */
export function ActivityRow({
  activity,
  index,
}: {
  activity: ActivityBlock;
  index: number;
}) {
  const { onBlockChange } = useEditing();
  return (
    <div className="tds-act-row" data-block="activity">
      <div className="tds-act-time">{activity.time ?? ""}</div>
      <div className="tds-act-icon">
        <CategoryIcon category={activity.category} className="tds-cat-icon" />
      </div>
      <div className="tds-act-body">
        <div className="tds-act-title">
          <EditableText
            as="span"
            value={activity.name}
            placeholder="Activity"
            onChange={(v) => onBlockChange(index, { name: v } as Partial<Block>)}
          />
        </div>
        {activity.address || activity.note ? (
          <div className="tds-act-meta">
            {activity.address ? (
              <EditableText
                as="span"
                value={activity.address}
                placeholder="Address"
                onChange={(v) => onBlockChange(index, { address: v } as Partial<Block>)}
              />
            ) : null}
            {activity.note ? (
              <span className="tds-act-note">
                <EditableText
                  as="span"
                  multiline
                  value={activity.note}
                  placeholder="Note"
                  onChange={(v) => onBlockChange(index, { note: v } as Partial<Block>)}
                />
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Compact kanban-card variant of an activity for the horizontal board. */
export function ActivityCard({ activity, index }: { activity: ActivityBlock; index: number }) {
  const { onBlockChange } = useEditing();
  return (
    <div className="tds-act-card" data-block="activity-card">
      <div className="tds-act-card-head">
        <CategoryIcon category={activity.category} className="tds-cat-icon" />
        {activity.time ? <span className="tds-act-card-time">{activity.time}</span> : null}
        <span className="tds-act-card-cat">{categoryLabel(activity.category)}</span>
      </div>
      <div className="tds-act-card-title">
        <EditableText
          as="span"
          value={activity.name}
          placeholder="Activity"
          onChange={(v) => onBlockChange(index, { name: v } as Partial<Block>)}
        />
      </div>
      {activity.address ? (
        <div className="tds-act-card-meta">{activity.address}</div>
      ) : null}
      {activity.note ? <div className="tds-act-card-note">{activity.note}</div> : null}
    </div>
  );
}

/** Dense grid cell variant — exposes every field for operational reference. */
export function ActivityCell({ activity }: { activity: ActivityBlock }) {
  return (
    <div className="tds-act-cell">
      <div className="tds-act-cell-head">
        <CategoryIcon category={activity.category} className="tds-cat-icon" />
        <span className="tds-act-cell-cat">{categoryLabel(activity.category)}</span>
        {activity.time ? <span className="tds-act-cell-time">{activity.time}</span> : null}
      </div>
      <div className="tds-act-cell-name">{activity.name}</div>
      {activity.address ? <div className="tds-act-cell-line">{activity.address}</div> : null}
      {activity.phone ? (
        <div className="tds-act-cell-line">
          <a href={`tel:${activity.phone.replace(/[^+\d]/g, "")}`}>{activity.phone}</a>
        </div>
      ) : null}
      {activity.website ? (
        <div className="tds-act-cell-line">
          <a href={activity.website} target="_blank" rel="noreferrer">
            {activity.website.replace(/^https?:\/\//, "")}
          </a>
        </div>
      ) : null}
      {activity.hours ? <div className="tds-act-cell-line tds-act-cell-muted">{activity.hours}</div> : null}
      {activity.reservation ? (
        <div className="tds-act-cell-line tds-act-cell-muted">{activity.reservation}</div>
      ) : null}
      {activity.note ? <div className="tds-act-cell-note">{activity.note}</div> : null}
    </div>
  );
}

export function PartHeading({ part }: { part: PartOfDay }) {
  return (
    <div className="tds-part-head" data-part={part}>
      <span className="tds-part-rule" aria-hidden />
      <span className="tds-part-label">{PART_LABEL[part]}</span>
    </div>
  );
}

export const partOrder: PartOfDay[] = ["morning", "afternoon", "evening"];

export type Tokens = { bg: string; ink: string; accent: string; rule: string };

export function tokenVars(tokens: Tokens & { inkSoft?: string }): CSSProperties {
  return {
    // re-export so views can scope local pieces without redefining the full set
    ["--tds-bg" as string]: tokens.bg,
    ["--tds-ink" as string]: tokens.ink,
    ["--tds-accent" as string]: tokens.accent,
    ["--tds-rule" as string]: tokens.rule,
  } as CSSProperties;
}