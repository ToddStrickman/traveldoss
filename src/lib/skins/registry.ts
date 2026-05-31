import type { SkinModule } from "./types";
import { epictetus } from "./epictetus";
import { orsino } from "./orsino";

/**
 * v1 ships with 2 fully-built reference skins. The remaining 6
 * (Shishu, Marcello, Calliope, Vesper, Halcyon, Marguerite) land in
 * step 7 of the build plan.
 */
export const SKINS: SkinModule[] = [epictetus, orsino];

export const getSkin = (id: string): SkinModule | undefined =>
  SKINS.find((s) => s.meta.id === id);

export const isSkinId = (id: string): boolean => SKINS.some((s) => s.meta.id === id);

/** Default fallback when a trip's stored template_id no longer exists. */
export const FALLBACK_SKIN: SkinModule = epictetus;

export type { SkinModule } from "./types";
export type { Block, TripView, SkinMeta, SkinTokens } from "./types";