import type { CSSProperties } from "react";
import type { Block, SkinTokens, SkinView, TripView } from "../types";
import "./skin.css";
import { VerticalView } from "./views/VerticalView";
import { HorizontalView } from "./views/HorizontalView";
import { GridView } from "./views/GridView";
import { useEditing } from "./Editable";

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

      <footer className="tds-foot">Prepared with TravelDoss · /t/{trip.slug}</footer>
    </div>
  );
}
