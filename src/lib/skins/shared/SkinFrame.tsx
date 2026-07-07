import type { CSSProperties } from "react";
import type { Block, SkinTokens, SkinView, TripView } from "../types";
import "./skin.css";
import { VerticalView } from "./views/VerticalView";
import { HorizontalView } from "./views/HorizontalView";
import { GridView } from "./views/GridView";
import { useEditing } from "./Editable";
import { SlotSelectionProvider, useInertRender } from "./views/parts";
import { DossierMapButton } from "@/components/map/DossierMap";
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

      {/* The Live Map — every template, one pin button (landing promise). */}
      {!inert ? <DossierMapButton trip={trip} blocks={blocks} tokens={tokens} /> : null}

      {/* Rainbow gallery icon — compact entry point where the gallery isn't
          inline (Horizontal Board + Grid). Vertical embeds it instead. */}
      {!inert && view !== "vertical" ? <GalleryOverlayButton trip={trip} blocks={blocks} /> : null}
    </div>
    </SlotSelectionProvider>
  );
}
