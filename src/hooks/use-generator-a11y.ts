import { useCallback, useEffect, useState } from "react";

/**
 * Itinerary-generator–scoped accessibility toggle. When enabled, callers
 * suppress non-essential motion (Motion springs, animated chips, etc.)
 * inside the generator UI only. The wallpaper gyroscope already honours
 * the global prefers-reduced-motion media query elsewhere, so this hook
 * is intentionally local — flipping it off does not affect the rest of
 * the app.
 */
const LS_KEY = "td.a11y.generator.v1";

function read(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(LS_KEY) === "1";
  } catch {
    return false;
  }
}

export function useGeneratorA11y() {
  const [reduced, setReduced] = useState<boolean>(() => read());

  // Re-read on mount so SSR-hydrated `false` is corrected on the client.
  useEffect(() => {
    setReduced(read());
  }, []);

  const setReducedMotion = useCallback((v: boolean) => {
    setReduced(v);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(LS_KEY, v ? "1" : "0");
    } catch {
      /* non-fatal */
    }
  }, []);

  return { reducedMotion: reduced, setReducedMotion };
}