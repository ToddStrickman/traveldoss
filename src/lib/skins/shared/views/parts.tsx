import {
  Children,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Block } from "../../types";
import { CategoryIcon, AirfareIcon, categoryLabel } from "../CategoryIcon";
import { EditableText, useEditing } from "../Editable";
import { PlaceSheet, usePointerCoarse } from "@/components/mobile/PlaceSheet";
import type { FlightBlock, ActivityBlock, PartOfDay } from "../itinerary";
import { extractUrls, prettyDomain } from "@/lib/links";

/**
 * Inert-render mode: set when a skin renders inside an interactive wrapper
 * (gallery tiles, the landing rail's <Link> thumbnails). Anything that would
 * emit an <a> renders the same titled text as a plain span instead, so
 * thumbnails stay valid HTML (no <a>-in-<a>) and purely decorative.
 */
const InertRenderContext = createContext(false);
export function InertRender({ children }: { children: ReactNode }) {
  return <InertRenderContext.Provider value={true}>{children}</InertRenderContext.Provider>;
}
export const useInertRender = () => useContext(InertRenderContext);

/**
 * Renders free text with any raw URL replaced by a titled hyperlink:
 * stored resolved title → prettified domain. Travelers never see bare URLs.
 */
export function LinkifiedText({
  text,
  linkTitles,
}: {
  text: string;
  linkTitles?: Record<string, string>;
}) {
  const inert = useInertRender();
  const urls = extractUrls(text);
  if (urls.length === 0) return <>{text}</>;
  const parts: ReactNode[] = [];
  let rest = text;
  urls.forEach((url, i) => {
    const at = rest.indexOf(url);
    if (at === -1) return;
    if (at > 0) parts.push(rest.slice(0, at));
    const label = linkTitles?.[url] ?? prettyDomain(url);
    parts.push(
      inert ? (
        <span key={`${url}-${i}`}>{label}</span>
      ) : (
        <a key={`${url}-${i}`} href={url} target="_blank" rel="noreferrer">
          {label}
        </a>
      ),
    );
    rest = rest.slice(at + url.length);
  });
  if (rest) parts.push(rest);
  return <>{parts}</>;
}
import { PART_LABEL } from "../itinerary";

/* ============================================================
 * Standardized activity details renderer.
 *
 * Renders all available structured fields on a place block as
 * icon-labeled key/value chips. Used by every layout (vertical
 * row, horizontal card, grid cell) so a Restaurant looks like
 * a Restaurant in every template, and an Event always shows its
 * seat / ticket info the same way.
 * ============================================================ */

function GlyphPhone() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2.2 2A16 16 0 0 1 3 6.2 2 2 0 0 1 5 4z" />
    </svg>
  );
}
function GlyphPin() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 22s7-7.2 7-12a7 7 0 1 0-14 0c0 4.8 7 12 7 12z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}
function GlyphGlobe() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c3 3 3 15 0 18-3-3-3-15 0-18z" />
    </svg>
  );
}
function GlyphClock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
function GlyphTicket() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8z" />
      <path d="M13 6v12" strokeDasharray="1 2" />
    </svg>
  );
}
function GlyphHash() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 9h14M5 15h14M10 4 8 20M16 4l-2 16" />
    </svg>
  );
}
function GlyphSeat() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 10V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6" />
      <path d="M6 12h12a2 2 0 0 1 2 2v3H4v-3a2 2 0 0 1 2-2z" />
      <path d="M7 17v3M17 17v3" />
    </svg>
  );
}
function GlyphRoute() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="6" cy="6" r="2" />
      <circle cx="18" cy="18" r="2" />
      <path d="M8 6h7a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h7" />
    </svg>
  );
}
function GlyphRuler() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m3 17 14-14 4 4L7 21z" />
      <path d="m7 9 2 2M10 6l2 2M13 12l2 2M16 9l2 2" />
    </svg>
  );
}
function GlyphBolt() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m13 2-9 13h7l-1 7 9-13h-7l1-7z" />
    </svg>
  );
}
function GlyphSparkle() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />
    </svg>
  );
}
function GlyphShield() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3z" />
    </svg>
  );
}
function GlyphTag() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 12V4h8l10 10-8 8L3 12z" />
      <circle cx="7.5" cy="7.5" r="1.25" />
    </svg>
  );
}

type DetailRow = {
  key: string;
  label: string;
  value: string;
  glyph: ReactNode;
  href?: string;
};

function buildDetailRows(a: ActivityBlock): DetailRow[] {
  const rows: DetailRow[] = [];
  const push = (k: string, label: string, value: string | undefined, glyph: ReactNode, href?: string) => {
    if (!value) return;
    rows.push({ key: k, label, value, glyph, href });
  };

  // Universal contact / location
  push("address", "Address", a.address, <GlyphPin />, a.mapsUrl);
  push("phone", "Phone", a.phone, <GlyphPhone />, a.phone ? `tel:${a.phone.replace(/[^+\d]/g, "")}` : undefined);
  // Links never display as raw URLs: resolved title → place name → domain.
  push(
    "website",
    "Website",
    a.website ? a.websiteTitle ?? a.name ?? prettyDomain(a.website) : undefined,
    <GlyphGlobe />,
    a.website,
  );
  push("hours", "Hours", a.hours, <GlyphClock />);
  push("reservation", "Reference", a.reservation, <GlyphHash />);

  // Transit
  push("vendor", "Vendor", a.vendor, <GlyphTag />);
  push("pickup", "Pickup", a.pickup, <GlyphPin />);
  push("dropoff", "Drop-off", a.dropoff, <GlyphPin />);

  // Restaurant
  push("dressCode", "Dress code", a.dressCode, <GlyphTag />);
  push("mustOrder", "Must-order", a.mustOrder, <GlyphSparkle />);

  // Walk / hike
  push("trailhead", "Trailhead", a.trailhead, <GlyphRoute />, a.mapsUrl);
  push("distance", "Distance", a.distance, <GlyphRuler />);
  push("duration", "Duration", a.duration, <GlyphClock />);
  push("difficulty", "Difficulty", a.difficulty, <GlyphBolt />);
  push("waypoints", "Waypoints", a.waypoints, <GlyphRoute />);
  push("prep", "Prep", a.prep, <GlyphShield />);

  // Event
  push("venue", "Venue", a.venue, <GlyphPin />);
  push("doorOpen", "Doors", a.doorOpen, <GlyphClock />);
  push(
    "ticketLink",
    "Ticket",
    a.ticketLink ? a.ticketLinkTitle ?? prettyDomain(a.ticketLink) : undefined,
    <GlyphTicket />,
    a.ticketLink,
  );
  push("seat", "Seat", a.seat, <GlyphSeat />);
  push("venueRules", "Rules", a.venueRules, <GlyphShield />);

  // Accommodation
  push("checkIn", "Check-in", a.checkIn, <GlyphClock />);
  push("checkOut", "Check-out", a.checkOut, <GlyphClock />);
  push("amenities", "Amenities", a.amenities, <GlyphSparkle />);

  // Culture
  push("ticketRequirement", "Tickets", a.ticketRequirement, <GlyphTicket />);
  push("tourDetails", "Tour", a.tourDetails, <GlyphRoute />);

  return rows;
}

/**
 * Compact chip list — used inside the kanban card + vertical row to surface
 * the top few standardized fields without dominating the layout.
 */
export function ActivityChips({ activity, max = 3 }: { activity: ActivityBlock; max?: number }) {
  const rows = buildDetailRows(activity).slice(0, max);
  if (rows.length === 0) return null;
  return (
    <ul className="tds-act-chips" aria-label="Details">
      {rows.map((r) => (
        <li key={r.key} className="tds-act-chip" title={`${r.label}: ${r.value}`}>
          <span className="tds-act-chip-glyph" aria-hidden>{r.glyph}</span>
          <span className="tds-act-chip-value">{r.value}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Full structured details list — used in the grid cell. Shows every available
 * field as an icon-labeled key/value pair with phone / link / map affordances.
 */
export function ActivityDetails({ activity }: { activity: ActivityBlock }) {
  const inert = useInertRender();
  const rows = buildDetailRows(activity);
  if (rows.length === 0) return null;
  return (
    <dl className="tds-act-details" aria-label="Details">
      {rows.map((r) => (
        <div key={r.key} className="tds-act-detail">
          <dt>
            <span className="tds-act-detail-glyph" aria-hidden>{r.glyph}</span>
            <span className="tds-act-detail-label">{r.label}</span>
          </dt>
          <dd>
            {r.href && !inert ? (
              <a href={r.href} target={r.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
                {r.value}
              </a>
            ) : (
              r.value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

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
      {outbound ? <FlightRow flight={outbound} label="Departure" /> : null}
      {inbound ? <FlightRow flight={inbound} label="Return" /> : null}
    </div>
  );
}

function FlightRow({ flight, label }: { flight: FlightBlock; label: string }) {
  const route = [flight.from, flight.to].filter(Boolean).join(" → ");
  const carrier = [flight.airline, flight.flightNumber].filter(Boolean).join(" ");
  const fields: Array<{ label: string; value: string }> = [];
  if (carrier) fields.push({ label: "Carrier", value: carrier });
  if (flight.date) fields.push({ label: "Date", value: flight.date });
  if (flight.departTime) fields.push({ label: "Depart", value: flight.departTime });
  if (flight.arriveTime) fields.push({ label: "Arrive", value: flight.arriveTime });
  if (flight.seat) fields.push({ label: "Seat", value: flight.seat });
  if (flight.confirmation) fields.push({ label: "Conf.", value: flight.confirmation });

  return (
    <div className="tds-flightstrip-row">
      <div className="tds-flightstrip-leg">
        <span className="tds-flightstrip-icon" aria-hidden>
          <AirfareIcon />
        </span>
        <span className="tds-flightstrip-label">{label}</span>
      </div>
      <div className="tds-flightstrip-route" aria-label={`Route ${route || "unknown"}`}>
        {route || "—"}
      </div>
      <dl className="tds-flightstrip-fields">
        {fields.map((f) => (
          <div key={f.label} className="tds-flightstrip-field">
            <dt>{f.label}</dt>
            <dd>{f.value}</dd>
          </div>
        ))}
      </dl>
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
  const { onBlockChange, editing } = useEditing();
  // Read mode on touch: the row is a tap target opening the acting sheet
  // (call / map / website / copy). Editing keeps inline text behavior.
  const coarse = usePointerCoarse();
  const [sheetOpen, setSheetOpen] = useState(false);
  const tappable =
    coarse && !editing &&
    !!(activity.address || activity.phone || activity.website || activity.note || activity.hours);
  return (
    <div
      className="tds-act-row"
      data-block="activity"
      data-block-index={index}
      data-tappable={tappable || undefined}
      onClick={tappable ? () => setSheetOpen(true) : undefined}
      onKeyDown={tappable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSheetOpen(true); } } : undefined}
      role={tappable ? "button" : undefined}
      tabIndex={tappable ? 0 : undefined}
    >
      {tappable ? (
        <PlaceSheet activity={activity} open={sheetOpen} onOpenChange={setSheetOpen} />
      ) : null}
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
        <ActivityChips activity={activity} max={3} />
        {activity.note ? (
          <div className="tds-act-meta tds-act-note">
            {editing ? (
              <EditableText
                as="span"
                multiline
                value={activity.note}
                placeholder="Note"
                onChange={(v) => onBlockChange(index, { note: v } as Partial<Block>)}
              />
            ) : (
              <LinkifiedText text={activity.note} linkTitles={activity.linkTitles} />
            )}
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
    <div className="tds-act-card" data-block="activity-card" data-block-index={index}>
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
      <ActivityChips activity={activity} max={2} />
      {activity.note ? (
        <div className="tds-act-card-note">
          <LinkifiedText text={activity.note} linkTitles={activity.linkTitles} />
        </div>
      ) : null}
    </div>
  );
}

/** Dense grid cell variant — exposes every field for operational reference. */
export function ActivityCell({ activity, index }: { activity: ActivityBlock; index?: number }) {
  return (
    <div className="tds-act-cell" data-block-index={index}>
      <div className="tds-act-cell-head">
        <CategoryIcon category={activity.category} className="tds-cat-icon" />
        <span className="tds-act-cell-cat">{categoryLabel(activity.category)}</span>
        {activity.time ? <span className="tds-act-cell-time">{activity.time}</span> : null}
      </div>
      <div className="tds-act-cell-name">{activity.name}</div>
      <ActivityDetails activity={activity} />
      {activity.note ? (
        <div className="tds-act-cell-note">
          <LinkifiedText text={activity.note} linkTitles={activity.linkTitles} />
        </div>
      ) : null}
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

/**
 * Format the date shown next to a day header. Returns the user-supplied
 * value when set, otherwise a stable placeholder so missing dates aren't
 * invisible — users need to know to fill them in.
 */
export function dayDateLabel(date?: string): string {
  return date && date.trim() ? date.trim() : "TBD (MM/DD/YY)";
}

/**
 * Horizontal scroll-snap carousel of activity options inside a single
 * part-of-day slot. When a slot has more than one block (e.g. an
 * experience + a planned aperitivo + a farewell dinner the user might
 * pick between), the cards live in a swipeable row instead of stacked.
 * The first child is treated as the primary suggestion visually; users
 * can scroll/swipe to compare alternatives. Drag-and-drop on each child
 * still works (the items are still positioned in document order).
 */
/* ------------------------------------------------------------------
 * Slot selection context — remembers the chosen alternative for every
 * slot (e.g. "2:morning") so the user can flip through other days and
 * come back to the same picks. Also stores a per-slot side-by-side
 * compare toggle. Backed by sessionStorage so the picks survive
 * navigation within the tab. Mounted by <SkinFrame>.
 * ------------------------------------------------------------------ */

type SlotSelectionState = {
  picks: Record<string, number>;
  compare: Record<string, boolean>;
};
type SlotSelectionApi = SlotSelectionState & {
  setPick: (slotKey: string, index: number) => void;
  toggleCompare: (slotKey: string) => void;
};

const STORAGE_KEY = "tds:slot-selection:v1";

const SlotSelectionContext = createContext<SlotSelectionApi | null>(null);

export function SlotSelectionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SlotSelectionState>(() => {
    if (typeof window === "undefined") return { picks: {}, compare: {} };
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return { picks: {}, compare: {} };
      const parsed = JSON.parse(raw) as Partial<SlotSelectionState>;
      return {
        picks: parsed.picks ?? {},
        compare: parsed.compare ?? {},
      };
    } catch {
      return { picks: {}, compare: {} };
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore quota errors */
    }
  }, [state]);

  const api = useMemo<SlotSelectionApi>(
    () => ({
      ...state,
      setPick: (slotKey, index) =>
        setState((prev) => ({ ...prev, picks: { ...prev.picks, [slotKey]: index } })),
      toggleCompare: (slotKey) =>
        setState((prev) => ({
          ...prev,
          compare: { ...prev.compare, [slotKey]: !prev.compare[slotKey] },
        })),
    }),
    [state],
  );

  return <SlotSelectionContext.Provider value={api}>{children}</SlotSelectionContext.Provider>;
}

function useSlotSelection(slotKey: string | undefined, total: number) {
  const ctx = useContext(SlotSelectionContext);
  const [fallback, setFallback] = useState(0);
  const [fallbackCompare, setFallbackCompare] = useState(false);
  if (!ctx || !slotKey) {
    return {
      index: Math.min(fallback, Math.max(0, total - 1)),
      compare: fallbackCompare,
      setIndex: setFallback,
      toggleCompare: () => setFallbackCompare((v) => !v),
    };
  }
  const raw = ctx.picks[slotKey] ?? 0;
  const index = total > 0 ? ((raw % total) + total) % total : 0;
  return {
    index,
    compare: !!ctx.compare[slotKey],
    setIndex: (i: number) => ctx.setPick(slotKey, i),
    toggleCompare: () => ctx.toggleCompare(slotKey),
  };
}

/**
 * Click-to-compare carousel of alternative options for a single slot.
 *
 * - Keyboard: ← / → cycle, Home / End jump to ends, Enter / Space confirm
 *   the currently focused dot.
 * - Persistence: selection is stored by `slotKey` so picks survive while
 *   the user reviews other days.
 * - Side-by-side: a small toggle renders the active option next to the
 *   following one so two alternatives can be compared at once.
 * - Diff cue: any non-primary option is tagged "Alt of Option 1" to make
 *   optionality obvious at a glance.
 */
export function SlotAlternativesCarousel({
  count,
  children,
  slotKey,
}: {
  count: number;
  children: React.ReactNode;
  slotKey?: string;
}) {
  const items = Children.toArray(children);
  const total = items.length || count;
  const { index, compare, setIndex, toggleCompare } = useSlotSelection(slotKey, total);
  const safeIndex = total > 0 ? ((index % total) + total) % total : 0;
  const rootRef = useRef<HTMLDivElement | null>(null);

  const go = useCallback(
    (delta: number) => setIndex(((safeIndex + delta) % total + total) % total),
    [setIndex, safeIndex, total],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (total <= 1) return;
    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        go(-1);
        break;
      case "ArrowRight":
      case "Enter":
        e.preventDefault();
        go(1);
        break;
      case "Home":
        e.preventDefault();
        setIndex(0);
        break;
      case "End":
        e.preventDefault();
        setIndex(total - 1);
        break;
      default:
        break;
    }
  };

  const compareIndex = total > 1 ? (safeIndex + 1) % total : safeIndex;

  return (
    <div
      ref={rootRef}
      className="tds-slot-carousel"
      data-count={total}
      data-compare={compare && total > 1 ? "true" : undefined}
      role="group"
      aria-label={`${total} alternative${total === 1 ? "" : "s"}`}
      tabIndex={total > 1 ? 0 : -1}
      onKeyDown={onKeyDown}
    >
      {total > 1 ? (
        <div className="tds-slot-carousel-meta">
          <span className="tds-slot-carousel-pill">
            Option {safeIndex + 1} of {total}
            {safeIndex > 0 ? <span className="tds-slot-carousel-diff"> · alt of Option 1</span> : null}
          </span>
          <div className="tds-slot-carousel-nav" aria-hidden={false}>
            <button
              type="button"
              className="tds-slot-carousel-btn"
              onClick={() => go(-1)}
              aria-label="Previous alternative"
            >
              ‹
            </button>
            <div className="tds-slot-carousel-dots" role="tablist">
              {items.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  role="tab"
                  aria-selected={i === safeIndex}
                  aria-label={`Show alternative ${i + 1}`}
                  className={`tds-slot-carousel-dot${i === safeIndex ? " is-active" : ""}`}
                  onClick={() => setIndex(i)}
                />
              ))}
            </div>
            <button
              type="button"
              className="tds-slot-carousel-btn"
              onClick={() => go(1)}
              aria-label="Next alternative"
            >
              ›
            </button>
            <button
              type="button"
              className={`tds-slot-carousel-compare${compare ? " is-active" : ""}`}
              onClick={toggleCompare}
              aria-pressed={compare}
              title="Show two alternatives side-by-side"
            >
              {compare ? "Exit compare" : "Compare side-by-side"}
            </button>
            <span className="tds-slot-carousel-hint">← → keys · Enter to cycle</span>
          </div>
        </div>
      ) : null}
      {compare && total > 1 ? (
        <div className="tds-slot-carousel-split" role="presentation">
          <div className="tds-slot-carousel-pane" data-pane="a" aria-label={`Option ${safeIndex + 1}`}>
            <div className="tds-slot-carousel-pane-tag">Option {safeIndex + 1}</div>
            {items[safeIndex]}
          </div>
          <div className="tds-slot-carousel-pane" data-pane="b" aria-label={`Option ${compareIndex + 1}`}>
            <div className="tds-slot-carousel-pane-tag">Option {compareIndex + 1}</div>
            {items[compareIndex]}
          </div>
        </div>
      ) : (
        <div className="tds-slot-carousel-stage">
          {total > 0 ? items[safeIndex] : children}
        </div>
      )}
    </div>
  );
}