import type { CSSProperties } from "react";
import type { Block, SkinTokens, SkinView, TripView } from "../types";
import "./skin.css";
import { CategoryIcon, categoryLabel } from "./CategoryIcon";
import { FlightInline, FlightsSummary, collectFlights } from "./FlightsSummary";

export type SkinFrameProps = {
  trip: TripView;
  blocks: Block[];
  tokens: SkinTokens;
  /** Layout mode. Defaults to the editorial vertical view. */
  view?: SkinView;
};

/**
 * The shared, token-driven skin renderer. One component lays out all seven
 * block kinds in three views; each skin supplies only tokens. Mirrors the
 * hand-built reference skins (epictetus/orsino) but write-once.
 */
export function SkinFrame({ trip, blocks, tokens, view = "vertical" }: SkinFrameProps) {
  const hero = blocks.find((b) => b.kind === "hero") as Extract<Block, { kind: "hero" }> | undefined;
  const body = blocks.filter((b) => b.kind !== "hero");
  const flights = collectFlights(blocks);

  const vars = {
    "--tds-bg": tokens.bg,
    "--tds-ink": tokens.ink,
    "--tds-soft": tokens.inkSoft,
    "--tds-accent": tokens.accent,
    "--tds-rule": tokens.rule,
    "--tds-fontDisplay": tokens.fontDisplay,
    "--tds-fontBody": tokens.fontBody,
  } as CSSProperties;

  const dates = [trip.start_date, trip.end_date].filter(Boolean).join(" – ");

  return (
    <div className="tds" data-view={view} style={vars}>
      {/* React 19 hoists this <link> into <head> and dedupes it. */}
      {tokens.fontUrl ? <link rel="stylesheet" href={tokens.fontUrl} /> : null}

      <div className="tds-canvas">
        <header className="tds-hero">
          {hero?.eyebrow ? <div className="tds-eyebrow">{hero.eyebrow}</div> : null}
          <h1 className="tds-title">
            {hero?.title ?? trip.destination}
            <span className="tds-dot">.</span>
          </h1>
          {hero?.subtitle ?? trip.subtitle ? (
            <div className="tds-dek">{hero?.subtitle ?? trip.subtitle}</div>
          ) : null}
          <div className="tds-byline">
            <span>{trip.destination}</span>
            {dates ? <span>{dates}</span> : null}
          </div>
        </header>

        {view === "vertical"
          ? body.map((b, i) => <BlockView key={i} block={b} />)
          : groupForBoard(body).map((item, i) =>
              item.type === "day" ? (
                <section key={i} className="tds-daycard tds-day" data-block="day">
                  <DayHeader block={item.day} />
                  {item.places.map((p, j) => (
                    <BlockView key={j} block={p} />
                  ))}
                </section>
              ) : (
                <BlockView key={i} block={item.block} />
              ),
            )}
        <FlightsSummary flights={flights} />
      </div>

      <footer className="tds-foot">Prepared with TravelDoss · /t/{trip.slug}</footer>
    </div>
  );
}

function DayHeader({ block }: { block: Extract<Block, { kind: "day" }> }) {
  return (
    <div className="tds-day-head">
      <div className="tds-day-no">Day {String(block.n).padStart(2, "0")}</div>
      <div className="tds-day-label">{block.label}</div>
      {block.notes ? <div className="tds-day-notes">{block.notes}</div> : null}
    </div>
  );
}

function BlockView({ block }: { block: Block }) {
  switch (block.kind) {
    case "section":
      return (
        <div className="tds-section" data-block="section">
          <h2>{block.title}</h2>
        </div>
      );
    case "paragraph":
      return <p className="tds-p" data-block="paragraph">{block.text}</p>;
    case "day":
      return (
        <div className="tds-day" data-block="day">
          <DayHeader block={block} />
        </div>
      );
    case "place":
      return (
        <div className="tds-place" data-block="place">
          <div className="tds-cat">
            <CategoryIcon category={block.category} className="tds-cat-icon" />
            <span>{categoryLabel(block.category)}</span>
          </div>
          <div className="tds-place-name">{block.name}</div>
          {block.address ? <div className="tds-place-addr">{block.address}</div> : null}
          {block.note ? <div className="tds-place-note">{block.note}</div> : null}
        </div>
      );
    case "flight":
      return <FlightInline flight={block} />;
    case "quote":
      return (
        <figure className="tds-quote" data-block="quote">
          <blockquote>“{block.text}”</blockquote>
          {block.attribution ? <figcaption>— {block.attribution}</figcaption> : null}
        </figure>
      );
    case "note":
      return <div className="tds-note" data-block="note">{block.text}</div>;
    default:
      return null;
  }
}

type BoardItem =
  | { type: "day"; day: Extract<Block, { kind: "day" }>; places: Extract<Block, { kind: "place" }>[] }
  | { type: "block"; block: Block };

/** Group consecutive place blocks under their preceding day into a card; other
 *  blocks stay standalone. Lets the flat block list render as a board/grid. */
function groupForBoard(blocks: Block[]): BoardItem[] {
  const out: BoardItem[] = [];
  let current: Extract<BoardItem, { type: "day" }> | null = null;
  for (const b of blocks) {
    if (b.kind === "day") {
      current = { type: "day", day: b, places: [] };
      out.push(current);
    } else if (b.kind === "place" && current) {
      current.places.push(b);
    } else {
      current = null;
      out.push({ type: "block", block: b });
    }
  }
  return out;
}
