import type { Block, SkinModule, SkinRenderProps, SkinTokens } from "./types";
import { DEMO_BLOCKS, DEMO_TRIP } from "./demo";
import { CategoryIcon, categoryLabel } from "./shared/CategoryIcon";

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
  const hero = blocks.find((b) => b.kind === "hero") as Extract<Block, { kind: "hero" }> | undefined;
  const body = blocks.filter((b) => b.kind !== "hero");

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
        {hero?.eyebrow && (
          <div
            className="mb-8"
            style={{ fontSize: 10, letterSpacing: "0.45em", textTransform: "uppercase", color: tokens.inkSoft }}
          >
            {hero.eyebrow}
          </div>
        )}
        <h1
          style={{
            fontFamily: tokens.fontDisplay,
            fontSize: "clamp(56px, 9vw, 132px)",
            lineHeight: 0.95,
            letterSpacing: "-0.025em",
            fontWeight: 400,
          }}
        >
          {hero?.title ?? trip.destination}
          <span style={{ color: tokens.accent }}>.</span>
        </h1>
        {hero?.subtitle && (
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
            {hero.subtitle}
          </p>
        )}
      </section>

      <main className="mx-auto max-w-[760px] px-6 py-24 md:px-10">
        <div className="space-y-10">
          {body.map((b, i) => (
            <BlockRender key={i} block={b} />
          ))}
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

function BlockRender({ block }: { block: Block }) {
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
          {block.title}
        </h2>
      );
    case "paragraph":
      return (
        <p style={{ fontSize: 18, lineHeight: 1.7, color: tokens.ink }}>{block.text}</p>
      );
    case "day":
      return (
        <div>
          <div style={{ fontSize: 10, letterSpacing: "0.45em", textTransform: "uppercase", color: tokens.accent }}>
            Day {String(block.n).padStart(2, "0")}
          </div>
          <h3 style={{ fontFamily: tokens.fontDisplay, fontSize: 28, marginTop: 6, letterSpacing: "-0.01em" }}>
            {block.label}
          </h3>
          {block.notes && (
            <p style={{ marginTop: 10, fontSize: 16, lineHeight: 1.7, color: tokens.inkSoft }}>{block.notes}</p>
          )}
        </div>
      );
    case "place":
      return (
        <div style={{ borderLeft: `2px solid ${tokens.accent}`, paddingLeft: 16 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 10, letterSpacing: "0.4em", textTransform: "uppercase", color: tokens.inkSoft }}>
            <CategoryIcon category={block.category} style={{ fontSize: 14, color: tokens.accent }} />
            <span>{categoryLabel(block.category)}</span>
          </div>
          <div style={{ fontFamily: tokens.fontDisplay, fontSize: 22, marginTop: 4 }}>{block.name}</div>
          {block.address && (
            <div style={{ fontSize: 13, color: tokens.inkSoft, marginTop: 2 }}>{block.address}</div>
          )}
          {block.note && (
            <div style={{ fontSize: 15, color: tokens.ink, marginTop: 6, fontStyle: "italic" }}>{block.note}</div>
          )}
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
          "{block.text}"
          {block.attribution && (
            <div style={{ fontSize: 11, letterSpacing: "0.3em", textTransform: "uppercase", color: tokens.inkSoft, marginTop: 10, fontStyle: "normal" }}>
              — {block.attribution}
            </div>
          )}
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
          {block.text}
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
  },
  tokens,
  Render,
  previewFixture: { trip: DEMO_TRIP, blocks: DEMO_BLOCKS },
};