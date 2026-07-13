import { createContext, useContext } from "react";

/**
 * Frame-level Live Map API. SkinFrame owns the single map overlay and
 * provides this to every view; day headers render an embedded "Map" opener
 * per day (the owner's correction: the map is part of each day's header,
 * not a hovering button).
 *
 * Lives in its own module so editing-kit can consume it without importing
 * SkinFrame (which imports the views, which import editing-kit).
 */
export type DayMapApi = {
  /** Open the Live Map; with a day number it opens focused on that day. */
  openMap: (day?: number) => void;
  /** Day numbers that have at least one located (lat/lng) stop. */
  locatedDays: ReadonlySet<number>;
  /** Whether the trip has any located stop at all. */
  hasAnyCoords: boolean;
};

export const DayMapContext = createContext<DayMapApi | null>(null);
export const useDayMap = () => useContext(DayMapContext);
