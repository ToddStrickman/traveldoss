/**
 * Public investor snapshot — /admin/s/:token.
 *
 * No sign-in: the random token is the credential. Frozen aggregate numbers
 * only, with an "as of" stamp so nobody reads it as live, and noindex so it
 * never reaches a search result. Expired and revoked links show the same
 * neutral "link isn't available" page as an unknown one.
 */
import { createFileRoute } from "@tanstack/react-router";
import { getAdminSnapshot } from "@/lib/admin-snapshot.functions";
import {
  BarList,
  Donut,
  Empty,
  Funnel,
  Histogram,
  KpiCard,
  Panel,
  SOFT_TEXT,
  TrendChart,
  formatValue,
} from "@/components/admin/primitives";

export const Route = createFileRoute("/admin/s/$token")({
  loader: ({ params }) => getAdminSnapshot({ data: { token: params.token } }),
  component: SnapshotPage,
  head: () => ({
    meta: [
      { title: "TravelDoss — snapshot" },
      { name: "description", content: "A frozen, read-only snapshot of TravelDoss operating metrics." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});

function stamp(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function SnapshotPage() {
  const snapshot = Route.useLoaderData();

  if (!snapshot) {
    return (
      <main className="mx-auto max-w-md px-5 py-24 text-center">
        <h1 className="td-eyebrow text-ink/70">This link isn’t available</h1>
        <p className={"mt-3 text-sm " + SOFT_TEXT}>
          Snapshot links expire after a set time and can be withdrawn. Ask for a fresh one.
        </p>
      </main>
    );
  }

  const m = snapshot.metrics;

  return (
    <main className="relative min-h-dvh bg-background text-foreground">
      <div aria-hidden className="td-grain fixed inset-0 z-0" />
      <div className="relative z-10 mx-auto max-w-[1400px] px-5 py-10 md:px-8 md:py-14">
        <header className="border-b border-ink/10 pb-6">
          <p className="td-eyebrow text-[10px] text-ink/55">TravelDoss · snapshot</p>
          <h1
            className="mt-3 text-3xl leading-tight text-ink md:text-4xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {snapshot.label ?? `Last ${snapshot.rangeDays} days`}
          </h1>
          <p className={"mt-2 text-xs " + SOFT_TEXT}>
            As of {stamp(snapshot.createdAt)} · {snapshot.rangeDays}-day window · link expires{" "}
            {stamp(snapshot.expiresAt)}. Figures are frozen at capture and do not update.
          </p>
        </header>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {m.kpis.map((k) => (
            <KpiCard
              key={k.key}
              label={k.label}
              value={k.value}
              previous={k.previous}
              format={k.format}
              series={k.series}
              hint={k.hint}
            />
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Panel
            title="Conversion funnel"
            subtitle={`Sessions reaching each step · as of ${stamp(snapshot.createdAt)}`}
            className="lg:col-span-2"
          >
            <Funnel steps={m.funnel} />
          </Panel>
          <Panel title="Traffic vs. mints" subtitle={`As of ${stamp(snapshot.createdAt)}`}>
            <TrendChart data={m.traffic} seriesB={m.mints} labelA="Page views" labelB="Mints" />
          </Panel>
        </div>

        {/* Older snapshots were frozen before segments existed, hence the guard. */}
        {(m.segments ?? []).length > 0 ? (
          <div className="mt-4">
            <Panel
              title="What drives minting"
              subtitle={`Funnel by source, device, browser and template · as of ${stamp(snapshot.createdAt)}`}
            >
              <SegmentFunnels groups={m.segments} />
            </Panel>
          </div>
        ) : null}



        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Panel title="Dossier depth" subtitle={`As of ${stamp(snapshot.createdAt)}`}>
            <Histogram slices={m.engagement.depth} />
          </Panel>
          <Panel title="Where they're going" subtitle={`As of ${stamp(snapshot.createdAt)}`}>
            {m.destinations.length === 0 ? <Empty /> : <BarList slices={m.destinations} />}
          </Panel>
          <Panel title="Preferred layout" subtitle={`As of ${stamp(snapshot.createdAt)}`}>
            <Donut slices={m.browseModes} />
          </Panel>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Panel title="Revenue" subtitle={`Settled payments only · as of ${stamp(snapshot.createdAt)}`}>
            {m.revenue.live ? (
              <>
                <p
                  className="text-4xl leading-none text-ink tabular-nums"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {formatValue(m.revenue.grossCents, "currency")}
                </p>
                <p className={"mt-2 text-xs " + SOFT_TEXT}>
                  {m.revenue.paidMints.toLocaleString()} paid mints · {m.revenue.renewals.toLocaleString()}{" "}
                  renewals
                </p>
              </>
            ) : (
              <p className={"text-xs leading-relaxed " + SOFT_TEXT}>
                Payments are not switched on yet, so there is nothing to report here. This panel stays
                empty on purpose rather than showing a zero.
              </p>
            )}
          </Panel>
          <Panel title="Signup cohorts" subtitle="Share of each signup week that minted a dossier." className="lg:col-span-2">
            {m.cohorts.length === 0 ? (
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
        </div>

        <p className={"mt-8 text-[10px] " + SOFT_TEXT}>
          Aggregate, first-party measurement. No personal data, no itinerary content, no individual
          dossiers.
        </p>
      </div>
    </main>
  );
}
