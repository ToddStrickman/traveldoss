import { useCallback, useMemo, useState, type CSSProperties } from "react";
import type { Block, SkinTokens, SkinView, TripView } from "../types";
import "./skin.css";
import { VerticalView } from "./views/VerticalView";
import { HorizontalView } from "./views/HorizontalView";
import { GridView } from "./views/GridView";
import { useEditing } from "./Editable";
import { SlotSelectionProvider, useInertRender } from "./views/parts";
import { DossierMapOverlay, indexDayLookup } from "@/components/map/DossierMap";
import { DayMapContext, type DayMapApi } from "./day-map-context";
import { GalleryOverlayButton } from "./gallery/CoverflowGallery";

export type SkinFrameProps = {
  trip: TripView;
  blocks: Block[];
  tokens: SkinTokens;
  /** Layout mode. Defaults to the editorial vertical view. */
  view?: SkinView;
};

/**
 * The shared, token-driven skin renderer. One component picks the right view
 * (vertical / horizontal / grid) and feeds it a structured itinerary derived
 * from the flat block list. Each skin supplies only tokens.
 */
export function SkinFrame({ trip, blocks, tokens, view = "vertical" }: SkinFrameProps) {
  const { editing } = useEditing();
  // Thumbnails (gallery tiles, landing rail) render inert — no floating chrome.
  const inert = useInertRender();

  // The Live Map, owned once at the frame. Day headers open it focused on
  // their day (owner correction: the map is embedded in each day's header,
  // not a hovering button).
  const [mapState, setMapState] = useState<{ open: boolean; initialDay?: number }>({
    open: false,
  });
  const openMap = useCallback((day?: number) => {
    setMapState({ open: true, initialDay: day });
  }, []);
  const locatedDays = useMemo(() => {
    const dayOf = indexDayLookup(blocks);
    const set = new Set<number>();
    blocks.forEach((b, index) => {
      if (b.kind !== "place" || b.lat == null || b.lng == null) return;
      const day = dayOf.get(index);
      if (day != null) set.add(day);
    });
    return set;
  }, [blocks]);
  const hasAnyCoords = useMemo(
    () => blocks.some((b) => b.kind === "place" && b.lat != null && b.lng != null),
    [blocks],
  );
  const dayMapApi = useMemo<DayMapApi>(
    () => ({
      openMap: inert ? () => {} : openMap,
      locatedDays: inert ? new Set<number>() : locatedDays,
      hasAnyCoords: inert ? false : hasAnyCoords,
    }),
    [inert, openMap, locatedDays, hasAnyCoords],
  );

  const vars = {
    "--tds-bg": tokens.bg,
    "--tds-ink": tokens.ink,
    "--tds-soft": tokens.inkSoft,
    "--tds-accent": tokens.accent,
    "--tds-rule": tokens.rule,
    "--tds-fontDisplay": tokens.fontDisplay,
    "--tds-fontBody": tokens.fontBody,
  } as CSSProperties;

  return (
    <SlotSelectionProvider>
    <DayMapContext.Provider value={dayMapApi}>
    <div className="tds" data-view={view} data-editing={editing ? "true" : undefined} style={vars}>
      {/* React 19 hoists this <link> into <head> and dedupes it. */}
      {tokens.fontUrl ? <link rel="stylesheet" href={tokens.fontUrl} /> : null}

      <div className="tds-canvas">
        {view === "horizontal" ? (
          <HorizontalView trip={trip} blocks={blocks} />
        ) : view === "grid" ? (
          <GridView trip={trip} blocks={blocks} />
        ) : (
          <VerticalView trip={trip} blocks={blocks} />
        )}
      </div>

      <footer className="tds-foot" aria-label="Trip signature">
        <span className="tds-foot-sig">
          {trip.meta?.travelers ? <span className="tds-foot-who">{trip.meta.travelers}</span> : null}
          {trip.meta?.travelers ? <span className="tds-foot-sep" aria-hidden> · </span> : null}
          <span className="tds-foot-trip">{trip.destination}</span>
        </span>
      </footer>

      {/* The Live Map overlay — one instance, opened from any day header. */}
      {!inert && mapState.open ? (
        <DossierMapOverlay
          trip={trip}
          blocks={blocks}
          tokens={tokens}
          initialDay={mapState.initialDay}
          onClose={() => setMapState({ open: false })}
        />
      ) : null}

      {/* Rainbow gallery icon — the dossier's photos are opt-in via the
          fullscreen overlay in every view; nothing bulky inline. */}
      {!inert ? <GalleryOverlayButton trip={trip} blocks={blocks} /> : null}
    </div>
    </DayMapContext.Provider>
    </SlotSelectionProvider>
  );
}
