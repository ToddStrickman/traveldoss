// ============= Cake-themed import progress =============

/**
 * Playful assembly indicator shown while an import is running: the dossier
 * "bakes" — cake layers rise in as the percentage climbs, the candle appears
 * near the end, and its flame lights at 100%. The assembly is pure CSS
 * (keyframes in src/styles.css), the stage height is reserved so nothing
 * shifts, and every animation is disabled under prefers-reduced-motion.
 */

/** How many cake layers the assembly has (bottom sponge → frosted top). */
export const CAKE_LAYERS = 4;

/** Pure threshold model so tests can pin the assembly order. */
export function cakeLayersShown(pct: number): number {
  if (!Number.isFinite(pct) || pct <= 0) return 0;
  // Layers share the first 80% of the journey evenly.
  return Math.min(CAKE_LAYERS, Math.floor((Math.min(pct, 100) / 80) * CAKE_LAYERS));
}

export function cakeCandleLit(pct: number): boolean {
  return Number.isFinite(pct) && pct >= 90;
}

export function cakeFlameLit(pct: number): boolean {
  return Number.isFinite(pct) && pct >= 100;
}

export function CakeProgress({
  pct,
  label = "Baking your dossier…",
}: {
  pct: number;
  label?: string;
}) {
  const shown = cakeLayersShown(pct);
  const candle = cakeCandleLit(pct);
  const flame = cakeFlameLit(pct);
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));

  return (
    <div className="td-cake" role="img" aria-label={`${label} ${clamped}% complete`}>
      <div className="td-cake-stage" aria-hidden>
        <div className="td-cake-pct">{clamped}%</div>
        <div className={`td-cake-candle ${candle ? "on" : ""}`}>
          <span className={`td-cake-flame ${flame ? "lit" : ""}`} />
        </div>
        {Array.from({ length: CAKE_LAYERS }, (_, i) => (
          <div key={i} className={`td-cake-layer td-cake-layer-${i} ${i < shown ? "on" : ""}`} />
        ))}
        <div className="td-cake-plate" />
      </div>
      <div className="td-cake-track" aria-hidden>
        <span style={{ width: `${clamped}%` }} />
      </div>
      <p className="td-eyebrow text-ink/45">{label}</p>
    </div>
  );
}
