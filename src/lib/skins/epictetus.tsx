import type { Block, SkinModule, SkinRenderProps, SkinTokens } from "./types";
import { DEMO_BLOCKS, DEMO_TRIP } from "./demo";
import { CategoryIcon, categoryLabel } from "./shared/CategoryIcon";
import { FlightInline, FlightsSummary, collectFlights } from "./shared/FlightsSummary";
import { EditableText, SortableBlocks, useEditing } from "./shared/Editable";
import { Plus } from "lucide-react";
import "./shared/skin.css";

const tokens: SkinTokens = {
  bg: "#f3efe7",
  ink: "#1a1813",
  inkSoft: "#6b6557",
  accent: "#7a2e1f",
  rule: "rgba(26,24,19,0.12)",
  fontDisplay: '"Cormorant Garamond", "EB Garamond", Georgia, serif',
  fontBody: '"Inter", ui-sans-serif, system-ui, sans-serif',
  fontUrl:
    "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400;1,500&family=Inter:wght@300;400;500&display=swap",
};

function Render({ trip, blocks }: SkinRenderProps) {
  const { editing, onBlockChange, onBlockAdd, onTripChange } = useEditing();
  const heroIndex = blocks.findIndex((b) => b.kind === "hero");
  const body: Block[] = heroIndex >= 0 ? blocks.filter((_, i) => i !== heroIndex) : blocks;
  const realIndex = (b: Block) => blocks.indexOf(b);
  const flights = collectFlights(blocks);

  return (
    <div
      className="min-h-full tds"
      data-editing={editing ? "true" : undefined}
      style={{
        ["--tds-bg" as string]: tokens.bg,
        ["--tds-ink" as string]: tokens.ink,
        ["--tds-soft" as string]: tokens.inkSoft,
        ["--tds-accent" as string]: tokens.accent,
        ["--tds-rule" as string]: tokens.rule,
        ["--tds-fontDisplay" as string]: tokens.fontDisplay,
        ["--tds-fontBody" as string]: tokens.fontBody,
        background: tokens.bg,
        color: tokens.ink,
        fontFamily: tokens.fontBody,
      }}
    >
      <header
        className="mx-auto flex max-w-[1100px] items-center justify-between px-6 py-6 md:px-10"
        style={{ borderBottom: `1px solid ${tokens.rule}` }}
      >
        <span style={{ fontFamily: tokens.fontDisplay, fontSize: 22, letterSpacing: "-0.01em" }}>
          {trip.destination}
        </span>
        <span style={{ fontSize: 10, letterSpacing: "0.4em", textTransform: "uppercase", color: tokens.inkSoft }}>
          Epictetus · Vol. I
        </span>
      </header>

      <section className="mx-auto max-w-[860px] px-6 pt-16 md:px-10 md:pt-24">
        <h1
          style={{
            fontFamily: tokens.fontDisplay,
            fontSize: "clamp(56px, 9vw, 132px)",
            lineHeight: 0.95,
            letterSpacing: "-0.025em",
            fontWeight: 400,
          }}
        >
          <EditableText
            as="span"
            value={trip.destination}
            placeholder="Trip title"
            onChange={(v) => onTripChange("destination", v)}
          />
          <span style={{ color: tokens.accent }}>.</span>
        </h1>
        <p
          style={{
            fontFamily: tokens.fontDisplay,
            fontStyle: "italic",
            fontSize: 22,
            marginTop: 28,
            maxWidth: 560,
            color: tokens.ink,
          }}
        >
          <EditableText
            as="span"
            multiline
            value={trip.subtitle ?? ""}
            placeholder="One sentence about this trip's ethos…"
            onChange={(v) => onTripChange("subtitle", v)}
          />
        </p>
      </section>

      <main className="mx-auto max-w-[760px] px-6 py-24 md:px-10">
        <div className="space-y-10">
          <SortableBlocks
            blocks={body}
            renderBlock={(b) => (
              <BlockRender
                block={b}
                onChange={(patch) => onBlockChange(realIndex(b), patch)}
              />
            )}
          />
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
          {flights.length > 0 && (
            <div
              className="tds"
              style={{
                ["--tds-bg" as any]: tokens.bg,
                ["--tds-ink" as any]: tokens.ink,
                ["--tds-soft" as any]: tokens.inkSoft,
                ["--tds-accent" as any]: tokens.accent,
                ["--tds-rule" as any]: tokens.rule,
                ["--tds-fontDisplay" as any]: tokens.fontDisplay,
                ["--tds-fontBody" as any]: tokens.fontBody,
              }}
            >
              <FlightsSummary flights={flights} />
            </div>
          )}
        </div>
      </main>

      <footer
        className="mx-auto max-w-[1100px] px-6 py-10 text-center md:px-10"
        style={{ borderTop: `1px solid ${tokens.rule}`, color: tokens.inkSoft, fontSize: 10, letterSpacing: "0.4em", textTransform: "uppercase" }}
      >
        Prepared with TravelDoss · /t/{trip.slug}
      </footer>
    </div>
  );
}

function BlockRender({ block, onChange }: { block: Block; onChange: (p: Partial<Block>) => void }) {
  switch (block.kind) {
    case "section":
      return (
        <h2
          style={{
            fontFamily: tokens.fontDisplay,
            fontSize: 32,
            letterSpacing: "-0.01em",
            borderBottom: `1px solid ${tokens.rule}`,
            paddingBottom: 8,
          }}
        >
          <EditableText as="span" value={block.title} placeholder="Section title" onChange={(v) => onChange({ title: v } as Partial<Block>)} />
        </h2>
      );
    case "paragraph":
      return (
        <p style={{ fontSize: 18, lineHeight: 1.7, color: tokens.ink }}>
          <EditableText as="span" multiline value={block.text} placeholder="Write a paragraph…" onChange={(v) => onChange({ text: v } as Partial<Block>)} />
        </p>
      );
    case "day":
      return (
        <div>
          <div style={{ fontSize: 10, letterSpacing: "0.45em", textTransform: "uppercase", color: tokens.accent }}>
            Day {String(block.n).padStart(2, "0")}
          </div>
          <h3 style={{ fontFamily: tokens.fontDisplay, fontSize: 28, marginTop: 6, letterSpacing: "-0.01em" }}>
            <EditableText as="span" value={block.label} placeholder="Day label" onChange={(v) => onChange({ label: v } as Partial<Block>)} />
          </h3>
          <p style={{ marginTop: 10, fontSize: 16, lineHeight: 1.7, color: tokens.inkSoft }}>
            <EditableText as="span" multiline value={block.notes ?? ""} placeholder="Notes for the day…" onChange={(v) => onChange({ notes: v } as Partial<Block>)} />
          </p>
        </div>
      );
    case "place":
      return (
        <div style={{ borderLeft: `2px solid ${tokens.accent}`, paddingLeft: 16 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 10, letterSpacing: "0.4em", textTransform: "uppercase", color: tokens.inkSoft }}>
            <CategoryIcon category={block.category} style={{ fontSize: 14, color: tokens.accent }} />
            <span>{categoryLabel(block.category)}</span>
          </div>
          <div style={{ fontFamily: tokens.fontDisplay, fontSize: 22, marginTop: 4 }}>
            <EditableText as="span" value={block.name} placeholder="Place name" onChange={(v) => onChange({ name: v } as Partial<Block>)} />
          </div>
          <div style={{ fontSize: 13, color: tokens.inkSoft, marginTop: 2 }}>
            <EditableText as="span" value={block.address ?? ""} placeholder="Address" onChange={(v) => onChange({ address: v } as Partial<Block>)} />
          </div>
          <div style={{ fontSize: 15, color: tokens.ink, marginTop: 6, fontStyle: "italic" }}>
            <EditableText as="span" multiline value={block.note ?? ""} placeholder="Note" onChange={(v) => onChange({ note: v } as Partial<Block>)} />
          </div>
        </div>
      );
    case "flight":
      return (
        <div
          className="tds"
          style={{
            ["--tds-bg" as any]: tokens.bg,
            ["--tds-ink" as any]: tokens.ink,
            ["--tds-soft" as any]: tokens.inkSoft,
            ["--tds-accent" as any]: tokens.accent,
            ["--tds-rule" as any]: tokens.rule,
            ["--tds-fontDisplay" as any]: tokens.fontDisplay,
            ["--tds-fontBody" as any]: tokens.fontBody,
          }}
        >
          <FlightInline flight={block} />
        </div>
      );
    case "quote":
      return (
        <blockquote
          style={{
            fontFamily: tokens.fontDisplay,
            fontStyle: "italic",
            fontSize: 26,
            lineHeight: 1.4,
            color: tokens.ink,
            borderLeft: `1px solid ${tokens.rule}`,
            paddingLeft: 20,
          }}
        >
          "<EditableText as="span" multiline value={block.text} placeholder="A quote…" onChange={(v) => onChange({ text: v } as Partial<Block>)} />"
          <div style={{ fontSize: 11, letterSpacing: "0.3em", textTransform: "uppercase", color: tokens.inkSoft, marginTop: 10, fontStyle: "normal" }}>
            — <EditableText as="span" value={block.attribution ?? ""} placeholder="Attribution" onChange={(v) => onChange({ attribution: v } as Partial<Block>)} />
          </div>
        </blockquote>
      );
    case "note":
      return (
        <div
          style={{
            fontSize: 13,
            color: tokens.inkSoft,
            background: "rgba(122,46,31,0.06)",
            padding: "12px 16px",
            borderLeft: `2px solid ${tokens.accent}`,
          }}
        >
          <EditableText as="span" multiline value={block.text} placeholder="Note" onChange={(v) => onChange({ text: v } as Partial<Block>)} />
        </div>
      );
    default:
      return null;
  }
}

export const epictetus: SkinModule = {
  meta: {
    id: "epictetus",
    codename: "Epictetus",
    personality: "Reads philosophy on the train",
    tags: ["Editorial", "Classic", "Light"],
  },
  tokens,
  Render,
  previewFixture: { trip: DEMO_TRIP, blocks: DEMO_BLOCKS },
};