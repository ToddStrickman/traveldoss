import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Copy, Navigation, X } from "lucide-react";
import type { Block } from "@/lib/skins/types";
import { distanceKm, type MapModel, type MapPlace } from "@/lib/maps/build-map-places";
import { visitLabel } from "./MapPin";
import { buildItinerary } from "@/lib/skins/shared/itinerary";
import { useSlotSelectionApi } from "@/lib/skins/shared/views/parts";

export function directionsUrl(place: Pick<MapPlace, "name" | "lat" | "lng">, ios = false) {
  const destination = place.lat + "," + place.lng;
  return ios
    ? "https://maps.apple.com/?daddr=" + encodeURIComponent(destination)
    : "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(destination);
}
function safeWebsite(value?: string) {
  try {
    const u = new URL(value ?? "");
    return ["http:", "https:"].includes(u.protocol) ? u.href : undefined;
  } catch {
    return undefined;
  }
}
export function MapDetailPanel({
  selected,
  places,
  unlocated,
  blocks,
  focusedDay,
  listOpen,
  onSelect,
  onDismiss,
  onCloseMap,
}: {
  selected: MapPlace | null;
  places: MapPlace[];
  unlocated: MapModel["unlocated"];
  blocks: Block[];
  focusedDay: number | null;
  listOpen: boolean;
  onSelect: (key: string | null) => void;
  onDismiss: () => void;
  onCloseMap: () => void;
}) {
  const [query, setQuery] = useState("");
  const slotSelection = useSlotSelectionApi();
  const [copyNote, setCopyNote] = useState("");
  useEffect(() => {
    setCopyNote("");
  }, [selected?.key]);
  const visit = selected?.visits.find((v) => v.day === focusedDay) ?? selected?.visits[0];
  const routeDay = focusedDay ?? visit?.day;
  const route = useMemo(
    () =>
      places
        .filter(
          (p) => p.tier === "primary" && p.visits.some((v) => v.day === routeDay && v.order > 0),
        )
        .sort(
          (a, b) =>
            (a.visits.find((v) => v.day === routeDay)?.order ?? 0) -
            (b.visits.find((v) => v.day === routeDay)?.order ?? 0),
        ),
    [places, routeDay],
  );
  const index = route.findIndex((p) => p.key === selected?.key);
  const ios =
    typeof navigator !== "undefined" &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
  const website = safeWebsite(selected?.website);
  const matching = places.filter((p) =>
    (p.name + " " + (p.address ?? "")).toLowerCase().includes(query.toLowerCase()),
  );
  const focused = matching.filter(
    (p) => focusedDay == null || p.visits.some((v) => v.day === focusedDay || v.day == null),
  );
  const rest = matching.filter((p) => !focused.includes(p));
  const jump = () => {
    if (!visit) return;
    const day = buildItinerary(blocks).days.find((d) => d.day.n === visit.day);
    if (day) {
      for (const part of ["morning", "afternoon", "evening"] as const) {
        const index = day[part].findIndex((entry) => entry.index === visit.blockIndex);
        if (index >= 0) slotSelection?.setPick(day.dayIndex + ":" + part, index);
      }
    }
    onCloseMap();
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        // Expand the target day/part using the existing dossier controls.
        if (visit.day != null) {
          const dayButton = document.querySelector<HTMLButtonElement>(
            'button[aria-label="Expand Day ' + visit.day + '"]',
          );
          dayButton?.click();
          for (const part of ["Morning", "Afternoon", "Evening"])
            document
              .querySelector<HTMLButtonElement>(
                'button[aria-label="Expand ' + part + " on Day " + visit.day + '"]',
              )
              ?.click();
        }
        const target = document.querySelector<HTMLElement>(
          '.tds [data-block-index="' + visit.blockIndex + '"]',
        );
        if (!target) return;
        for (let p = target.parentElement; p; p = p.parentElement) {
          if (p instanceof HTMLDetailsElement) p.open = true;
        }
        target.scrollIntoView({
          block: "center",
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
        });
        target.setAttribute("tabindex", "-1");
        target.focus({ preventScroll: true });
      }),
    );
  };
  const rows = (items: MapPlace[]) =>
    items.map((p) => {
      const v = p.visits.find((v) => v.day === focusedDay) ?? p.visits[0];
      return (
        <button
          key={p.key}
          type="button"
          className="tds-map-place-row"
          onClick={() => onSelect(p.key)}
        >
          <span className="tds-map-row-order">{v?.order || "·"}</span>
          <span>
            <strong>{p.name}</strong>
            <small>
              {p.tier === "shadow" ? "Plan B · " : ""}
              {v ? visitLabel(v) : "Trip essentials"}
            </small>
          </span>
          <ArrowRight size={14} aria-hidden />
        </button>
      );
    });
  const neighbor = (p: MapPlace | undefined, label: string) =>
    p && selected ? (
      <button type="button" className="tds-map-place-row" onClick={() => onSelect(p.key)}>
        {label === "Previous" ? (
          <ArrowLeft size={14} aria-hidden />
        ) : (
          <ArrowRight size={14} aria-hidden />
        )}
        <span>
          <small>{label}</small>
          <strong>{p.name}</strong>
          <small>
            {distanceKm([selected.lng, selected.lat], [p.lng, p.lat]).toFixed(1)} km straight-line
          </small>
        </span>
      </button>
    ) : null;
  return (
    <aside
      aria-label={selected ? "Place details" : "Trip places"}
      className="tds-map-detail"
      data-open={!!selected || listOpen ? "true" : undefined}
    >
      <div className="tds-map-detail-top">
        <span>{selected ? "Your next discovery" : "Your places"}</span>
        <button
          type="button"
          className="tds-map-iconbtn"
          aria-label={selected ? "Close place details" : "Close places"}
          onClick={onDismiss}
        >
          <X size={16} />
        </button>
      </div>
      {selected ? (
        <div className="tds-map-detail-body" key={selected.key}>
          <p className="tds-map-caption-eyebrow">
            {visit ? visitLabel(visit) || "Trip essentials" : "Trip essentials"}
            {selected.tier === "shadow" ? " · Plan B" : ""}
          </p>
          <h2>{selected.name}</h2>
          <a
            className="tds-map-direction"
            href={directionsUrl(selected, ios)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Navigation size={16} aria-hidden /> Directions
          </a>
          {selected.imageUrl ? (
            <img
              className="tds-map-detail-photo"
              src={selected.imageUrl}
              alt={selected.name}
              loading="lazy"
            />
          ) : null}
          {selected.note ? <p className="tds-map-detail-note">{selected.note}</p> : null}
          {selected.reservation ? (
            <p>
              <strong>Reservation</strong>
              <br />
              {selected.reservation}
            </p>
          ) : null}
          {selected.address ? (
            <div>
              <p>{selected.address}</p>
              <button
                className="tds-map-chip"
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(selected.address!);
                    setCopyNote("Address copied");
                  } catch {
                    setCopyNote("Select and copy the address above");
                  }
                }}
              >
                <Copy size={13} /> Copy address
              </button>
              <span role="status" className="tds-map-copy-note">
                {copyNote}
              </span>
            </div>
          ) : null}
          {selected.hours ? (
            <p>
              <strong>Hours</strong>
              <br />
              {selected.hours}
            </p>
          ) : null}
          {selected.phone ? (
            <p>
              <a href={"tel:" + selected.phone.replace(/[^\d+]/g, "")}>{selected.phone}</a>
            </p>
          ) : null}
          {website ? (
            <p>
              <a href={website} target="_blank" rel="noopener noreferrer">
                {selected.websiteTitle || "Visit website"}
              </a>
            </p>
          ) : null}
          {selected.visits.length > 1 ? <p>{selected.visits.map(visitLabel).join(" · ")}</p> : null}
          <button className="tds-map-chip" type="button" onClick={jump}>
            Open in dossier
          </button>
          <div className="tds-map-neighbors">
            {index >= 0 ? neighbor(route[index - 1], "Previous") : null}
            {index >= 0 ? neighbor(route[index + 1], "Next") : null}
          </div>
        </div>
      ) : (
        <div className="tds-map-detail-body">
          <label className="tds-map-search-label">
            Find a place
            <input
              aria-label="Find a place"
              placeholder="Name or address"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <h2>{focusedDay == null ? "The whole journey" : "Day " + focusedDay}</h2>
          {rows(focused)}
          {rest.length ? (
            <>
              <h3>Rest of trip</h3>
              {rows(rest)}
            </>
          ) : null}
          {!matching.length && !unlocated.length ? <p>No places match your search.</p> : null}
          {unlocated.length ? (
            <section>
              <h3>Still to locate · {unlocated.length}</h3>
              <p className="tds-map-muted">
                These stops are saved. A precise venue or street address helps place them on the
                map.
              </p>
              {unlocated
                .filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
                .map((p) => {
                  const b = blocks[p.blockIndex];
                  const address = b?.kind === "place" ? b.address : undefined;
                  return (
                    <div className="tds-map-unlocated" key={p.blockIndex}>
                      <strong>{p.name}</strong>
                      {address ? <small>{address}</small> : null}
                      <a
                        href={
                          "https://www.google.com/maps/search/?api=1&query=" +
                          encodeURIComponent([p.name, address].filter(Boolean).join(", "))
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Search in Maps ↗
                      </a>
                    </div>
                  );
                })}
            </section>
          ) : null}
        </div>
      )}
    </aside>
  );
}
