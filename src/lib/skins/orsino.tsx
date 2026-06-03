import type { Block, SkinModule, SkinRenderProps, SkinTokens } from "./types";
import { DEMO_BLOCKS, DEMO_TRIP } from "./demo";
import { CategoryIcon, categoryLabel } from "./shared/CategoryIcon";
import { FlightInline, FlightsSummary, collectFlights } from "./shared/FlightsSummary";
import { EditableText, SortableBlocks, useEditing } from "./shared/Editable";
import { Plus } from "lucide-react";
import "./shared/skin.css";

const tokens: SkinTokens = {
  bg: "#0a0a0a",
  ink: "#f4f1ea",
  inkSoft: "#8a857c",
  accent: "#ff3b1f",
  rule: "rgba(244,241,234,0.12)",
  fontDisplay: '"Archivo Black", "Inter", sans-serif',
  fontBody: '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace',
  fontUrl:
    "https://fonts.googleapis.com/css2?family=Archivo+Black&family=JetBrains+Mono:wght@300;400;500&display=swap",
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
        className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-5 md:px-10"
        style={{ borderBottom: `1px solid ${tokens.rule}` }}
      >
        <span style={{ fontFamily: tokens.fontDisplay, fontSize: 14, letterSpacing: "0.04em", textTransform: "uppercase" }}>
          ORSINO / EXPEDITION FILE
        </span>
        <span style={{ fontSize: 10, color: tokens.inkSoft, letterSpacing: "0.2em" }}>
          /t/{trip.slug}
        </span>
      </header>

      <section className="mx-auto max-w-[1400px] px-6 pt-10 md:px-10">
        <h1
          style={{
            fontFamily: tokens.fontDisplay,
            fontSize: "clamp(72px, 16vw, 240px)",
            lineHeight: 0.85,
            letterSpacing: "-0.03em",
            textTransform: "uppercase",
            marginTop: 20,
            wordBreak: "break-word",
          }}
        >
          <EditableText as="span" value={trip.destination} placeholder="Trip title" onChange={(v) => onTripChange("destination", v)} />
        </h1>
        <p style={{ maxWidth: 640, marginTop: 24, fontSize: 15, lineHeight: 1.6, color: tokens.inkSoft }}>
          // <EditableText as="span" multiline value={trip.subtitle ?? ""} placeholder="One sentence about this trip's ethos…" onChange={(v) => onTripChange("subtitle", v)} />
        </p>
      </section>

      <main className="mx-auto max-w-[1400px] px-6 py-20 md:px-10">
        <div className="grid gap-8 md:grid-cols-[200px_1fr]">
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              color: tokens.accent,
              fontFamily: tokens.fontDisplay,
            }}
          >
            ▸ LOGBOOK
          </div>
          <div className="space-y-12">
            <SortableBlocks
              blocks={body}
              renderBlock={(b) => (
                <BlockRender block={b} onChange={(patch) => onBlockChange(realIndex(b), patch)} />
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
        </div>
      </main>

      <footer
        className="mx-auto max-w-[1400px] px-6 py-8 md:px-10"
        style={{
          borderTop: `1px solid ${tokens.rule}`,
          color: tokens.inkSoft,
          fontSize: 10,
          letterSpacing: "0.2em",
        }}
      >
        END OF FILE · TRAVELDOSS//ORSINO
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
            fontSize: 38,
            letterSpacing: "-0.02em",
            textTransform: "uppercase",
            paddingBottom: 12,
            borderBottom: `2px solid ${tokens.accent}`,
            display: "inline-block",
          }}
        >
          <EditableText as="span" value={block.title} placeholder="Section title" onChange={(v) => onChange({ title: v } as Partial<Block>)} />
        </h2>
      );
    case "paragraph":
      return (
        <p style={{ fontSize: 15, lineHeight: 1.7, maxWidth: 640 }}>
          <EditableText as="span" multiline value={block.text} placeholder="Write a paragraph…" onChange={(v) => onChange({ text: v } as Partial<Block>)} />
        </p>
      );
    case "day":
      return (
        <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: 24 }}>
          <div
            style={{
              fontFamily: tokens.fontDisplay,
              fontSize: 48,
              lineHeight: 1,
              color: tokens.accent,
            }}
          >
            {String(block.n).padStart(2, "0")}
          </div>
          <div>
            <div
              style={{
                fontFamily: tokens.fontDisplay,
                fontSize: 22,
                textTransform: "uppercase",
                letterSpacing: "-0.01em",
              }}
            >
              <EditableText as="span" value={block.label} placeholder="Day label" onChange={(v) => onChange({ label: v } as Partial<Block>)} />
            </div>
            <div style={{ marginTop: 10, fontSize: 14, lineHeight: 1.7, color: tokens.inkSoft, maxWidth: 580 }}>
              <EditableText as="span" multiline value={block.notes ?? ""} placeholder="Notes for the day…" onChange={(v) => onChange({ notes: v } as Partial<Block>)} />
            </div>
          </div>
        </div>
      );
    case "place":
      return (
        <div style={{ border: `1px solid ${tokens.rule}`, padding: 18, maxWidth: 580 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 10, letterSpacing: "0.3em", textTransform: "uppercase", color: tokens.accent }}>
            <CategoryIcon category={block.category} style={{ fontSize: 14 }} />
            <span>{categoryLabel(block.category)}</span>
          </div>
          <div style={{ fontFamily: tokens.fontDisplay, fontSize: 20, textTransform: "uppercase", marginTop: 6 }}>
            <EditableText as="span" value={block.name} placeholder="Place name" onChange={(v) => onChange({ name: v } as Partial<Block>)} />
          </div>
          <div style={{ fontSize: 12, color: tokens.inkSoft, marginTop: 4 }}>
            <EditableText as="span" value={block.address ?? ""} placeholder="Address" onChange={(v) => onChange({ address: v } as Partial<Block>)} />
          </div>
          <div style={{ fontSize: 14, marginTop: 8 }}>
            <EditableText as="span" multiline value={block.note ?? ""} placeholder="Note" onChange={(v) => onChange({ note: v } as Partial<Block>)} />
          </div>
        </div>
      );
    case "flight":
      return (
        <div
          className="tds"
          style={{
            maxWidth: 580,
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
        <div style={{ borderLeft: `4px solid ${tokens.accent}`, paddingLeft: 20, maxWidth: 640 }}>
          <div style={{ fontFamily: tokens.fontDisplay, fontSize: 24, lineHeight: 1.3, textTransform: "uppercase" }}>
            "<EditableText as="span" multiline value={block.text} placeholder="A quote…" onChange={(v) => onChange({ text: v } as Partial<Block>)} />"
          </div>
          <div style={{ fontSize: 11, letterSpacing: "0.3em", textTransform: "uppercase", color: tokens.inkSoft, marginTop: 10 }}>
            — <EditableText as="span" value={block.attribution ?? ""} placeholder="Attribution" onChange={(v) => onChange({ attribution: v } as Partial<Block>)} />
          </div>
        </div>
      );
    case "note":
      return (
        <div
          style={{
            fontSize: 12,
            color: tokens.ink,
            background: "rgba(255,59,31,0.08)",
            padding: "10px 14px",
            borderLeft: `3px solid ${tokens.accent}`,
            maxWidth: 580,
            fontFamily: tokens.fontBody,
          }}
        >
          ! <EditableText as="span" multiline value={block.text} placeholder="Note" onChange={(v) => onChange({ text: v } as Partial<Block>)} />
        </div>
      );
    default:
      return null;
  }
}

export const orsino: SkinModule = {
  meta: {
    id: "orsino",
    codename: "Orsino",
    personality: "Life is close to death adventure",
    tags: ["Dark", "Bold"],
  },
  tokens,
  Render,
  previewFixture: { trip: DEMO_TRIP, blocks: DEMO_BLOCKS },
};