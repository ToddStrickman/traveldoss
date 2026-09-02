/**
 * DossierCover — the abstract dossier "object" used wherever we show a
 * template as a thing you can pick up rather than a page you can read.
 *
 * Deliberately NOT a shrunken render of the demo itinerary: at cover size
 * real type turns to grey mush and, worse, makes every template look like
 * it's about the same city. Instead each cover is drawn from that skin's own
 * tokens — foil edge, accent spine, wax seal — plus abstract art that shows
 * what the layout you're browsing actually gives you: photographs and
 * comparisons (vertical), a drag-between-days board (horizontal), or one
 * structured table of everything (grid).
 *
 * Fills its parent; the parent owns dimensions so layout never shifts.
 */
import type { SkinModule } from "@/lib/skins/types";

/** Which layout's benefit the abstract art should express. */
export type CoverVariant = "horizontal" | "vertical" | "grid";

/** The benefit each layout is bought for, said in one line. Shared with the
 *  layout switcher so the picker and the cover never disagree. */
export const COVER_CAPTIONS: Record<CoverVariant, string> = {
  vertical: "Photographs and comparisons, top to bottom",
  horizontal: "Drag activities between days like a board",
  grid: "Everything structured, at a glance",
};

export function DossierCoverArt({
  skin,
  selected = true,
  /** Scales the interior type/rules for smaller or larger cover slots. */
  size = "md",
  /** Abstract art matches the layout being browsed. */
  variant = "horizontal",
}: {
  skin: SkinModule;
  selected?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: CoverVariant;
}) {
  const t = skin.tokens;
  const s =
    size === "lg"
      ? { pad: "px-6 py-7", eyebrow: "text-[10px]", title: "text-[34px]", tag: "text-[12px]", part: "text-[9px]", gap: "gap-3.5", seal: "h-8 w-8 text-[10px]" }
      : size === "sm"
        ? { pad: "px-3.5 py-4", eyebrow: "text-[8px]", title: "text-[22px]", tag: "text-[10px]", part: "text-[7px]", gap: "gap-2", seal: "h-5 w-5 text-[7px]" }
        : { pad: "px-4 py-5", eyebrow: "text-[8.5px]", title: "text-[26px]", tag: "text-[10.5px]", part: "text-[7.5px]", gap: "gap-2.5", seal: "h-6 w-6 text-[8px]" };


  return (
    <>
      {t.fontUrl ? <link rel="stylesheet" href={t.fontUrl} /> : null}
      {/* Foil edge */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-[5px] rounded-[6px]"
        style={{ border: `1px solid ${t.rule}` }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-[6px]"
        style={{ background: t.accent, opacity: 0.75 }}
      />
      {/* Sheen — sweeps once as the cover centres, again on hover. */}
      <span aria-hidden className="td-cover-sheen pointer-events-none absolute inset-0" />

      <div className={`relative flex h-full flex-col ${s.pad}`}>
        <div
          className={`${s.eyebrow} font-medium uppercase tracking-[0.32em]`}
          style={{ color: t.inkSoft }}
        >
          Dossier
        </div>
        <div className="mt-4">
          <div
            className={`${s.title} leading-[1.05]`}
            style={{ fontFamily: t.fontDisplay, color: t.ink }}
          >
            {skin.meta.codename}
          </div>
          <div className="mt-2 h-px w-10" style={{ background: t.accent }} />
          <div
            className={`mt-2 ${s.tag} leading-[1.45]`}
            style={{ fontFamily: t.fontBody, color: t.inkSoft }}
          >
            {skin.meta.tags[0]}
          </div>
        </div>

        {/* Layout art — abstract, drawn from this skin's tokens, shaped like
            the benefit of the layout you're browsing. */}
        <div className={`mt-auto flex flex-col ${s.gap}`} aria-hidden>
          {variant === "grid" ? (
            <GridArt t={t} part={s.part} />
          ) : variant === "horizontal" ? (
            <HorizontalArt t={t} part={s.part} />
          ) : (
            <VerticalArt t={t} part={s.part} />
          )}
          <span
            className={`${s.part} font-medium uppercase tracking-[0.28em]`}
            style={{ color: `color-mix(in oklab, ${t.inkSoft} 88%, ${t.ink})` }}
          >
            {COVER_CAPTIONS[variant]}
          </span>
        </div>

      </div>

      {/* Wax seal — warms as the cover centres, stamps in on choose. */}
      <span
        aria-hidden
        className={`td-cover-seal absolute right-3 top-3 flex ${s.seal} items-center justify-center rounded-full font-medium uppercase tracking-[0.1em]`}
        style={{ background: t.accent, color: t.bg, opacity: selected ? 1 : 0.45 }}
      >
        TD
      </span>
    </>
  );
}

type Tk = SkinModule["tokens"];

/** A token-filled photograph plate — abstract, loads nothing. */
function Plate({
  t,
  className = "",
  style,
}: {
  t: Tk;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={`block rounded-[3px] ${className}`}
      style={{
        border: `1px solid ${t.rule}`,
        background: `linear-gradient(135deg, color-mix(in oklab, ${t.accent} 26%, transparent) 0%, color-mix(in oklab, ${t.inkSoft} 16%, transparent) 100%)`,
        ...style,
      }}
    />
  );
}

/**
 * Vertical — the photographic read: image plates alternating with text,
 * plus two plates set beside each other where a comparison sits.
 */
function VerticalArt({ t, part }: { t: Tk; part: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      {/* Plate + its text column */}
      <div className="td-cover-line flex items-stretch gap-1.5" style={{ animationDelay: "0ms" }}>
        <Plate t={t} className="h-7 w-[42%] shrink-0" />
        <span className="flex min-w-0 flex-1 flex-col justify-center gap-1">
          {[0.92, 0.7, 0.84].map((w, i) => (
            <span
              key={i}
              className="h-px"
              style={{ width: `${w * 100}%`, background: t.rule }}
            />
          ))}
        </span>
      </div>

      {/* The comparison: two plates side by side under one label */}
      <div className="td-cover-line flex flex-col gap-1" style={{ animationDelay: "110ms" }}>
        <span
          className={`${part} font-medium uppercase tracking-[0.28em]`}
          style={{ color: t.inkSoft }}
        >
          This or this
        </span>
        <span className="flex items-stretch gap-1.5">
          <Plate t={t} className="h-6 flex-1" />
          <span
            className="my-1 w-px shrink-0"
            style={{ background: t.accent, opacity: 0.7 }}
          />
          <Plate t={t} className="h-6 flex-1" />
        </span>
      </div>

      {/* One more text run so the page reads as continuous downward flow */}
      <div className="td-cover-line flex flex-col gap-1" style={{ animationDelay: "200ms" }}>
        {[0.96, 0.62].map((w, i) => (
          <span
            key={i}
            className="h-px"
            style={{ width: `${w * 100}%`, background: t.rule }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Horizontal — the board: day columns side by side with activity cards, one
 * card lifted mid-move and a dashed drop slot waiting in the next column.
 */
function HorizontalArt({ t, part }: { t: Tk; part: string }) {
  const cards = [2, 1, 2];
  return (
    <div className="relative flex items-start gap-1.5 overflow-hidden pt-2">
      {cards.map((count, ci) => (
        <div
          key={ci}
          className="td-cover-line flex flex-1 flex-col gap-1 rounded-[3px] p-1"
          style={{
            border: `1px solid ${t.rule}`,
            background:
              ci === 1 ? `color-mix(in oklab, ${t.accent} 8%, transparent)` : "transparent",
            animationDelay: `${ci * 90}ms`,
          }}
        >
          <span
            className={`${part} font-medium uppercase tracking-[0.2em]`}
            style={{ color: t.inkSoft }}
          >
            {`D${ci + 1}`}
          </span>
          {Array.from({ length: count }).map((_, j) => (
            <span
              key={j}
              className="flex flex-col gap-[2px] rounded-[2px] px-1 py-[3px]"
              style={{ border: `1px solid ${t.rule}` }}
            >
              <span className="h-px w-[86%]" style={{ background: t.rule }} />
              <span className="h-px w-[56%]" style={{ background: t.rule }} />
            </span>
          ))}
          {/* The waiting slot: where the lifted card is going to land. */}
          {ci === 1 ? (
            <span
              className="h-4 rounded-[2px]"
              style={{
                border: `1px dashed ${t.accent}`,
                background: `color-mix(in oklab, ${t.accent} 10%, transparent)`,
              }}
            />
          ) : null}
        </div>
      ))}

      {/* The card in flight, tilted between the first two columns. */}
      <span
        className="td-cover-line absolute left-[22%] top-0 flex w-[26%] flex-col gap-[2px] rounded-[2px] px-1 py-[3px]"
        style={{
          border: `1px solid ${t.accent}`,
          background: t.bg,
          transform: "rotate(-7deg)",
          boxShadow: `0 4px 10px -4px color-mix(in oklab, ${t.ink} 55%, transparent)`,
          animationDelay: "170ms",
        }}
      >
        <span className="h-px w-[80%]" style={{ background: t.accent }} />
        <span className="h-px w-[52%]" style={{ background: t.rule }} />
      </span>
    </div>
  );
}

/**
 * Grid — the structured table: a header band, an even board of day tiles
 * with aligned label/value rows, and one shared column rule.
 */
function GridArt({ t, part }: { t: Tk; part: string }) {
  return (
    <div className="flex flex-col gap-1">
      {/* Header band */}
      <div
        className="flex items-center gap-1 rounded-[2px] px-1 py-[2px]"
        style={{ background: `color-mix(in oklab, ${t.accent} 14%, transparent)` }}
      >
        {[0.3, 0.22, 0.26].map((w, i) => (
          <span
            key={i}
            className="h-px"
            style={{ width: `${w * 100}%`, background: t.accent, opacity: 0.8 }}
          />
        ))}
      </div>

      <div className="relative grid grid-cols-3 gap-1">
        {/* The shared column rule that makes the board read as a table. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-1/3 w-px"
          style={{ background: t.accent, opacity: 0.35 }}
        />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="td-cover-line flex flex-col gap-[3px] rounded-[3px] p-1"
            style={{
              border: `1px solid ${t.rule}`,
              animationDelay: `${i * 50}ms`,
            }}
          >
            <span
              className={`${part} font-medium uppercase tracking-[0.18em]`}
              style={{ color: t.inkSoft }}
            >
              {`D${i + 1}`}
            </span>
            {/* Aligned label / value pairs — the structured read. */}
            {[0, 1].map((r) => (
              <span key={r} className="flex items-center gap-1">
                <span
                  className="h-px w-[38%] shrink-0"
                  style={{ background: t.accent, opacity: 0.65 }}
                />
                <span className="h-px flex-1" style={{ background: t.rule }} />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
