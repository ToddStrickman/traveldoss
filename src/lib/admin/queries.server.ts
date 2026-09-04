/**
 * Admin console metrics. Server-only: every function here runs with the service
 * role, so it must never be reachable from a client bundle (the `.server.ts`
 * suffix is enforced by the build's import protection) and must only be called
 * after the caller's admin role has been verified.
 *
 * Two data sources, deliberately:
 *   1. Ground truth from tables the product already writes — trips (mints),
 *      trip_access_events (views/exports), purchases (revenue),
 *      profiles (signups). These have real history from day one.
 *   2. product_events for moments no table records (browsing, composing,
 *      failures). Anonymous, counts and lengths only.
 *
 * Nothing in here returns an email, a pasted itinerary, block content, or a
 * dossier slug — the console is a business instrument, not a data leak.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface Point {
  date: string;
  value: number;
}

export interface FunnelStep {
  key: string;
  label: string;
  value: number;
  /** % of the previous step that reached this one. `null` for the first step. */
  stepRate: number | null;
  /** % of the top of the funnel that reached this one. */
  overallRate: number;
}

export interface Kpi {
  key: string;
  label: string;
  value: number;
  /** Same-length previous period, for the delta chip. */
  previous: number;
  format: "count" | "currency" | "percent" | "duration";
  series: Point[];
  hint: string;
}

export interface TemplateRow {
  templateId: string;
  previews: number;
  submits: number;
  mints: number;
  views: number;
  mintRate: number;
}

export interface Slice {
  label: string;
  value: number;
}

export interface CohortRow {
  week: string;
  signups: number;
  minted: number;
  rate: number;
}

/** One segment value's walk down the funnel (sessions, not page views). */
export interface SegmentRow {
  label: string;
  landed: number;
  browsed: number;
  composed: number;
  submitted: number;
  minted: number;
  /** Landed → minted, as a %. `null` when the base is too small to mean anything. */
  mintRate: number | null;
  /** Landed → browsed, as a %. `null` below the reporting floor. */
  browseRate: number | null;
  /** True when this row is below SMALL_N: read the counts, not the rates. */
  small: boolean;
}

export interface SegmentGroup {
  key: "source" | "device" | "browser" | "template";
  label: string;
  subtitle: string;
  rows: SegmentRow[];
}

/**
 * Below this many sessions a percentage is noise dressed as a finding, so the
 * rates come back null and the console shows the raw counts instead.
 */
export const SMALL_N = 20;

export interface AdminMetrics {
  range: { days: number; from: string; to: string };
  eventsTracked: number;
  kpis: Kpi[];
  funnel: FunnelStep[];
  headline: { browsedTemplates: number; mintedTemplate: number; engagedBuilding: number };
  traffic: Point[];
  mints: Point[];
  templates: TemplateRow[];
  browseModes: Slice[];
  featureAdoption: Slice[];
  destinations: Slice[];
  engagement: {
    tripsWithContent: number;
    avgBlocks: number;
    avgDays: number;
    photoTrips: number;
    depth: Slice[];
  };
  cohorts: CohortRow[];
  revenue: {
    grossCents: number;
    netCents: number;
    paidMints: number;
    renewals: number;
    refundedCents: number;
    currency: string;
    series: Point[];
    /** False until the payment ledger has its first row — the panel then says so. */
    live: boolean;
    /** Rows in the ledger, all time, regardless of range. */
    ledgerRows: number;
  };
  friction: Slice[];
}

export interface FeedRow {
  id: string;
  occurredAt: string;
  event: string;
  templateId: string | null;
  path: string | null;
  session: string | null;
}

/* ------------------------------------------------------------------ helpers */

const DAY_MS = 86_400_000;

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

/** Zero-filled daily series so a quiet day is a visible zero, not a gap. */
function series(dates: string[], stamps: string[]): Point[] {
  const counts = new Map<string, number>(dates.map((d) => [d, 0]));
  for (const s of stamps) {
    const k = dayKey(s);
    if (counts.has(k)) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return dates.map((date) => ({ date, value: counts.get(date) ?? 0 }));
}

function dateSpan(from: Date, days: number): string[] {
  return Array.from({ length: days }, (_, i) =>
    new Date(from.getTime() + i * DAY_MS).toISOString().slice(0, 10),
  );
}

function tally<T>(rows: T[], key: (row: T) => string | null): Slice[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = key(r);
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;
}

function weekKey(iso: string): string {
  const d = new Date(iso);
  const day = (d.getUTCDay() + 6) % 7; // Monday-based
  return new Date(d.getTime() - day * DAY_MS).toISOString().slice(0, 10);
}

interface EventRow {
  event: string;
  occurred_at: string;
  session_id: string | null;
  template_id: string | null;
  path: string | null;
  props: Record<string, unknown> | null;
}

/** Distinct anonymous sessions that fired any of these events. */
function sessions(rows: EventRow[], match: (r: EventRow) => boolean): number {
  const s = new Set<string>();
  let anonymous = 0;
  for (const r of rows) {
    if (!match(r)) continue;
    if (r.session_id) s.add(r.session_id);
    else anonymous++;
  }
  return s.size + anonymous;
}

const BROWSE_EVENTS = new Set([
  "template_previewed",
  "template_picked",
  "template_switched",
  "template_browse_mode_changed",
]);

const ENGAGE_EVENTS = new Set([
  "compose_opened",
  "mint_input_ready",
  "mint_submitted",
  "template_picked",
  "access_trail_opened",
  "guide_clone",
]);

/* -------------------------------------------------------------------- query */

export async function loadAdminMetrics(days: number): Promise<AdminMetrics> {
  const to = new Date();
  const from = new Date(to.getTime() - (days - 1) * DAY_MS);
  const fromIso = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()))
    .toISOString();
  const prevFromIso = new Date(new Date(fromIso).getTime() - days * DAY_MS).toISOString();
  const dates = dateSpan(new Date(fromIso), days);

  const [
    events,
    prevEvents,
    trips,
    prevTrips,
    access,
    purchases,
    ledgerCount,
    profiles,
    prevProfiles,
    contacts,
  ] = await Promise.all([
      supabaseAdmin
        .from("product_events")
        .select("event, occurred_at, session_id, template_id, path, props")
        .gte("occurred_at", fromIso)
        .order("occurred_at", { ascending: true })
        .limit(50_000),
      supabaseAdmin
        .from("product_events")
        .select("event, occurred_at, session_id")
        .gte("occurred_at", prevFromIso)
        .lt("occurred_at", fromIso)
        .limit(50_000),
      supabaseAdmin
        .from("trips")
        .select("id, created_at, template_id, destination, content, user_id, visibility")
        .gte("created_at", fromIso)
        .limit(5_000),
      supabaseAdmin.from("trips").select("id").gte("created_at", prevFromIso).lt("created_at", fromIso),
      supabaseAdmin
        .from("trip_access_events")
        .select("event_type, occurred_at, trip_id, is_owner")
        .gte("occurred_at", fromIso)
        .limit(50_000),
      /* The payment ledger. Written only by verified provider webhooks, so a
         row here is money that actually moved. `trip_entitlements` is the May
         model and is deliberately never read. */
      supabaseAdmin
        .from("purchases")
        .select("gross_cents, net_cents, currency, kind, status, paid_at")
        .gte("paid_at", prevFromIso)
        .limit(10_000),
      /* All-time ledger size: tells the panel whether payments exist at all,
         so an empty range reads "not switched on yet" instead of "$0". */
      supabaseAdmin.from("purchases").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("profiles").select("user_id, created_at").gte("created_at", fromIso),
      supabaseAdmin
        .from("profiles")
        .select("user_id")
        .gte("created_at", prevFromIso)
        .lt("created_at", fromIso),
      supabaseAdmin.from("contact_messages").select("category, created_at").gte("created_at", fromIso),
    ]);

  const ev = (events.data ?? []) as EventRow[];
  const prevEv = (prevEvents.data ?? []) as Pick<EventRow, "event" | "occurred_at" | "session_id">[];
  const tripRows = trips.data ?? [];
  const accessRows = access.data ?? [];
  const ledgerRows = ledgerCount.count ?? 0;
  const payRows = purchases.data ?? [];

  const is = (name: string) => (r: { event: string }) => r.event === name;
  const pageViews = ev.filter(is("page_viewed"));
  const templatePageViews = pageViews.filter((r) => (r.path ?? "").startsWith("/templates"));

  const visitors = sessions(ev, is("page_viewed"));
  const prevVisitors = sessions(prevEv as EventRow[], is("page_viewed"));
  const browsed = sessions(ev, (r) => BROWSE_EVENTS.has(r.event) || (r.path ?? "").startsWith("/templates"));
  const composed = sessions(ev, is("compose_opened"));
  const inputReady = sessions(ev, is("mint_input_ready"));
  const submitted = sessions(ev, is("mint_submitted"));
  const loginRequired = sessions(ev, is("mint_login_required"));
  const engaged = sessions(ev, (r) => ENGAGE_EVENTS.has(r.event));

  const mints = tripRows.length;
  const prevMints = (prevTrips.data ?? []).length;
  const dossierViews = accessRows.filter((r) => r.event_type === "view" && !r.is_owner).length;
  const exports = accessRows.filter((r) => r.event_type === "export").length;
  const shared = new Set(
    accessRows.filter((r) => r.event_type === "view" && !r.is_owner).map((r) => r.trip_id),
  ).size;

  const signups = (profiles.data ?? []).length;
  const prevSignups = (prevProfiles.data ?? []).length;

  const paid = payRows.filter((p) => p.status === "paid");
  const currentPay = paid.filter((p) => p.paid_at >= fromIso);
  const prevPay = paid.filter((p) => p.paid_at < fromIso);
  const grossCents = currentPay.reduce((sum, p) => sum + (p.gross_cents ?? 0), 0);
  const netCents = currentPay.reduce((sum, p) => sum + (p.net_cents ?? 0), 0);
  const refundedCents = payRows
    .filter((p) => p.status !== "paid" && p.paid_at >= fromIso)
    .reduce((sum, p) => sum + (p.gross_cents ?? 0), 0);
  const currency = currentPay[0]?.currency ?? paid[0]?.currency ?? "USD";

  /* Engagement depth: how much of a dossier a builder actually assembles.
     Read from the trips we already fetched, counted — never returned. */
  let blocksTotal = 0;
  let daysTotal = 0;
  let withContent = 0;
  let photoTrips = 0;
  const depthBuckets = new Map<string, number>([
    ["1–3 days", 0],
    ["4–6 days", 0],
    ["7–10 days", 0],
    ["11+ days", 0],
  ]);
  for (const t of tripRows) {
    const content = t.content as { blocks?: unknown[] } | null;
    const blocks = Array.isArray(content?.blocks) ? (content?.blocks as Record<string, unknown>[]) : [];
    if (blocks.length === 0) continue;
    withContent++;
    blocksTotal += blocks.length;
    const dayCount = blocks.filter((b) => b["kind"] === "day").length;
    daysTotal += dayCount;
    if (blocks.some((b) => Array.isArray(b["images"]) && (b["images"] as unknown[]).length > 0)) {
      photoTrips++;
    }
    const bucket =
      dayCount <= 3 ? "1–3 days" : dayCount <= 6 ? "4–6 days" : dayCount <= 10 ? "7–10 days" : "11+ days";
    depthBuckets.set(bucket, (depthBuckets.get(bucket) ?? 0) + 1);
  }

  /* Template leaderboard: browse interest vs. actual mints. */
  const templateIds = new Set<string>([
    ...ev.map((r) => r.template_id).filter((v): v is string => !!v),
    ...tripRows.map((t) => t.template_id).filter((v): v is string => !!v),
  ]);
  const tripsByTemplate = new Map<string, string[]>();
  for (const t of tripRows) {
    if (!t.template_id) continue;
    tripsByTemplate.set(t.template_id, [...(tripsByTemplate.get(t.template_id) ?? []), t.id]);
  }
  const viewsByTrip = new Map<string, number>();
  for (const a of accessRows) {
    if (a.event_type !== "view" || a.is_owner) continue;
    viewsByTrip.set(a.trip_id, (viewsByTrip.get(a.trip_id) ?? 0) + 1);
  }
  const templates: TemplateRow[] = [...templateIds]
    .map((id) => {
      const previews = ev.filter((r) => r.template_id === id && BROWSE_EVENTS.has(r.event)).length;
      const submits = ev.filter((r) => r.template_id === id && r.event === "mint_submitted").length;
      const tripIds = tripsByTemplate.get(id) ?? [];
      const views = tripIds.reduce((sum, tid) => sum + (viewsByTrip.get(tid) ?? 0), 0);
      return {
        templateId: id,
        previews,
        submits,
        mints: tripIds.length,
        views,
        mintRate: pct(tripIds.length, Math.max(previews, submits, tripIds.length)),
      };
    })
    .sort((a, b) => b.mints - a.mints || b.previews - a.previews);

  /* Signup → first mint, by signup week. */
  const mintersByUser = new Set(tripRows.map((t) => t.user_id));
  const cohortMap = new Map<string, { signups: number; minted: number }>();
  for (const p of profiles.data ?? []) {
    const wk = weekKey(p.created_at);
    const cur = cohortMap.get(wk) ?? { signups: 0, minted: 0 };
    cur.signups++;
    if (mintersByUser.has(p.user_id)) cur.minted++;
    cohortMap.set(wk, cur);
  }
  const cohorts: CohortRow[] = [...cohortMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([week, c]) => ({ week, signups: c.signups, minted: c.minted, rate: pct(c.minted, c.signups) }));

  const funnelRaw: Array<[string, string, number]> = [
    ["landed", "Landed", visitors],
    ["browsed", "Browsed templates", browsed],
    ["composed", "Opened composer", composed],
    ["input_ready", "Input ready", inputReady],
    ["submitted", "Mint submitted", submitted],
    ["minted", "Dossier minted", mints],
    ["shared", "Shared / opened by someone else", shared],
  ];
  const top = funnelRaw[0][2];
  /* Rates are clamped to 100%: the last two steps are counted from the trips and
     access tables (ground truth, including dossiers minted by sessions that
     started before this period), so a raw ratio can exceed the step above it and
     would read as a bug rather than as history. Absolute counts stay exact. */
  const clamp = (n: number) => Math.min(100, n);
  const funnel: FunnelStep[] = funnelRaw.map(([key, label, value], i) => ({
    key,
    label,
    value,
    stepRate: i === 0 ? null : clamp(pct(value, funnelRaw[i - 1][2])),
    overallRate: clamp(pct(value, top)),
  }));

  const kpis: Kpi[] = [
    {
      key: "visitors",
      label: "Visitors",
      value: visitors,
      previous: prevVisitors,
      format: "count",
      series: series(dates, pageViews.map((r) => r.occurred_at)),
      hint: "Distinct anonymous sessions that loaded a page.",
    },
    {
      key: "browsed",
      label: "Browsed templates",
      value: browsed,
      previous: 0,
      format: "count",
      series: series(dates, templatePageViews.map((r) => r.occurred_at)),
      hint: "Sessions that reached the template gallery or interacted with a template.",
    },
    {
      key: "mints",
      label: "Dossiers minted",
      value: mints,
      previous: prevMints,
      format: "count",
      series: series(dates, tripRows.map((t) => t.created_at)),
      hint: "Trips created — the product's core conversion.",
    },
    {
      key: "mint_rate",
      label: "Visitor → mint",
      value: pct(mints, visitors),
      previous: pct(prevMints, prevVisitors),
      format: "percent",
      series: [],
      hint: "Share of sessions that end in a minted dossier.",
    },
    {
      key: "views",
      label: "Dossier reads",
      value: dossierViews,
      previous: 0,
      format: "count",
      series: series(dates, accessRows.filter((r) => r.event_type === "view").map((r) => r.occurred_at)),
      hint: "Non-owner opens of a shared dossier — the virality signal.",
    },
    {
      key: "signups",
      label: "New accounts",
      value: signups,
      previous: prevSignups,
      format: "count",
      series: series(dates, (profiles.data ?? []).map((p) => p.created_at)),
      hint: "Profiles created in the period.",
    },
    {
      key: "revenue",
      label: "Revenue",
      value: grossCents,
      previous: prevPay.reduce((s, p) => s + (p.gross_cents ?? 0), 0),
      format: "currency",
      series: series(dates, currentPay.map((p) => p.paid_at)),
      hint: "Settled payments in the ledger only — never a client claim.",
    },
    {
      key: "exports",
      label: "Exports",
      value: exports,
      previous: 0,
      format: "count",
      series: series(dates, accessRows.filter((r) => r.event_type === "export").map((r) => r.occurred_at)),
      hint: "Dossiers taken off-platform (PDF / doc).",
    },
  ];

  return {
    range: { days, from: fromIso, to: to.toISOString() },
    eventsTracked: ev.length,
    kpis,
    funnel,
    headline: { browsedTemplates: browsed, mintedTemplate: mints, engagedBuilding: engaged },
    traffic: series(dates, pageViews.map((r) => r.occurred_at)),
    mints: series(dates, tripRows.map((t) => t.created_at)),
    templates: templates.slice(0, 12),
    browseModes: tally(ev.filter(is("template_browse_mode_changed")), (r) => {
      const mode = r.props?.["mode"];
      return typeof mode === "string" ? mode : null;
    }),
    featureAdoption: tally(
      ev.filter((r) => r.event !== "page_viewed"),
      (r) => r.event,
    ).slice(0, 12),
    destinations: tally(tripRows, (t) => (t.destination ? t.destination.slice(0, 48) : null)).slice(0, 10),
    engagement: {
      tripsWithContent: withContent,
      avgBlocks: withContent > 0 ? Math.round((blocksTotal / withContent) * 10) / 10 : 0,
      avgDays: withContent > 0 ? Math.round((daysTotal / withContent) * 10) / 10 : 0,
      photoTrips,
      depth: [...depthBuckets.entries()].map(([label, value]) => ({ label, value })),
    },
    cohorts,
    revenue: {
      grossCents,
      netCents,
      paidMints: currentPay.filter((p) => p.kind === "mint").length,
      renewals: currentPay.filter((p) => p.kind === "renew").length,
      refundedCents,
      currency,
      series: series(dates, currentPay.map((p) => p.paid_at)),
      live: ledgerRows > 0,
      ledgerRows,
    },
    friction: [
      { label: "Login required mid-mint", value: loginRequired },
      { label: "Parse failed", value: ev.filter(is("mint_parse_failed")).length },
      { label: "Mint failed", value: ev.filter(is("mint_failed")).length },
      { label: "Contact messages", value: (contacts.data ?? []).length },
    ],
  };
}

/** Last events, newest first. No emails, no content — event shape only. */
export async function loadLiveFeed(limit: number): Promise<FeedRow[]> {
  const { data } = await supabaseAdmin
    .from("product_events")
    .select("id, occurred_at, event, template_id, path, session_id")
    .order("occurred_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((r) => ({
    id: r.id,
    occurredAt: r.occurred_at,
    event: r.event,
    templateId: r.template_id,
    path: r.path,
    // Truncated: enough to group a visit, not enough to follow a person.
    session: r.session_id ? r.session_id.slice(0, 6) : null,
  }));
}
