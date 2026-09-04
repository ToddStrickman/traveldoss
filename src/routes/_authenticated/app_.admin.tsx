/**
 * Private intelligence console — /app/admin.
 *
 * Hidden by role, not by obscurity: the rail button only renders for admins,
 * and every query behind this page re-verifies the role server-side. Non-admins
 * who reach the URL get a quiet "not available" panel rather than a hint that
 * something is here.
 *
 * `app_.admin` (trailing underscore) keeps the URL at /app/admin while opting
 * out of nesting inside the dashboard route, which renders no <Outlet />.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { ArrowLeft, Download, RefreshCw } from "lucide-react";
import { getAdminMetrics, getLiveFeed, isAdmin as isAdminFn } from "@/lib/admin.functions";
import {
  BarList,
  Donut,
  Empty,
  Funnel,
  Histogram,
  KpiCard,
  Panel,
  Skeleton,
  SOFT_TEXT,
  TrendChart,
  formatValue,
} from "@/components/admin/primitives";

export const Route = createFileRoute("/_authenticated/app_/admin")({
  component: AdminConsole,
  head: () => ({
    meta: [
      { title: "Intelligence console — TravelDoss" },
      {
        name: "description",
        content: "Private TravelDoss operating metrics: acquisition, mint conversion and engagement.",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});

const RANGES = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: 365, label: "12 months" },
] as const;

function csvEscape(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(name: string, rows: (string | number)[][]): void {
  const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function AdminConsole() {
  const [days, setDays] = useState<number>(30);
  const adminFn = useServerFn(isAdminFn);
  const metricsFn = useServerFn(getAdminMetrics);
  const feedFn = useServerFn(getLiveFeed);

  const gate = useQuery({ queryKey: ["admin-gate"], queryFn: () => adminFn() });
  const allowed = gate.data?.admin === true;

  const metrics = useQuery({
    queryKey: ["admin-metrics", days],
    queryFn: () => metricsFn({ data: { days } }),
    enabled: allowed,
  });

  const feed = useQuery({
    queryKey: ["admin-feed"],
    queryFn: () => feedFn({ data: { limit: 50 } }),
    enabled: allowed,
    refetchInterval: 30_000,
  });

  const m = metrics.data;

  const exportRows = useMemo(() => {
    if (!m) return [];
    const rows: (string | number)[][] = [["metric", "value"]];
    for (const k of m.kpis) rows.push([k.label, k.value]);
    rows.push([], ["funnel step", "sessions", "% of all", "% continued"]);
    for (const s of m.funnel) rows.push([s.label, s.value, s.overallRate, s.stepRate ?? ""]);
    rows.push([], ["template", "previews", "submits", "mints", "reads"]);
    for (const t of m.templates) rows.push([t.templateId, t.previews, t.submits, t.mints, t.views]);
    return rows;
  }, [m]);

  if (gate.isLoading) {
    return (
      <main className="mx-auto max-w-[1500px] px-5 py-16 md:px-8">
        <Skeleton height={120} />
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="mx-auto max-w-md px-5 py-24 text-center">
        <h1 className="td-eyebrow text-ink/70">Not available</h1>
        <p className={"mt-3 text-sm " + SOFT_TEXT}>
          This area isn’t part of your account.
        </p>
        <Link to="/app" className="mt-6 inline-flex items-center gap-2 td-eyebrow text-seal">
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.25} aria-hidden="true" />
          Back to your trips
        </Link>
      </main>
    );
  }

  return (
    <main className="relative min-h-dvh bg-background text-foreground">
      <div aria-hidden className="td-grain fixed inset-0 z-0" />
      <div className="relative z-10 mx-auto max-w-[1500px] px-5 py-8 md:px-8 md:py-12">
        <header className="flex flex-wrap items-end justify-between gap-5 border-b border-ink/10 pb-6">
          <div>
            <Link to="/app" className="inline-flex items-center gap-2 td-eyebrow text-ink/55 hover:text-seal">
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.25} aria-hidden="true" />
              Your trips
            </Link>
            <h1
              className="mt-3 text-3xl leading-tight text-ink md:text-4xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Intelligence console
            </h1>
            <p className={"mt-2 max-w-xl text-xs leading-relaxed " + SOFT_TEXT}>
              Acquisition, mint conversion and building behaviour, measured first-party. Counts and
              lengths only — no emails, no itinerary text.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              role="radiogroup"
              aria-label="Date range"
              className="flex overflow-hidden rounded-full border border-sunset-pink/45"
            >
              {RANGES.map((r) => (
                <button
                  key={r.days}
                  type="button"
                  role="radio"
                  aria-checked={days === r.days}
                  onClick={() => setDays(r.days)}
                  className={
                    "min-h-9 px-3.5 text-[10px] font-medium uppercase tracking-[0.18em] transition-colors motion-reduce:transition-none " +
                    (days === r.days ? "bg-sunset-pink/15 text-ink" : "text-ink/55 hover:text-ink")
                  }
                >
                  {r.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void metrics.refetch()}
              className="inline-flex min-h-9 items-center gap-2 rounded-full border border-ink/15 px-3.5 td-eyebrow text-[10px] text-ink/65 hover:border-seal hover:text-seal"
            >
              <RefreshCw
                className={"h-3.5 w-3.5 " + (metrics.isFetching ? "animate-spin motion-reduce:animate-none" : "")}
                strokeWidth={1.25}
                aria-hidden="true"
              />
              Refresh
            </button>
            <button
              type="button"
              disabled={exportRows.length === 0}
              onClick={() => downloadCsv(`traveldoss-metrics-${days}d.csv`, exportRows)}
              className="inline-flex min-h-9 items-center gap-2 rounded-full border border-ink/15 px-3.5 td-eyebrow text-[10px] text-ink/65 hover:border-seal hover:text-seal disabled:opacity-40"
            >
              <Download className="h-3.5 w-3.5" strokeWidth={1.25} aria-hidden="true" />
              Export CSV
            </button>
          </div>
        </header>

        {metrics.isError ? (
          <p className="mt-8 text-sm" style={{ color: "var(--tds-ruby)" }}>
            Metrics didn’t load. Try Refresh.
          </p>
        ) : null}

        {/* KPI strip */}
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {m
            ? m.kpis.map((k) => (
                <KpiCard
                  key={k.key}
                  label={k.label}
                  value={k.value}
                  previous={k.previous}
                  format={k.format}
                  series={k.series}
                  hint={k.hint}
                />
              ))
            : Array.from({ length: 8 }, (_, i) => <Skeleton key={i} height={168} />)}
        </div>

        {/* The three questions, answered plainly */}
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            { label: "Chose to browse templates", value: m?.headline.browsedTemplates },
            { label: "Actually minted a template", value: m?.headline.mintedTemplate },
            { label: "Engaged with building a dossier", value: m?.headline.engagedBuilding },
          ].map((q) => (
            <article
              key={q.label}
              className="rounded-2xl border border-sunset-pink/30 bg-sunset-pink/[0.03] p-5"
            >
              <p className="td-eyebrow text-[9px] text-ink/55">{q.label}</p>
              <p
                className="mt-2 text-4xl leading-none text-ink tabular-nums"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {q.value === undefined ? "—" : q.value.toLocaleString()}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Panel
            title="Conversion funnel"
            subtitle="Sessions reaching each step, with drop-off between them."
            className="lg:col-span-2"
          >
            {m ? <Funnel steps={m.funnel} /> : <Skeleton height={320} />}
          </Panel>

          <Panel title="Traffic vs. mints" subtitle="Page views (gold) against dossiers minted (pink).">
            {m ? (
              <TrendChart data={m.traffic} seriesB={m.mints} labelA="Page views" labelB="Mints" />
            ) : (
              <Skeleton height={220} />
            )}
          </Panel>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Panel title="Template performance" subtitle="Interest against mints, by dossier template." className="lg:col-span-2">
            {!m ? (
              <Skeleton height={240} />
            ) : m.templates.length === 0 ? (
              <Empty />
            ) : (
              <div className="-mx-2 overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-xs">
                  <thead>
                    <tr className={"td-eyebrow text-[9px] " + SOFT_TEXT}>
                      <th className="px-2 py-2 font-normal">Template</th>
                      <th className="px-2 py-2 text-right font-normal">Previews</th>
                      <th className="px-2 py-2 text-right font-normal">Submits</th>
                      <th className="px-2 py-2 text-right font-normal">Mints</th>
                      <th className="px-2 py-2 text-right font-normal">Reads</th>
                      <th className="px-2 py-2 text-right font-normal">Mint rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.templates.map((t) => (
                      <tr key={t.templateId} className="border-t border-ink/8">
                        <td className="px-2 py-2.5 text-ink/85">{t.templateId}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums text-ink/70">{t.previews}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums text-ink/70">{t.submits}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums text-ink">{t.mints}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums text-ink/70">{t.views}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums" style={{ color: "var(--seal)" }}>
                          {t.mintRate}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel title="Preferred layout" subtitle="Which browse view people switch to.">
            {m ? <Donut slices={m.browseModes} /> : <Skeleton height={200} />}
          </Panel>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Panel title="Dossier depth" subtitle="Days per minted dossier — how much people actually build.">
            {m ? <Histogram slices={m.engagement.depth} /> : <Skeleton height={200} />}
          </Panel>

          <Panel title="Building intensity" subtitle="Assembly and enrichment per dossier.">
            {m ? (
              <dl className="grid grid-cols-2 gap-4">
                {[
                  ["Dossiers with content", m.engagement.tripsWithContent.toLocaleString()],
                  ["Avg. blocks", String(m.engagement.avgBlocks)],
                  ["Avg. days", String(m.engagement.avgDays)],
                  ["With photos", m.engagement.photoTrips.toLocaleString()],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className={"td-eyebrow text-[9px] " + SOFT_TEXT}>{k}</dt>
                    <dd
                      className="mt-1.5 text-2xl text-ink tabular-nums"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {v}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <Skeleton height={200} />
            )}
          </Panel>

          <Panel title="Feature adoption" subtitle="Most-fired product moments in the period.">
            {m ? <BarList slices={m.featureAdoption} /> : <Skeleton height={200} />}
          </Panel>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Panel title="Where they're going" subtitle="Top destinations across minted dossiers.">
            {m ? <BarList slices={m.destinations} /> : <Skeleton height={200} />}
          </Panel>

          <Panel title="Signup cohorts" subtitle="Share of each signup week that minted a dossier.">
            {!m ? (
              <Skeleton height={200} />
            ) : m.cohorts.length === 0 ? (
              <Empty />
            ) : (
              <ul className="flex flex-col gap-2">
                {m.cohorts.map((c) => (
                  <li key={c.week} className="flex items-center gap-3">
                    <span className={"w-20 shrink-0 text-[10px] tabular-nums " + SOFT_TEXT}>
                      {c.week.slice(5)}
                    </span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-ink/8">
                      <span
                        className="block h-full rounded-full"
                        style={{ width: `${c.rate}%`, background: "var(--sunset-pink)" }}
                      />
                    </span>
                    <span className="w-24 shrink-0 text-right text-[10px] tabular-nums text-ink/70">
                      {c.minted}/{c.signups} · {c.rate}%
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* Revenue reads the payments ledger only. Before the first settled
              payment exists it says so plainly — a "$0" and a flat line would
              read as a failing business rather than an unbuilt one. */}
          <Panel title="Revenue" subtitle="Settled payments in the ledger only — never a client claim.">
            {!m ? (
              <Skeleton height={200} />
            ) : !m.revenue.live ? (
              <div>
                <p className="td-eyebrow text-[9px] text-ink/55">Revenue not switched on yet</p>
                <p className={"mt-3 text-xs leading-relaxed " + SOFT_TEXT}>
                  Paddle is the merchant of record and the checkout isn’t live, so the ledger has no rows.
                  This panel stays empty on purpose: it will fill itself the moment the first payment
                  settles, and never shows a number the ledger can’t back.
                </p>
                <dl className="mt-4 grid grid-cols-2 gap-3">
                  {[
                    ["Provider", "Paddle"],
                    ["Charges", "Mint + keep-alive renewal"],
                    ["Ledger rows", "0"],
                    ["Source of truth", "Verified webhook only"],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt className={"td-eyebrow text-[9px] " + SOFT_TEXT}>{k}</dt>
                      <dd className="mt-1 text-xs text-ink/85">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : (
              <>
                <p
                  className="text-4xl leading-none text-ink tabular-nums"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {formatValue(m.revenue.grossCents, "currency")}
                </p>
                <p className={"mt-2 text-xs " + SOFT_TEXT}>
                  {m.revenue.paidMints.toLocaleString()} paid mints · {m.revenue.renewals.toLocaleString()}{" "}
                  renewals · net {formatValue(m.revenue.netCents, "currency")}
                  {m.revenue.refundedCents > 0
                    ? ` · ${formatValue(m.revenue.refundedCents, "currency")} refunded`
                    : ""}
                </p>
                <div className="mt-3">
                  <TrendChart data={m.revenue.series} labelA="Revenue" height={120} />
                </div>
              </>
            )}
          </Panel>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Panel title="Friction" subtitle="Where people hit a wall. Lower is better.">
            {m ? <BarList slices={m.friction} max={6} /> : <Skeleton height={180} />}
          </Panel>

          <Panel
            title="Live activity"
            subtitle="Last 50 events, refreshed every 30 seconds. Sessions are truncated on purpose."
            className="lg:col-span-2"
          >
            {!feed.data ? (
              <Skeleton height={260} />
            ) : feed.data.length === 0 ? (
              <Empty note="No events recorded yet" />
            ) : (
              <ul className="max-h-72 overflow-y-auto pr-1">
                {feed.data.map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-ink/8 py-2 text-xs last:border-0"
                  >
                    <span className={"w-16 shrink-0 tabular-nums " + SOFT_TEXT}>
                      {new Date(r.occurredAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="text-ink/85">{r.event}</span>
                    {r.templateId ? <span style={{ color: "var(--seal)" }}>{r.templateId}</span> : null}
                    {r.path ? <span className={SOFT_TEXT}>{r.path}</span> : null}
                    {r.session ? <span className={"ml-auto tabular-nums " + SOFT_TEXT}>#{r.session}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <p className={"mt-8 text-[10px] " + SOFT_TEXT}>
          {m ? `${m.eventsTracked.toLocaleString()} events in range · ` : ""}
          First-party measurement. Anonymous sessions, aggregate counts, no personal data.
        </p>
      </div>
    </main>
  );
}
