import type { CSSProperties, ReactNode } from "react";
import type { Block, SkinTokens, SkinView, TripView } from "../types";
import "./skin.css";
import { CategoryIcon, categoryLabel } from "./CategoryIcon";
import { FlightInline, FlightsSummary, collectFlights } from "./FlightsSummary";
import { EditableText, SortableBlocks, useEditing } from "./Editable";
import { Plus } from "lucide-react";

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
  const { editing, onBlockChange, onBlockAdd, onTripChange } = useEditing();
  // The legacy "hero" block is folded into trip.destination/subtitle on render.
  // We strip it so it doesn't appear in the editable body list either.
  const heroIndex = blocks.findIndex((b) => b.kind === "hero");
  const body: Block[] = heroIndex >= 0 ? blocks.filter((_, i) => i !== heroIndex) : blocks;
  const bodyOffset = (i: number) => (heroIndex >= 0 && i >= heroIndex ? i + 1 : i);
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
    <div className="tds" data-view={view} data-editing={editing ? "true" : undefined} style={vars}>
      {/* React 19 hoists this <link> into <head> and dedupes it. */}
      {tokens.fontUrl ? <link rel="stylesheet" href={tokens.fontUrl} /> : null}

      <div className="tds-canvas">
        <header className="tds-hero">
          <h1 className="tds-title tds-trip-title">
            <EditableText
              as="span"
              value={trip.destination}
              placeholder="Trip title"
              onChange={(v) => onTripChange("destination", v)}
            />
            <span className="tds-dot">.</span>
          </h1>
          <div className="tds-dek tds-trip-sub">
            <EditableText
              as="span"
              multiline
              value={trip.subtitle ?? ""}
              placeholder="One sentence about this trip's ethos…"
              onChange={(v) => onTripChange("subtitle", v)}
            />
          </div>
          <div className="tds-byline">
            <span>{trip.destination}</span>
            {dates ? <span>{dates}</span> : null}
          </div>
        </header>

        {view === "vertical" ? (
          <SortableBlocks
            blocks={body}
            renderBlock={(b, i) => (
              <BlockView
                block={b}
                index={bodyOffset(i)}
                onChange={(patch) => onBlockChange(bodyOffset(i), patch)}
              />
            )}
          />
        ) : (
          groupForBoard(body).map((item, i) =>
            item.type === "day" ? (
              <section key={i} className="tds-daycard tds-day" data-block="day">
                <DayHeader block={item.day} onChange={(p) => onBlockChange(bodyOffset(blocks.indexOf(item.day) - (heroIndex >= 0 && blocks.indexOf(item.day) > heroIndex ? 1 : 0)), p)} />
                {item.places.map((p, j) => (
                  <BlockView
                    key={j}
                    block={p}
                    index={blocks.indexOf(p)}
                    onChange={(patch) => onBlockChange(blocks.indexOf(p), patch)}
                  />
                ))}
              </section>
            ) : (
              <BlockView
                key={i}
                block={item.block}
                index={blocks.indexOf(item.block)}
                onChange={(patch) => onBlockChange(blocks.indexOf(item.block), patch)}
              />
            ),
          )
        )}
        {editing ? (
          <button
            type="button"
            className="tds-add-block"
            data-print="hide"
            onClick={() => onBlockAdd(blocks.length - 1, "paragraph")}
          >
            <Plus size={12} /> Add block
          </button>
        ) : null}
        <FlightsSummary flights={flights} />
      </div>

      <footer className="tds-foot">Prepared with TravelDoss · /t/{trip.slug}</footer>
    </div>
  );
}

function DayHeader({ block, onChange }: { block: Extract<Block, { kind: "day" }>; onChange?: (p: Partial<Block>) => void }) {
  return (
    <div className="tds-day-head">
      <div className="tds-day-no">Day {String(block.n).padStart(2, "0")}</div>
      <div className="tds-day-label">
        <EditableText as="span" value={block.label} placeholder="Day label" onChange={(v) => onChange?.({ label: v } as Partial<Block>)} />
      </div>
      <div className="tds-day-notes">
        <EditableText as="span" multiline value={block.notes ?? ""} placeholder="Notes for the day…" onChange={(v) => onChange?.({ notes: v } as Partial<Block>)} />
      </div>
    </div>
  );
}

function BlockView({ block, onChange }: { block: Block; index: number; onChange: (p: Partial<Block>) => void }) {
  switch (block.kind) {
    case "section":
      return (
        <div className="tds-section" data-block="section">
          <h2>
            <EditableText as="span" value={block.title} placeholder="Section title" onChange={(v) => onChange({ title: v } as Partial<Block>)} />
          </h2>
        </div>
      );
    case "paragraph":
      return (
        <p className="tds-p" data-block="paragraph">
          <EditableText as="span" multiline value={block.text} placeholder="Write a paragraph…" onChange={(v) => onChange({ text: v } as Partial<Block>)} />
        </p>
      );
    case "day":
      return (
        <div className="tds-day" data-block="day">
          <DayHeader block={block} onChange={onChange} />
        </div>
      );
    case "place":
      return (
        <div className="tds-place" data-block="place">
          <div className="tds-cat">
            <CategoryIcon category={block.category} className="tds-cat-icon" />
            <span>{categoryLabel(block.category)}</span>
          </div>
          <div className="tds-place-name">
            <EditableText as="span" value={block.name} placeholder="Place name" onChange={(v) => onChange({ name: v } as Partial<Block>)} />
          </div>
          <div className="tds-place-addr">
            <EditableText as="span" value={block.address ?? ""} placeholder="Address" onChange={(v) => onChange({ address: v } as Partial<Block>)} />
          </div>
          <div className="tds-place-note">
            <EditableText as="span" multiline value={block.note ?? ""} placeholder="Note" onChange={(v) => onChange({ note: v } as Partial<Block>)} />
          </div>
        </div>
      );
    case "flight":
      return <FlightInline flight={block} />;
    case "quote":
      return (
        <figure className="tds-quote" data-block="quote">
          <blockquote>
            “<EditableText as="span" multiline value={block.text} placeholder="A quote…" onChange={(v) => onChange({ text: v } as Partial<Block>)} />”
          </blockquote>
          <figcaption>
            — <EditableText as="span" value={block.attribution ?? ""} placeholder="Attribution" onChange={(v) => onChange({ attribution: v } as Partial<Block>)} />
          </figcaption>
        </figure>
      );
    case "note":
      return (
        <div className="tds-note" data-block="note">
          <EditableText as="span" multiline value={block.text} placeholder="Note" onChange={(v) => onChange({ text: v } as Partial<Block>)} />
        </div>
      );
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
