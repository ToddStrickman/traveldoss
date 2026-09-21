import { useEffect, useRef, useState } from "react";

/**
 * Honest-but-smooth progress for the compose button.
 *
 * The pipeline is one or two opaque server calls, so there is no byte-level
 * progress to report. Instead each phase owns a ceiling and the bar eases
 * asymptotically toward it — it always moves, never reaches 100% before the
 * work actually lands, and snaps forward the moment a real phase boundary
 * is crossed.
 */
export type ComposePhase = "idle" | "reading" | "drafting" | "structuring" | "done";

const CEILING: Record<ComposePhase, number> = {
  idle: 0,
  reading: 96,
  drafting: 58,
  structuring: 94,
  done: 100,
};

/** Time constant per phase, ms — how fast the ease approaches the ceiling. */
const TAU: Record<ComposePhase, number> = {
  idle: 1,
  reading: 7_000,
  drafting: 22_000,
  structuring: 9_000,
  done: 1,
};

/**
 * Large dossiers legitimately take longer, so the ease is stretched in
 * proportion to how much text was handed in. Without this the bar pinned near
 * its ceiling early on a 40-stop paste and then sat there, which reads as
 * stalled even though the work is progressing.
 */
function sizeFactor(sizeHint: number): number {
  if (!Number.isFinite(sizeHint) || sizeHint <= 0) return 1;
  return Math.min(2.5, 1 + sizeHint / 12_000);
}

export function useComposeProgress(
  active: boolean,
  phase: ComposePhase,
  sizeHint = 0,
): number {
  const [pct, setPct] = useState(0);
  // Progress never walks backwards, even when a new phase has a lower floor.
  const floor = useRef(0);
  const phaseStart = useRef(0);

  useEffect(() => {
    if (!active) {
      floor.current = 0;
      setPct(0);
      return;
    }
    phaseStart.current = Date.now();
    floor.current = Math.max(floor.current, pct);
    if (phase === "done") {
      floor.current = 100;
      setPct(100);
      return;
    }
    const ceiling = CEILING[phase];
    const tau = TAU[phase];
    const start = floor.current;
    const tick = () => {
      const elapsed = Date.now() - phaseStart.current;
      const eased = start + (Math.max(ceiling, start) - start) * (1 - Math.exp(-elapsed / tau));
      setPct((prev) => Math.max(prev, Math.min(99, Math.round(eased))));
    };
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
    // `pct` is intentionally read, not tracked: it only seeds the floor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, phase]);

  return pct;
}
