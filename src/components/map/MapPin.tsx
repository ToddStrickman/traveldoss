/**
 * One Live Map pin: a category-coloured disc with the stop's glyph, an
 * order badge when a single day is in focus, and a gold mark when the
 * stop carries a reservation. A real <button> so it is reachable by
 * keyboard and announced with a useful name.
 */
import { alpha } from "@/lib/maps/color";
import { MARKER_LABEL, markerIconFor } from "@/lib/maps/taxonomy";
import type { MapPlace, MapVisit } from "@/lib/maps/build-map-places";

function PinGlyph(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false" {...props}>
      <path d="M12 22s7-7.2 7-12a7 7 0 1 0-14 0c0 4.8 7 12 7 12z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

export function visitLabel(v: MapVisit): string {
  const parts: string[] = [];
  if (v.day != null) parts.push(`Day ${v.day}`);
  if (v.order > 0) parts.push(`stop ${v.order}`);
  if (v.time) parts.push(v.time);
  return parts.join(", ");
}

export function MapPin({
  place,
  tokens,
  fill,
  showOrder,
  selected,
  onSelect,
  focusedDay = null,
}: {
  focusedDay?: number | null;
  place: MapPlace;
  tokens: { bg: string; ink: string };
  fill: string;
  /** Show the order badge (a single day is in focus). */
  showOrder: boolean;
  selected: boolean;
  onSelect: (key: string) => void;
}) {
  const Icon = markerIconFor(place.kind, place.rawCategory) ?? PinGlyph;
  const ghost = place.tier === "shadow";
  const size = place.isBase && place.kind === "stay" ? 32 : place.kind === "transit" ? 24 : 28;
  const first = place.visits.find((v) => v.day === focusedDay) ?? place.visits[0];
  const context = focusedDay != null && !place.visits.some((v) => v.day == null || v.day === focusedDay);
  const label = [
    `${MARKER_LABEL[place.kind]}: ${place.name}`,
    ghost ? "Plan B" : first ? visitLabel(first) : "",
    context ? "Rest of trip" : "",
    place.visits.length > 1 ? `${place.visits.length} visits` : "",
  ]
    .filter(Boolean)
    .join(". ");

  return (
    <button
      type="button"
      className="tds-mappin"
      data-kind={place.kind}
      data-context={context ? "true" : undefined}
      data-ghost={ghost ? "true" : undefined}
      data-selected={selected ? "true" : undefined}
      aria-label={label}
      aria-pressed={selected}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(place.key);
      }}
      style={
        {
          "--pin-size": `${size}px`,
          "--pin-fill": fill,
          "--pin-paper": tokens.bg,
          "--pin-ink": tokens.ink,
          "--pin-halo": alpha(fill, 0.28),
        } as React.CSSProperties
      }
    >
      <span className="tds-mappin-disc" aria-hidden>
        <Icon />
      </span>
      {showOrder && !context && !ghost && first && first.order > 0 ? (
        <span className="tds-mappin-order" aria-hidden>
          {first.order}
        </span>
      ) : null}
      {place.reservation ? <span className="tds-mappin-mark" aria-hidden /> : null}
    </button>
  );
}
