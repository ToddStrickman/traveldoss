export type TemporalPhase = "dreaming" | "active" | "archive";

export function getTemporalPhase(
  start: string | null | undefined,
  end: string | null | undefined,
  now: Date = new Date(),
): TemporalPhase {
  if (!start || !end) return "dreaming";
  const s = new Date(start).getTime();
  const e = new Date(end).getTime() + 24 * 60 * 60 * 1000 - 1;
  const t = now.getTime();
  if (t < s) return "dreaming";
  if (t > e) return "archive";
  return "active";
}

export function phaseCopy(phase: TemporalPhase): { label: string; tagline: string } {
  switch (phase) {
    case "dreaming":
      return { label: "Dreaming", tagline: "Plan the trip you'll take." };
    case "active":
      return { label: "On the road", tagline: "Companion mode — today, in your pocket." };
    case "archive":
      return { label: "Memories", tagline: "A digital keepsake. Read-only." };
  }
}