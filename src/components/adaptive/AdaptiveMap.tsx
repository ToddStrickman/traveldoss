import { lazy, Suspense, useState } from "react";
import { buildMapModel } from "@/lib/maps/build-map-places";
import { pinPalette } from "@/lib/maps/taxonomy";
import { FALLBACK_SKIN } from "@/lib/skins/registry";
import type { Block } from "@/lib/skins/types";
import type { TravelDossier } from "@/lib/adaptive/types";
import { activeItems } from "@/lib/adaptive/live";
const Canvas = lazy(() =>
  import("@/components/map/MapCanvas").then((m) => ({ default: m.MapCanvas })),
);
export function AdaptiveMap({ state, tripId }: { state: TravelDossier; tripId: string }) {
  const [selected, setSelected] = useState<string | null>(null),
    [status, setStatus] = useState("loading");
  const trip = state.trips.find((t) => t.id === tripId)!;
  const items = activeItems(state, tripId);
  const blocks: Block[] = items.map((item) => ({
    kind: "place",
    name: item.reservation.title,
    address: item.reservation.address,
    lat: item.reservation.lat,
    lng: item.reservation.lng,
    category:
      item.reservation.type === "lodging"
        ? "accommodation"
        : item.reservation.type === "dining"
          ? "restaurant"
          : item.reservation.outdoor
            ? "walk"
            : "other",
    note: item.reservation.startAt,
    geocode:
      item.reservation.lat != null
        ? { status: "manual", attempts: 0, provider: "manual" }
        : undefined,
  }));
  const model = buildMapModel({ destination: trip.destination, slug: trip.slug }, blocks);
  const tokens = FALLBACK_SKIN.tokens;
  return (
    <section className="ad-card">
      <h2>Places in your active plan</h2>
      <p className="ad-muted">
        Cancelled reservations are excluded. {model.places.length} mapped · {model.unlocated.length}{" "}
        without coordinates.
      </p>
      {model.places.length > 0 && status !== "error" && (
        <div className="ad-map">
          <Suspense fallback={<p>Loading map…</p>}>
            <Canvas
              model={model}
              visible={model.places}
              tokens={tokens}
              palette={pinPalette(tokens)}
              hiddenDays={new Set()}
              showRoute={false}
              showOrder
              selectedKey={selected}
              onSelect={setSelected}
              onStatus={setStatus}
            />
          </Suspense>
        </div>
      )}
      {status === "error" && (
        <p role="status">
          The map is unavailable. Your places and directions remain available below.
        </p>
      )}
      <ul className="ad-place-list">
        {items
          .filter((i) => i.reservation.location || i.reservation.address)
          .map((i) => (
            <li key={i.id}>
              <strong>{i.reservation.title}</strong>
              <span>{i.reservation.address ?? i.reservation.location}</span>
              <a
                target="_blank"
                rel="noreferrer"
                href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(i.reservation.address ?? i.reservation.location ?? "")}`}
              >
                View on map ↗
              </a>
            </li>
          ))}
      </ul>
    </section>
  );
}
