/**
 * "Open in maps" links, on OpenStreetMap.
 *
 * The dossier used to hand these off to Google Maps; the whole mapping stack
 * is keyless OpenStreetMap now, so the outbound link matches what the pins
 * were built from. With coordinates we drop a marker straight on the spot;
 * without them we fall back to a text search.
 */
export function osmPlaceUrl(place: {
  name?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
}): string {
  if (place.lat != null && place.lng != null) {
    const lat = place.lat.toFixed(6);
    const lng = place.lng.toFixed(6);
    return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
  }
  const q = encodeURIComponent([place.name, place.address].filter(Boolean).join(", "));
  return `https://www.openstreetmap.org/search?query=${q}`;
}
