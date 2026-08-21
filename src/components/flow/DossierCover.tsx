/**
 * DossierCover — the abstract dossier "object" used wherever we show a
 * template as a thing you can pick up rather than a page you can read.
 *
 * Deliberately NOT a shrunken render of the demo itinerary: at cover size
 * real type turns to grey mush and, worse, makes every template look like
 * it's about the same city. Instead each cover is drawn from that skin's own
 * tokens — foil edge, accent spine, wax seal — plus placeholder rule work
 * for Morning / Evening / Night so the shape of a day reads instantly.
 *
 * Fills its parent; the parent owns dimensions so layout never shifts.
 */
import type { SkinModule } from "@/lib/skins/types";

/** Which layout's unique benefit the placeholder art should express. */
export type CoverVariant = "horizontal" | "vertical" | "grid";

export function DossierCoverArt({
  skin,
  selected = true,
  /** Scales the interior type/rules for smaller or larger cover slots. */
  size = "md",
  /** Placeholder art matches the layout being browsed: sideways day cards
   *  (horizontal), one flowing ribbon (vertical), a day board (grid). */
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

        {/* Layout preview — placeholder rule work standing in for the
            itinerary, shaped like the layout you're browsing. */}
        <div className={`mt-auto flex flex-col ${s.gap}`} aria-hidden>
          {variant === "grid" ? (
            <GridArt t={t} part={s.part} />
          ) : variant === "horizontal" ? (
            <HorizontalArt t={t} part={s.part} />
          ) : (
            <VerticalArt t={t} part={s.part} gap={s.gap} />
          )}
          <span
            className={`${s.part} font-medium uppercase tracking-[0.28em]`}
            style={{ color: `color-mix(in oklab, ${t.inkSoft} 88%, ${t.ink})` }}
          >
            {variant === "grid"
              ? "The whole trip at a glance"
              : variant === "horizontal"
                ? "One day at a time"
                : "The full read, top to bottom"}
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
