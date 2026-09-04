/**
 * Segmented conversion funnels — what actually drives minting.
 *
 * The headline funnel says how many people convert; this says *who*. One tab per
 * dimension (traffic source, device, browser, template), and inside each tab one
 * row per segment value showing its walk from landing to a minted dossier.
 *
 * Honesty rules baked into the visual:
 *   - a segment with fewer than the reporting floor of sessions shows counts and
 *     a "small sample" marker instead of a percentage, because a 100% mint rate
 *     off three visits is not a finding;
 *   - bars are drawn against the widest row in the tab, so relative volume is
 *     visible and a tiny segment cannot look like a winner.
 *
 * Structural types are declared locally so this component never imports the
 * server-only metrics module.
 */
import { useState } from "react";
import { Empty, SOFT_TEXT } from "./primitives";

type SegmentRow = {
  label: string;
  landed: number;
  browsed: number;
  composed: number;
  submitted: number;
  minted: number;
  mintRate: number | null;
  browseRate: number | null;
  small: boolean;
};

type SegmentGroup = {
  key: string;
  label: string;
  subtitle: string;
  rows: SegmentRow[];
};

const STEPS: Array<{ field: keyof Pick<SegmentRow, "landed" | "browsed" | "composed" | "submitted" | "minted">; label: string; color: string }> = [
  { field: "landed", label: "Landed", color: "var(--ink-soft)" },
  { field: "browsed", label: "Browsed", color: "var(--taupe)" },
  { field: "composed", label: "Composed", color: "var(--sunset-pink)" },
  { field: "submitted", label: "Submitted", color: "var(--seal-soft)" },
  { field: "minted", label: "Minted", color: "var(--seal)" },
];

export function SegmentFunnels({ groups }: { groups: SegmentGroup[] }) {
  const [active, setActive] = useState<string>(groups[0]?.key ?? "source");
  const group = groups.find((g) => g.key === active) ?? groups[0];
  if (!group) return <Empty />;

  const widest = Math.max(1, ...group.rows.map((r) => Math.max(r.landed, r.browsed)));

  return (
    <div>
      <div
        role="tablist"
        aria-label="Segment dimension"
        className="-mx-1 flex flex-wrap gap-1.5 overflow-x-auto pb-1"
      >
        {groups.map((g) => (
          <button
            key={g.key}
            type="button"
            role="tab"
            aria-selected={g.key === group.key}
            onClick={() => setActive(g.key)}
            className={
              "min-h-9 shrink-0 rounded-full border px-3.5 text-[10px] font-medium uppercase tracking-[0.18em] transition-colors motion-reduce:transition-none " +
              (g.key === group.key
                ? "border-sunset-pink/55 bg-sunset-pink/15 text-ink"
                : "border-ink/12 text-ink/55 hover:text-ink")
            }
          >
            {g.label}
          </button>
        ))}
      </div>

      <p className={"mt-3 text-xs leading-relaxed " + SOFT_TEXT}>{group.subtitle}</p>

      {/* Legend: reserved height, so nothing shifts when a tab changes. */}
      <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {STEPS.map((s) => (
          <li key={s.field} className={"flex items-center gap-1.5 text-[10px] " + SOFT_TEXT}>
            <span
              aria-hidden="true"
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: s.color }}
            />
            {s.label}
          </li>
        ))}
      </ul>

      {group.rows.length === 0 ? (
        <div className="mt-4">
          <Empty note="No segmented sessions in this period yet" />
        </div>
      ) : (
        <ol className="mt-4 flex flex-col gap-4">
          {group.rows.map((r) => (
            <li key={r.label}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="truncate text-xs text-ink/85">{r.label}</span>
                <span className="flex items-baseline gap-2">
                  {r.mintRate === null ? (
                    <span className={"text-[10px] uppercase tracking-[0.16em] " + SOFT_TEXT}>
                      {r.minted.toLocaleString()} / {Math.max(r.landed, r.browsed).toLocaleString()} · small
                      sample
                    </span>
                  ) : (
                    <>
                      <span
                        className="text-base tabular-nums"
                        style={{ fontFamily: "var(--font-display)", color: "var(--seal)" }}
                      >
                        {r.mintRate}%
                      </span>
                      <span className={"text-[10px] " + SOFT_TEXT}>
                        {r.minted.toLocaleString()} of {Math.max(r.landed, r.browsed).toLocaleString()}
                      </span>
                    </>
                  )}
                </span>
              </div>

              {/* Nested bars: each step drawn against the widest row in the tab. */}
              <div className="mt-1.5 flex flex-col gap-[3px]">
                {STEPS.map((s) => (
                  <div key={s.field} className="h-1.5 overflow-hidden rounded-full bg-ink/8">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, (r[s.field] / widest) * 100)}%`,
                        background: s.color,
                      }}
                    />
                  </div>
                ))}
              </div>

              <p className={"mt-1.5 text-[10px] tabular-nums " + SOFT_TEXT}>
                {STEPS.map((s) => `${s.label} ${r[s.field].toLocaleString()}`).join(" · ")}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
