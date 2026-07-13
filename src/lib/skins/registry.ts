import type { SkinModule } from "./types";
import { epictetus } from "./epictetus";
import { orsino } from "./orsino";
// Token-driven skins (shared SkinFrame engine). Adding one is a single tokens file.
import { marguerite } from "./marguerite";
import { vesper } from "./vesper";
import { marcello } from "./marcello";
import { shishu } from "./shishu";
import { halcyon } from "./halcyon";
import { calliope } from "./calliope";
import { cassian } from "./cassian";
import { solveig } from "./solveig";
import { aurelia } from "./aurelia";

/**
 * The full cast. epictetus + orsino are the original hand-built reference
 * skins; the rest render through the shared token-driven SkinFrame engine.
 */
export const SKINS: SkinModule[] = [
  epictetus,
  orsino,
  marguerite,
  vesper,
  marcello,
  shishu,
  halcyon,
  calliope,
  cassian,
  solveig,
  aurelia,
];

export const getSkin = (id: string): SkinModule | undefined =>
  SKINS.find((s) => s.meta.id === id);

export const isSkinId = (id: string): boolean => SKINS.some((s) => s.meta.id === id);

/** Default fallback when a trip's stored template_id no longer exists. */
export const FALLBACK_SKIN: SkinModule = epictetus;

export type { SkinModule } from "./types";
export type { Block, TripView, SkinMeta, SkinTokens } from "./types";