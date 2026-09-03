/**
 * Admin console visual primitives.
 *
 * Built to be read over your shoulder by an investor: big honest numbers,
 * hairline rules, champagne/sunset accents from the TravelDoss palette, no
 * default chart-library purple. Every colour is a design token, every chart
 * reserves its height so nothing shifts as data lands, and every animation
 * yields to `prefers-reduced-motion` (recharts animation is switched off).
 */
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const GOLD = "var(--seal)";
const PINK = "var(--sunset-pink)";
const RUBY = "var(--tds-ruby)";
const INK_SOFT = "var(--ink-soft)";

/** Small-text colour that clears contrast on every surface (house rule 2). */
export const SOFT_TEXT = "text-[color-mix(in_oklab,var(--ink-soft)_78%,var(--ink))]";

export function Panel({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={
        "rounded-2xl border border-ink/10 bg-surface/40 p-5 backdrop-blur-sm md:p-6 " + className
      }
    >
      <header className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="td-eyebrow text-ink/70">{title}</h2>
          {subtitle ? <p className={"mt-1.5 text-xs leading-relaxed " + SOFT_TEXT}>{subtitle}</p> : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export function formatValue(value: number, format: "count" | "currency" | "percent" | "duration"): string {
  if (format === "currency") return `$${(value / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (format === "percent") return `${value}%`;
  if (format === "duration") return `${value}h`;
  return value.toLocaleString();
}

/** Period-over-period chip. Silent when there is no comparable prior number. */
function Delta({ value, previous }: { value: number; previous: number }) {
  if (previous <= 0) return <span className={"text-[10px] " + SOFT_TEXT}>no prior period</span>;
  const change = Math.round(((value - previous) / previous) * 1000) / 10;
  const up = change >= 0;
  return (
    <span
      className="text-[10px] font-medium tabular-nums"
      style={{ color: up ? GOLD : RUBY }}
    >
      {up ? "▲" : "▼"} {Math.abs(change)}% vs prior
    </span>
  );
}

export function KpiCard({
  label,
  value,
  previous,
  format,
  series,
  hint,
}: {
  label: string;
  value: number;
  previous: number;
  format: "count" | "currency" | "percent" | "duration";
  series: { date: string; value: number }[];
  hint: string;
}) {
  return (
    <article className="rounded-2xl border border-ink/10 bg-surface/40 p-4">
      <p className="td-eyebrow text-[9px] text-ink/55">{label}</p>
      <p
        className="mt-2 text-3xl leading-none text-ink tabular-nums"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {formatValue(value, format)}
      </p>
      <div className="mt-1.5">
        <Delta value={value} previous={previous} />
      </div>
      {/* Fixed height whether or not a sparkline exists, so the strip never shifts. */}
      <div className="mt-3 h-10">
        {series.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`spark-${label.replace(/\W/g, "")}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={GOLD} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke={GOLD}
                strokeWidth={1.25}
                fill={`url(#spark-${label.replace(/\W/g, "")})`}
                isAnimationActive={false}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : null}
      </div>
      <p className={"mt-2 text-[10px] leading-relaxed " + SOFT_TEXT}>{hint}</p>
    </article>
  );
}

type FunnelStep = {
  key: string;
  label: string;
  value: number;
  stepRate: number | null;
  overallRate: number;
};




/** The funnel as an actual tapering shape: columns per step, flow narrowing left→right. */
function FunnelShape({ steps }: { steps: FunnelStep[] }) {
  const cols = steps.length;
  const W = 1000;
  const H = 340;
  const w = W / cols;
  const top = 74;
  const bottom = H - 66;
  const max = Math.max(1, ...steps.map((s) => s.value));
  const cy = (top + bottom) / 2;
  const span = (bottom - top) / 2;

  // Two ghost bands behind the main flow give the shape depth, as in the brief.
  const ghost = (scale: number, offset: number) =>
    funnelPathScaled(steps, w, max, cy + offset, span * scale);

  return (
    <figure className="m-0" aria-hidden="true">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-[340px] w-full"
        preserveAspectRatio="none"
        role="presentation"
      >
        <defs>
          <linearGradient id="td-funnel-flow" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={GOLD} stopOpacity={0.85} />
            <stop offset="100%" stopColor={PINK} stopOpacity={0.85} />
          </linearGradient>
          <linearGradient id="td-funnel-ghost" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={GOLD} stopOpacity={0.14} />
            <stop offset="100%" stopColor={PINK} stopOpacity={0.1} />
          </linearGradient>
        </defs>

        <path d={ghost(1.16, -14)} fill="url(#td-funnel-ghost)" />
        <path d={ghost(1.08, 18)} fill="url(#td-funnel-ghost)" />
        <path d={funnelPathScaled(steps, w, max, cy, span)} fill="url(#td-funnel-flow)" />

        {steps.map((s, i) => (
          <line
            key={`rule-${s.key}`}
            x1={i * w}
            x2={i * w}
            y1={10}
            y2={H - 10}
            stroke="color-mix(in oklab, var(--ink) 14%, transparent)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
    </figure>
  );
}

function funnelPathScaled(
  steps: FunnelStep[],
  w: number,
  max: number,
  cy: number,
  span: number,
): string {
  const half = steps.map((s) => Math.max(2, (s.value / max) * span));
  const pts = (sign: 1 | -1) => {
    const seg: string[] = [];
    for (let i = 0; i < steps.length; i += 1) {
      const x0 = i * w;
      const flatEnd = x0 + w * 0.6;
      const y = cy + sign * half[i];
      seg.push(`L ${x0} ${y}`, `L ${flatEnd} ${y}`);
      if (i < steps.length - 1) {
        const nx = (i + 1) * w;
        const ny = cy + sign * half[i + 1];
        const mid = (flatEnd + nx) / 2;
        seg.push(`C ${mid} ${y} ${mid} ${ny} ${nx} ${ny}`);
      } else {
        seg.push(`L ${steps.length * w} ${y}`);
      }
    }
    return seg;
  };
  const topSeg = pts(-1);
  // The bottom edge is traced right→left so the outline closes cleanly.
  const bottomPoints = bottomEdgePoints(steps, w, half, cy);
  return `M 0 ${cy - half[0]} ${topSeg.join(" ").replace(/^L 0 [^ ]+ /, "")} ${bottomPoints} Z`;
}

/** Bottom edge traced right→left as straight-ish segments (mirrors the top). */
function bottomEdgePoints(steps: FunnelStep[], w: number, half: number[], cy: number): string {
  const seg: string[] = [];
  for (let i = steps.length - 1; i >= 0; i -= 1) {
    const y = cy + half[i];
    const x1 = (i + 1) * w;
    const flatStart = i * w + w * 0.6;
    seg.push(`L ${x1} ${y}`);
    if (i > 0) {
      const py = cy + half[i - 1];
      const prevFlatEnd = (i - 1) * w + w * 0.6;
      const mid = (prevFlatEnd + i * w) / 2;
      seg.push(`L ${flatStart} ${y}`, `L ${i * w} ${y}`, `C ${mid} ${y} ${mid} ${py} ${prevFlatEnd} ${py}`);
    } else {
      seg.push(`L 0 ${y}`);
    }
  }
  return seg.join(" ");
}

/**
 * Conversion funnel. Desktop gets the tapering flow shape with a column per
 * step; mobile keeps the stacked bars (a 9-column funnel is unreadable at
 * 375px) and stays available to screen readers on every size.
 */
export function Funnel({ steps }: { steps: FunnelStep[] }) {
  return (
    <div>
      {/* Desktop: the funnel proper. */}
      <div className="hidden md:block">
        <div className="relative">
          <div
            className="absolute inset-x-0 top-0 grid"
            style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
          >
            {steps.map((s) => (
              <p
                key={`h-${s.key}`}
                className="td-eyebrow px-2 pt-1 text-center text-[9px] leading-snug text-ink/60"
              >
                {s.label}
              </p>
            ))}
          </div>

          <FunnelShape steps={steps} />

          <div
            className="pointer-events-none absolute inset-0 grid items-center"
            style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
          >
            {steps.map((s) => (
              <p
                key={`p-${s.key}`}
                className="text-center text-2xl leading-none text-ink tabular-nums"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {s.overallRate}%
              </p>
            ))}
          </div>

          <div
            className="absolute inset-x-0 bottom-0 grid"
            style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
          >
            {steps.map((s, i) => {
              const lost = i > 0 ? Math.max(0, steps[i - 1].value - s.value) : 0;
              return (
                <p key={`f-${s.key}`} className={"px-2 text-center text-[10px] tabular-nums " + SOFT_TEXT}>
                  {s.value.toLocaleString()}
                  {i > 0 && lost > 0 ? (
                    <span style={{ color: RUBY }}> · −{lost.toLocaleString()}</span>
                  ) : null}
                </p>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mobile: stacked bars. Visually hidden on desktop, still read aloud. */}
      <ol className="flex flex-col gap-3 md:sr-only">
        {steps.map((s, i) => {
          const lost = i > 0 ? Math.max(0, steps[i - 1].value - s.value) : 0;
          return (
            <li key={s.key}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm text-ink/85">{s.label}</span>
                <span className="text-xs tabular-nums text-ink/70">
                  {s.value.toLocaleString()}
                  <span className={"ml-2 " + SOFT_TEXT}>{s.overallRate}% of all</span>
                </span>
              </div>
              <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-ink/8">
                <div
                  className="h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none"
                  style={{
                    width: `${Math.max(s.overallRate, s.value > 0 ? 1.5 : 0)}%`,
                    background: `linear-gradient(90deg, ${GOLD}, ${PINK})`,
                  }}
                />
              </div>
              {i > 0 && lost > 0 ? (
                <p className={"mt-1 text-[10px] tabular-nums " + SOFT_TEXT}>
                  {s.stepRate}% continued
                  <span style={{ color: RUBY }}> · {lost.toLocaleString()} dropped off</span>
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}


const tooltipStyle = {
  contentStyle: {
    background: "var(--paper)",
    border: "1px solid color-mix(in oklab, var(--ink) 15%, transparent)",
    borderRadius: 12,
    fontSize: 11,
    color: "var(--ink)",
  },
  labelStyle: { color: "var(--ink-soft)", fontSize: 10 },
} as const;

const axisProps = {
  stroke: "color-mix(in oklab, var(--ink) 25%, transparent)",
  tick: { fill: "var(--ink-soft)", fontSize: 10 },
  tickLine: false,
} as const;

export function TrendChart({
  data,
  seriesB,
  labelA,
  labelB,
  height = 220,
}: {
  data: { date: string; value: number }[];
  seriesB?: { date: string; value: number }[];
  labelA: string;
  labelB?: string;
  height?: number;
}) {
  const merged = data.map((d, i) => ({
    date: d.date.slice(5),
    a: d.value,
    b: seriesB?.[i]?.value ?? 0,
  }));
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={merged} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
          <XAxis dataKey="date" {...axisProps} interval="preserveStartEnd" />
          <YAxis {...axisProps} allowDecimals={false} width={36} />
          <Tooltip {...tooltipStyle} />
          <Line
            type="monotone"
            dataKey="a"
            name={labelA}
            stroke={GOLD}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
          {seriesB ? (
            <Line
              type="monotone"
              dataKey="b"
              name={labelB ?? "B"}
              stroke={PINK}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          ) : null}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BarList({ slices, max = 8 }: { slices: { label: string; value: number }[]; max?: number }) {
  const rows = slices.slice(0, max);
  const top = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <Empty />;
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-xs text-ink/80">{r.label}</span>
            <span className="text-xs tabular-nums text-ink/70">{r.value.toLocaleString()}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink/8">
            <div
              className="h-full rounded-full"
              style={{ width: `${(r.value / top) * 100}%`, background: GOLD }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

const DONUT_COLORS = [GOLD, PINK, INK_SOFT, RUBY, "var(--seal-soft)", "var(--taupe)"];

export function Donut({ slices, height = 200 }: { slices: { label: string; value: number }[]; height?: number }) {
  if (slices.length === 0) return <div style={{ height }}><Empty /></div>;
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={slices}
            dataKey="value"
            nameKey="label"
            innerRadius="58%"
            outerRadius="86%"
            stroke="var(--paper)"
            strokeWidth={2}
            isAnimationActive={false}
          >
            {slices.map((s, i) => (
              <Cell key={s.label} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip {...tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Histogram({ slices, height = 200 }: { slices: { label: string; value: number }[]; height?: number }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={slices} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
          <XAxis dataKey="label" {...axisProps} />
          <YAxis {...axisProps} allowDecimals={false} width={34} />
          <Tooltip {...tooltipStyle} />
          <Bar dataKey="value" fill={PINK} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Empty({ note = "No data in this period yet" }: { note?: string }) {
  return (
    <p className={"flex h-full min-h-16 items-center text-xs italic " + SOFT_TEXT}>{note}</p>
  );
}

/** Reserved-height loading block, so arriving data never shifts the layout. */
export function Skeleton({ height = 200 }: { height?: number }) {
  return (
    <div
      className="animate-pulse rounded-xl bg-ink/8 motion-reduce:animate-none"
      style={{ height }}
      aria-hidden="true"
    />
  );
}
