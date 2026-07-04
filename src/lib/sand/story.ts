/**
 * Environmental storytelling for the sand hero.
 *
 * Every page load rolls a Story: how buried the inscription starts, how the
 * wind behaves, and which lighting mood the scene wakes up in. This is what
 * makes no two visits look identical.
 */

export type StoryId =
  | "freshly-buried"
  | "partially-excavated"
  | "recently-unearthed"
  | "ancient-ruin";

export type LightingPreset =
  | "sunrise"
  | "midday"
  | "sunset"
  | "moonlight";

export interface Story {
  id: StoryId;
  /** 0..1 — how much overburden sand covers the inscription at load. */
  burial: number;
  /** 0..1 — grain erosion: higher = duller edges, more scattered grains. */
  weathering: number;
  /** Base wind strength (world units/s² applied to lightest layer). */
  windBase: number;
  /** 0..1 — probability weighting for gust events. */
  gustiness: number;
  /** Seconds before the opening wind begins uncovering the letters. */
  revealDelay: number;
  /** Duration of the opening reveal sweep, seconds. */
  revealDuration: number;
  lighting: LightingPreset;
}

/*
 * ── TUNE ME ─────────────────────────────────────────────────────────────
 * These weights decide the first impression a visitor gets. A high
 * "freshly-buried" weight makes the brand feel mysterious (most visitors
 * must dig); high "recently-unearthed" makes the headline legible fast
 * (better for conversion, less theater). The current split favors
 * legibility ~60/40 while keeping rare dramatic loads.
 *
 * Todd: this is the one knob worth an opinion — adjust the weights and the
 * per-story numbers below to set how much work a first-time visitor does
 * before they can read "Travel Doss."
 * ────────────────────────────────────────────────────────────────────────
 */
const STORY_WEIGHTS: ReadonlyArray<readonly [StoryId, number]> = [
  ["freshly-buried", 0.18],
  ["partially-excavated", 0.34],
  ["recently-unearthed", 0.36],
  ["ancient-ruin", 0.12],
];

const LIGHTING_WEIGHTS: ReadonlyArray<readonly [LightingPreset, number]> = [
  ["sunrise", 0.2],
  ["midday", 0.3],
  ["sunset", 0.35],
  ["moonlight", 0.15],
];

function weightedPick<T>(
  entries: ReadonlyArray<readonly [T, number]>,
  roll: number,
): T {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = roll * total;
  for (const [value, w] of entries) {
    r -= w;
    if (r <= 0) return value;
  }
  return entries[entries.length - 1][0];
}

export function rollStory(rand: () => number): Story {
  const id = weightedPick(STORY_WEIGHTS, rand());
  const lighting = weightedPick(LIGHTING_WEIGHTS, rand());
  const jitter = (span: number) => (rand() * 2 - 1) * span;

  // Burial and weathering are kept inside a narrow band: the stories differ
  // in mood (wind, timing, light), never in whether the wordmark reads.
  switch (id) {
    case "freshly-buried":
      return {
        id, lighting,
        burial: 0.55 + jitter(0.05),
        weathering: 0.15 + jitter(0.08),
        windBase: 26 + jitter(6),
        gustiness: 0.5 + jitter(0.15),
        revealDelay: 0.9 + jitter(0.3),
        revealDuration: 3.0 + jitter(0.4),
      };
    case "partially-excavated":
      return {
        id, lighting,
        burial: 0.42 + jitter(0.08),
        weathering: 0.3 + jitter(0.1),
        windBase: 20 + jitter(5),
        gustiness: 0.35 + jitter(0.1),
        revealDelay: 0.5 + jitter(0.2),
        revealDuration: 2.2 + jitter(0.4),
      };
    case "recently-unearthed":
      return {
        id, lighting,
        burial: 0.24 + jitter(0.06),
        weathering: 0.22 + jitter(0.08),
        windBase: 14 + jitter(4),
        gustiness: 0.25 + jitter(0.1),
        revealDelay: 0.3 + jitter(0.15),
        revealDuration: 1.8 + jitter(0.3),
      };
    case "ancient-ruin":
      return {
        id, lighting,
        burial: 0.4 + jitter(0.08),
        weathering: 0.55 + jitter(0.08),
        windBase: 32 + jitter(8),
        gustiness: 0.65 + jitter(0.15),
        revealDelay: 0.6 + jitter(0.2),
        revealDuration: 2.6 + jitter(0.5),
      };
  }
}

/**
 * Lighting presets tint the sand and set the "sun" direction used for the
 * fake per-grain shading in the shader. Colors are chosen to harmonize with
 * the TravelDoss navy/champagne design system rather than literal skies.
 */
export interface LightingConfig {
  /** RGB multipliers applied over the base sand palette. */
  tint: [number, number, number];
  /** Normalized light direction (x, y) in screen space, +y = up. */
  sunDir: [number, number];
  /** Ambient floor so shadowed grains never go fully black. */
  ambient: number;
  /** Strength of the golden glow during the wow moment. */
  glowBoost: number;
}

export const LIGHTING: Record<LightingPreset, LightingConfig> = {
  sunrise: { tint: [1.06, 0.97, 0.9], sunDir: [-0.8, 0.35], ambient: 0.42, glowBoost: 1.15 },
  midday: { tint: [1.0, 1.0, 1.0], sunDir: [0.15, 0.95], ambient: 0.5, glowBoost: 1.0 },
  sunset: { tint: [1.12, 0.92, 0.78], sunDir: [0.85, 0.25], ambient: 0.38, glowBoost: 1.3 },
  // Kept close to neutral: a strongly blue night wash fights the champagne
  // brand palette and makes some loads look like a different site.
  moonlight: { tint: [0.92, 0.94, 1.03], sunDir: [-0.3, 0.8], ambient: 0.34, glowBoost: 1.45 },
};
