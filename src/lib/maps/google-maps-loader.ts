/**
 * Lazy Google Maps JS loader (browser only).
 *
 * Uses the Lovable Google Maps connector's browser key and the official
 * inline bootstrap, so the Maps SDK is fetched ONLY when a traveler actually
 * opens the Live Map — casual dossier views cost zero map loads. Loading is
 * a memoized singleton; repeat opens reuse the same SDK instance.
 */

declare global {
  interface Window {
    google?: typeof google;
  }
  // Minimal surface of the Maps JS API we consume — enough for type safety
  // without pulling @types/google.maps into the build.
  namespace google.maps {
    class LatLngBounds {
      extend(point: { lat: number; lng: number }): void;
    }
    class Map {
      constructor(el: HTMLElement, opts?: Record<string, unknown>);
      fitBounds(bounds: LatLngBounds, padding?: number): void;
      setCenter(point: { lat: number; lng: number }): void;
      setZoom(zoom: number): void;
    }
    class Marker {
      constructor(opts?: Record<string, unknown>);
      setMap(map: Map | null): void;
      addListener(event: string, handler: () => void): void;
    }
    class Polyline {
      constructor(opts?: Record<string, unknown>);
      setMap(map: Map | null): void;
    }
    class InfoWindow {
      constructor(opts?: Record<string, unknown>);
      open(opts: { map: Map; anchor: Marker }): void;
      close(): void;
    }
    const SymbolPath: { CIRCLE: number };
    function importLibrary(name: string): Promise<unknown>;
  }
}

let sdk: Promise<typeof google.maps> | null = null;

export function loadGoogleMaps(): Promise<typeof google.maps> {
  if (sdk) return sdk;
  const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as
    | string
    | undefined;
  if (!key) {
    return Promise.reject(
      new Error("Google Maps connector key is not configured for this environment."),
    );
  }
  sdk = new Promise<typeof google.maps>((resolve, reject) => {
    // Official dynamic-import bootstrap, minified upstream — registers
    // google.maps.importLibrary and defers the heavy payload until requested.
    try {
      /* eslint-disable */
      ((g: Record<string, unknown>) => {
        var h: any, a: any, k: any, p = "The Google Maps JavaScript API", c = "google", l = "importLibrary", q = "__ib__", m = document, b: any = window;
        b = b[c] || (b[c] = {});
        var d = b.maps || (b.maps = {}), r = new Set(), e = new URLSearchParams(), u = () =>
          h || (h = new Promise(async (f, n) => {
            a = m.createElement("script");
            e.set("libraries", [...r] + "");
            for (k in g) e.set(k.replace(/[A-Z]/g, (t: string) => "_" + t[0].toLowerCase()), (g as any)[k]);
            e.set("callback", c + ".maps." + q);
            a.src = `https://maps.${c}apis.com/maps/api/js?` + e;
            (d as any)[q] = f;
            a.onerror = () => (h = n(Error(p + " could not load.")));
            a.nonce = (m.querySelector("script[nonce]") as any)?.nonce || "";
            m.head.append(a);
          }));
        (d as any)[l]
          ? console.warn(p + " only loads once. Ignoring:", g)
          : ((d as any)[l] = (f: string, ...n: unknown[]) => r.add(f) && u().then(() => (d as any)[l](f, ...n)));
      })({ key, v: "weekly" });
      /* eslint-enable */
      Promise.all([
        google.maps.importLibrary("maps"),
        google.maps.importLibrary("marker"),
      ])
        .then(() => resolve(window.google!.maps))
        .catch(reject);
    } catch (err) {
      reject(err);
    }
  });
  return sdk;
}
