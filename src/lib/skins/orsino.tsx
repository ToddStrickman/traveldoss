import type { Block, SkinModule, SkinRenderProps, SkinTokens } from "./types";
import { DEMO_BLOCKS, DEMO_TRIP } from "./demo";
import { CategoryIcon, categoryLabel } from "./shared/CategoryIcon";
import { FlightInline, FlightsSummary, collectFlights } from "./shared/FlightsSummary";
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
  const hero = blocks.find((b) => b.kind === "hero") as Extract<Block, { kind: "hero" }> | undefined;
  const body = blocks.filter((b) => b.kind !== "hero");
  const flights = collectFlights(blocks);

  return (
    <div
      className="min-h-full"
      style={{
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
        {hero?.eyebrow && (
          <div
            style={{
              display: "inline-block",
              background: tokens.accent,
              color: "#0a0a0a",
              padding: "4px 10px",
              fontFamily: tokens.fontDisplay,
              fontSize: 11,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            {hero.eyebrow}
          </div>
        )}
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
          {hero?.title ?? trip.destination}
        </h1>
        {hero?.subtitle && (
          <p style={{ maxWidth: 640, marginTop: 24, fontSize: 15, lineHeight: 1.6, color: tokens.inkSoft }}>
            // {hero.subtitle}
          </p>
        )}
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
            {body.map((b, i) => (
              <BlockRender key={i} block={b} />
            ))}
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

function BlockRender({ block }: { block: Block }) {
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
          {block.title}
        </h2>
      );
    case "paragraph":
      return <p style={{ fontSize: 15, lineHeight: 1.7, maxWidth: 640 }}>{block.text}</p>;
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
              {block.label}
            </div>
            {block.notes && (
              <div style={{ marginTop: 10, fontSize: 14, lineHeight: 1.7, color: tokens.inkSoft, maxWidth: 580 }}>
                {block.notes}
              </div>
            )}
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
            {block.name}
          </div>
          {block.address && (
            <div style={{ fontSize: 12, color: tokens.inkSoft, marginTop: 4 }}>{block.address}</div>
          )}
          {block.note && <div style={{ fontSize: 14, marginTop: 8 }}>{block.note}</div>}
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
            "{block.text}"
          </div>
          {block.attribution && (
            <div style={{ fontSize: 11, letterSpacing: "0.3em", textTransform: "uppercase", color: tokens.inkSoft, marginTop: 10 }}>
              — {block.attribution}
            </div>
          )}
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
          ! {block.text}
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
  },
  tokens,
  Render,
  previewFixture: { trip: DEMO_TRIP, blocks: DEMO_BLOCKS },
};