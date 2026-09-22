import { useEffect, useState } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  Bell,
  CheckCircle2,
  Clock3,
  CloudSun,
  History,
  Mail,
  MapPin,
  Pause,
  Plane,
  Plus,
  Radio,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { activeItems, effectiveStart, effectiveEnd, pulse, signalFresh } from "@/lib/adaptive/live";
import { instant } from "@/lib/adaptive/normalize";
import type { AdaptiveCommand } from "@/lib/adaptive/commands";
import type {
  CanonicalItineraryItem,
  EmailAccountConnection,
  ItineraryItemLiveStatus,
  Reservation,
  ScanScope,
  TravelDossier,
} from "@/lib/adaptive/types";
import { ReservationForm } from "./ReservationForm";
import { PreferenceForm } from "./PreferenceForm";
import { AdaptiveMap } from "./AdaptiveMap";
import "./adaptive.css";

export type AdaptiveCapabilities = {
  gmail: boolean;
  push: boolean;
  background: boolean;
  vapidPublicKey?: string | null;
  providers: { id: string; label: string; supported: boolean }[];
};
export type DossierScreenProps = {
  state: TravelDossier;
  tripId: string;
  accounts: EmailAccountConnection[];
  capabilities: AdaptiveCapabilities;
  onCommand: (command: AdaptiveCommand) => Promise<void>;
  onSync: () => Promise<void>;
  onConnect: (scope: ScanScope) => Promise<void>;
  onAccount: (
    id: string,
    action: "pause" | "resume" | "disconnect" | "delete",
    confirmation?: string,
  ) => Promise<void>;
  onImport: () => Promise<void>;
  onNotifications: () => Promise<void>;
  demo?: boolean;
  clock?: string;
  demoControls?: React.ReactNode;
};
function stamp(value?: string, timezone = "UTC") {
  if (!value || !Number.isFinite(Date.parse(value))) return "Time needs review";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(value));
}
function liveSummary(status: ItineraryItemLiveStatus | undefined, timezone: string) {
  if (!status) return "Original reservation values";
  const labels: Record<string, string> = {
    departure: "Departure",
    arrival: "Arrival",
    gate: "Gate",
    terminal: "Terminal",
    boarding: "Boarding",
    baggage: "Baggage carousel",
    departureBy: "Leave by",
  };
  const values = Object.entries(status.values).map(
    ([key, value]) =>
      (labels[key] ?? key) +
      ": " +
      (["departure", "arrival", "boarding", "departureBy"].includes(key)
        ? stamp(String(value), timezone)
        : String(value)),
  );
  if (status.cancelled) values.unshift("Cancelled");
  return values.join(" · ") || "Original reservation values";
}
function dayKey(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}
function countdown(time: string | undefined, now: string) {
  const minutes = Math.ceil((instant(time) - instant(now)) / 60_000);
  if (!Number.isFinite(minutes)) return "Time to be confirmed";
  if (minutes <= 0) return "In progress";
  const days = Math.floor(minutes / 1440),
    hours = Math.floor((minutes % 1440) / 60),
    mins = minutes % 60;
  return "In " + (days ? days + "d " : "") + (hours ? hours + "h " : "") + mins + "m";
}
function externalUrl(value?: string) {
  try {
    const url = new URL(value ?? "");
    return url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function DossierScreen(props: DossierScreenProps) {
  const { state, tripId, accounts, capabilities, demo, onCommand } = props;
  const trip = state.trips.find((t) => t.id === tripId)!;
  const [tab, setTab] = useState("timeline"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [now, setNow] = useState(props.clock ?? new Date().toISOString());
  const [scope, setScope] = useState<ScanScope>("90"),
    [dialog, setDialog] = useState<{ kind: "add" | "edit" | "review"; id?: string } | null>(null);
  const [targetTrip, setTargetTrip] = useState(tripId),
    [targetItem, setTargetItem] = useState("");
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
    if (props.clock) return;
    const timer = setInterval(() => setNow(new Date().toISOString()), 30_000);
    return () => clearInterval(timer);
  }, [props.clock]);
  useEffect(() => {
    if (trip.preferences.location === "disabled") setPosition(null);
  }, [trip.preferences.location]);
  const isLive = trip.session.phase === "live";
  const active = activeItems(state, tripId);
  const next = active.find((i) => instant(effectiveEnd(state, i)) >= instant(now));
  const reviews = state.reviews.filter(
    (r) => r.status === "open" && (!r.tripId || r.tripId === tripId),
  );
  const cancelled = state.items.filter(
    (i) =>
      i.tripId === tripId &&
      (i.reservation.status === "cancelled" ||
        state.live.find((l) => l.itemId === i.id)?.cancelled),
  );
  const events = state.notifications.filter(
    (n) =>
      n.tripId === tripId &&
      !n.dismissedAt &&
      n.status !== "suppressed" &&
      instant(n.expiresAt) > instant(now) &&
      state.signals.some((s) => s.id === n.signalId && signalFresh(s, now)),
  );
  const attention = events.filter((n) => n.tier !== "helpful"),
    helpful = events.filter((n) => n.tier === "helpful");
  const tripPulse = pulse(state, tripId, now);
  const weather = state.signals
    .filter(
      (s) =>
        s.category === "weather" && active.some((i) => i.id === s.itemId) && signalFresh(s, now),
    )
    .at(-1);
  const preparation = state.recommendations.filter(
    (r) =>
      r.kind === "preparation" &&
      !r.dismissedAt &&
      active.some((i) => i.id === r.itemId) &&
      state.signals.some((s) => s.id === r.signalId && signalFresh(s, now)),
  );
  const changes = state.changes
    .filter((c) => c.tripId === tripId || (!c.tripId && c.kind === "privacy"))
    .slice()
    .reverse();
  async function run(work: () => Promise<void>, rethrow = false) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The change could not be saved.");
      if (rethrow) throw err;
    } finally {
      setBusy(false);
    }
  }
  async function phase(value: "live" | "paused" | "ended") {
    await run(() => onCommand({ kind: "phase", tripId, phase: value }));
    if (value === "live") setTab("live");
  }
  async function location() {
    if (!navigator.geolocation) {
      setError("Location is unavailable in this browser. Itinerary locations still work.");
      return;
    }
    await new Promise<void>((resolve) =>
      navigator.geolocation.getCurrentPosition(
        async (p) => {
          setPosition({ lat: p.coords.latitude, lng: p.coords.longitude });
          await run(() =>
            onCommand({
              kind: "preferences",
              tripId,
              preferences: { ...trip.preferences, location: "granted" },
            }),
          );
          resolve();
        },
        async () => {
          await run(() =>
            onCommand({
              kind: "preferences",
              tripId,
              preferences: { ...trip.preferences, location: "denied" },
            }),
          );
          resolve();
        },
        { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
      ),
    );
  }
  const editing = dialog?.kind === "edit" ? state.items.find((i) => i.id === dialog.id) : undefined;
  const reviewing =
    dialog?.kind === "review" ? state.reviews.find((r) => r.id === dialog.id) : undefined;
  const selected = state.items.find((i) => i.id === targetItem && i.tripId === targetTrip);
  function openReview(id: string) {
    const r = state.reviews.find((r) => r.id === id)!;
    setTargetTrip(r.tripId ?? tripId);
    setTargetItem(r.candidateIds.length === 1 ? r.candidateIds[0] : "");
    setDialog({ kind: "review", id });
  }

  function itemCard(item: CanonicalItineraryItem) {
    const r = item.reservation,
      live = state.live.find((s) => s.itemId === item.id),
      versions = state.versions.filter((v) => v.itemId === item.id);
    const isCancelled = r.status === "cancelled" || live?.cancelled;
    const sourceSignals = state.signals.filter((s) => s.itemId === item.id);
    const fresh = sourceSignals.some((s) => signalFresh(s, now));
    return (
      <article
        className={"ad-item " + (isCancelled ? "ad-item-cancelled" : "")}
        key={item.id}
        data-testid="reservation-card"
        id={"reservation-" + item.id}
      >
        <div className="ad-item-mark">
          {r.type === "flight" ? (
            <Plane size={19} />
          ) : r.type === "lodging" ? (
            <MapPin size={19} />
          ) : (
            <Clock3 size={19} />
          )}
        </div>
        <div className="ad-item-body">
          <div className="ad-item-top">
            <span className="ad-eyebrow">
              {r.type} · {r.provider}
            </span>
            <span className={"ad-badge " + (isCancelled ? "ad-warning" : "ad-success")}>
              {isCancelled ? "Cancelled" : "Confirmed"}
            </span>
          </div>
          <h3>{r.title}</h3>
          <p className="ad-item-time">
            {stamp(effectiveStart(state, item), r.timezone)} <span>{r.timezone}</span>
          </p>
          <p className="ad-muted">
            {r.origin && r.destination
              ? r.origin + " → " + r.destination
              : (r.address ?? r.location)}
          </p>
          <div className="ad-tags">
            <span>{item.sourceKind === "email" ? "Synced from email" : "User entered"}</span>
            {versions.length > 0 && <span>Updated</span>}
            {item.userEditedFields.length > 0 && <span>User Edited</span>}
            {live && (
              <span className="ad-live-tag">{fresh ? "Updated Live" : "Last known update"}</span>
            )}
            {reviews.some((q) => q.candidateIds.includes(item.id)) && <span>Needs Review</span>}
          </div>
          {live && (
            <p className="ad-operational">
              {live.values.gate ? "Gate " + live.values.gate + " · " : ""}
              {live.values.terminal ? "Terminal " + live.values.terminal + " · " : ""}Updated{" "}
              {stamp(live.updatedAt, r.timezone)}
            </p>
          )}
          {item.replacesItemId && (
            <p className="ad-muted">Linked to the earlier cancelled reservation.</p>
          )}
          <details className="ad-details">
            <summary>Details, sources & history</summary>
            <dl className="ad-definition">
              <dt>Confirmation</dt>
              <dd>{r.confirmation ?? "Not supplied"}</dd>
              <dt>Traveler</dt>
              <dd>{r.traveler ?? "Not supplied"}</dd>
              <dt>Reservation start</dt>
              <dd>{stamp(r.startAt, r.timezone)}</dd>
              <dt>Reservation end</dt>
              <dd>{r.endAt ? stamp(r.endAt, r.timezone) : "Not supplied"}</dd>
              <dt>Confidence</dt>
              <dd>
                {Math.round(item.confidence * 100)}% ·{" "}
                {demo
                  ? "demo fixture"
                  : item.sourceKind === "user"
                    ? "user-entered"
                    : "extraction / matching confidence"}
              </dd>
              <dt>Last synced</dt>
              <dd>{item.lastSyncedAt ? stamp(item.lastSyncedAt) : "User entered"}</dd>
              {Object.entries(r.details).map(([key, val]) => (
                <div className="ad-definition-row" key={key}>
                  <dt>{key}</dt>
                  <dd>{val}</dd>
                </div>
              ))}
            </dl>
            <h4>Original reservation</h4>
            <p>
              {stamp(item.original.startAt, item.original.timezone)} ·{" "}
              {item.original.details.gate
                ? "Gate " + item.original.details.gate
                : item.original.status}
            </p>
            {item.sourceIds.map((id) => {
              const source = state.sources.find((s) => s.id === id);
              return (
                source && (
                  <div className="ad-source" key={id}>
                    <Mail size={14} />
                    <div>
                      <strong>{source.subject}</strong>
                      <p>
                        {source.sender} · {stamp(source.receivedAt)}
                      </p>
                      <p>{source.rationale}</p>
                      <blockquote>{source.excerpt}</blockquote>
                    </div>
                  </div>
                )
              );
            })}
            {sourceSignals.map((s) => (
              <div className="ad-source" key={s.id}>
                <Radio size={14} />
                <div>
                  <strong>{s.summary}</strong>
                  <p>
                    {s.source.kind === "demo" ? "Demo data" : "Provider data"} · {s.source.name} ·{" "}
                    {stamp(s.observedAt)}
                  </p>
                  <p>
                    Applies through {stamp(s.validUntil)}. {Math.round(s.confidence * 100)}%
                    confidence.
                  </p>
                </div>
              </div>
            ))}
            {state.audit
              .filter((a) => a.itemId === item.id)
              .slice()
              .reverse()
              .map((a) => (
                <div className="ad-version" key={a.id}>
                  <div>
                    <strong>{stamp(a.at)} · Live status history</strong>
                    <p>{a.rationale}</p>
                    <p>Before: {liveSummary(a.before, r.timezone)}</p>
                    <p>After: {liveSummary(a.after, r.timezone)}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          "Restore the dossier's prior live status? Verify the current status with the provider first. External bookings will not change.",
                        )
                      )
                        void run(() => onCommand({ kind: "restore-live", auditId: a.id }));
                    }}
                  >
                    Restore prior status
                  </Button>
                </div>
              ))}
            {versions.map((v) => (
              <div className="ad-version" key={v.id}>
                <span>
                  {stamp(v.at)} · {v.actor} · {v.reservation.status} ·{" "}
                  {stamp(v.reservation.startAt, v.reservation.timezone)}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Restore these reservation values? This changes your dossier only. Provider bookings will not change.",
                      )
                    )
                      void run(() => onCommand({ kind: "restore", versionId: v.id }));
                  }}
                >
                  Restore
                </Button>
              </div>
            ))}
            <div className="ad-actions">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDialog({ kind: "edit", id: item.id })}
              >
                Edit reservation
              </Button>
              {externalUrl(r.details.website) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (
                      window.confirm(
                        "Open the provider website? TravelDoss will not send a message or change your booking.",
                      )
                    )
                      window.open(externalUrl(r.details.website), "_blank", "noopener,noreferrer");
                  }}
                >
                  Contact provider ↗
                </Button>
              )}
            </div>
          </details>
        </div>
      </article>
    );
  }
  return (
    <div className="ad-root" data-ready={ready ? "true" : "false"}>
      <header className="ad-topbar">
        <a href="/app" className="ad-brand">
          <ArrowLeft size={16} /> TravelDoss<span>®</span>
        </a>
        <div className="ad-top-actions">
          <span>
            <ShieldCheck size={14} /> Private to you
          </span>
          {!demo && (
            <a href={"/t/" + trip.slug}>
              Original design <ArrowUpRight size={14} />
            </a>
          )}
        </div>
      </header>
      <main className="ad-shell">
        {demo && (
          <div className="ad-demo">
            <strong>Interactive demo</strong>
            <span>
              Fictional reservations · fixed clock {stamp(now)} UTC · no inbox or provider actions
            </span>
            {props.demoControls}
          </div>
        )}
        <section className="ad-hero">
          <div>
            <div className="ad-eyebrow">
              Your living trip dossier{" "}
              <span className={"ad-phase " + (isLive ? "ad-phase-live" : "")}>
                {isLive && <span className="ad-dot" />}
                {trip.session.phase === "live"
                  ? "Live Trip"
                  : trip.session.phase === "planning"
                    ? "Planning"
                    : trip.session.phase === "paused"
                      ? "Live Trip paused"
                      : "Live Trip ended"}
              </span>
            </div>
            <h1>
              {trip.destination}
              <span className="ad-title-dot">.</span>
            </h1>
            <p className="ad-subtitle">
              {trip.startDate} — {trip.endDate} <span>·</span> {active.length} active reservations
            </p>
            <p className="ad-hero-copy">
              {isLive
                ? "Your plans, with the context that matters right now."
                : "Everything in one place. Quietly kept up to date."}
            </p>
          </div>
          <div className="ad-hero-actions">
            {!isLive ? (
              <Button disabled={busy} onClick={() => phase("live")}>
                <Radio size={16} />{" "}
                {trip.session.phase === "paused" ? "Resume Live Trip" : "Activate Live Trip"}
              </Button>
            ) : (
              <>
                <Button variant="outline" disabled={busy} onClick={() => phase("paused")}>
                  <Pause size={15} /> Pause assistance
                </Button>
                <button className="ad-text-button" disabled={busy} onClick={() => phase("ended")}>
                  End Live Trip
                </button>
                <button
                  className="ad-text-button"
                  disabled={busy}
                  onClick={() =>
                    run(() =>
                      onCommand({
                        kind: "phase",
                        tripId,
                        phase: "live",
                        extendedUntil: new Date(instant(now) + 24 * 3600_000).toISOString(),
                      }),
                    )
                  }
                >
                  Extend for 24 hours
                </button>
              </>
            )}
            <button className="ad-text-button" disabled={busy} onClick={() => run(props.onSync)}>
              <RefreshCw size={13} className={busy ? "ad-spin" : ""} />{" "}
              {busy ? "Updating…" : "Sync now"}
            </button>
          </div>
        </section>
        {!isLive && (
          <div className="ad-calm">
            <CheckCircle2 size={18} />
            <p>
              {trip.session.phase === "planning"
                ? "Live Trip assistance will begin " +
                  (trip.preferences.autoActivate
                    ? trip.preferences.activationHours +
                      " hours before your first active reservation."
                    : "when you activate it.")
                : "Live assistance is " +
                  trip.session.phase +
                  ". Your dossier and email sync remain available."}{" "}
              <span>
                Planning stays quiet. No weather, clothing, traffic, or routine travel pushes.
              </span>
            </p>
          </div>
        )}
        {isLive && !trip.preferences.notifications.push && (
          <div className="ad-calm">
            <Bell size={18} />
            <p>Live Trip has started. You control what reaches your device.</p>
            <Button
              variant="outline"
              size="sm"
              disabled={!capabilities.push || busy}
              onClick={() => run(props.onNotifications)}
            >
              Enable notifications
            </Button>
            {!capabilities.push && (
              <span className="ad-muted">In-app updates available; push is not configured.</span>
            )}
          </div>
        )}
        {error && (
          <div role="alert" className="ad-error">
            <TriangleAlert size={17} />
            {error}
            <button aria-label="Dismiss error" onClick={() => setError("")}>
              ×
            </button>
          </div>
        )}
        <nav className="ad-tabs" aria-label="Dossier sections">
          {[
            ["timeline", "Dossier", <Clock3 size={15} />],
            ["live", "Live Trip", <Radio size={15} />],
            [
              "review",
              "Review" + (reviews.length ? " · " + reviews.length : ""),
              <ShieldCheck size={15} />,
            ],
            ["cancelled", "Cancelled / Changes", <History size={15} />],
            ["activity", "Activity", <Activity size={15} />],
            ["map", "Map", <MapPin size={15} />],
            ["settings", "Settings", <SlidersHorizontal size={15} />],
          ].map(([key, label, icon]) => (
            <button
              key={String(key)}
              aria-current={tab === key ? "page" : undefined}
              onClick={() => setTab(String(key))}
            >
              {icon}
              {label}
            </button>
          ))}
        </nav>
        {tab === "timeline" && (
          <div className="ad-columns">
            <section className="ad-card">
              <div className="ad-section-title">
                <div>
                  <span className="ad-eyebrow">The canonical record</span>
                  <h2>Your itinerary</h2>
                </div>
                <Button variant="outline" size="sm" onClick={() => setDialog({ kind: "add" })}>
                  <Plus size={14} /> Add reservation
                </Button>
              </div>
              {active.length ? (
                active.map(itemCard)
              ) : (
                <div className="ad-empty">
                  <Mail size={28} />
                  <h3>A home for every reservation.</h3>
                  <p>Connect Gmail, review existing plans, or add a reservation to get started.</p>
                  <div className="ad-actions">
                    <Button onClick={() => setTab("settings")}>Connect email</Button>
                    <Button variant="outline" onClick={() => run(props.onImport)}>
                      Review existing plans
                    </Button>
                  </div>
                </div>
              )}
              <p className="ad-muted ad-footnote">
                {cancelled.length} cancelled reservation{cancelled.length === 1 ? "" : "s"}{" "}
                preserved in Cancelled / Changes.
              </p>
            </section>
            <aside className="ad-stack">
              <section className="ad-card ad-navy">
                <Mail size={21} />
                <h2>Your inbox, organized.</h2>
                <p>
                  Emails become evidence for a single reservation. Updates stay with the original
                  record.
                </p>
                <p className="ad-muted">
                  {accounts.length
                    ? accounts.filter((a) => a.status === "connected").length +
                      " connected account(s)"
                    : "No email account connected"}
                </p>
                <Button variant="outline" onClick={() => setTab("settings")}>
                  Email Sync settings <ArrowUpRight size={14} />
                </Button>
              </section>
              <section className="ad-card">
                <ShieldCheck size={21} />
                <h2>
                  {reviews.length ? reviews.length + " need a second look" : "You stay in control."}
                </h2>
                <p>
                  {reviews.length
                    ? "Uncertain details wait here until you decide."
                    : "Your edits are protected. Sources and prior values stay attached to each reservation."}
                </p>
                {reviews.length > 0 && (
                  <Button variant="outline" onClick={() => setTab("review")}>
                    Open Review
                  </Button>
                )}
              </section>
              <section className="ad-card">
                <h3>Already have an itinerary?</h3>
                <p className="ad-muted">
                  Bring your existing design’s plans into Review once, then confirm dates and
                  reservation details.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy || state.processed.includes("legacy:" + tripId)}
                  onClick={() => run(props.onImport)}
                >
                  Review existing plans
                </Button>
              </section>
            </aside>
          </div>
        )}
        {tab === "live" && (
          <div className="ad-stack">
            <div className="ad-pulse-row">
              <section
                className={"ad-pulse " + (tripPulse === "Disrupted" ? "ad-pulse-disrupted" : "")}
              >
                <div className="ad-eyebrow">
                  <Activity size={14} /> Trip Pulse
                </div>
                <h2>{isLive ? tripPulse : "Assistance " + trip.session.phase}</h2>
                <p>
                  {isLive
                    ? "Based on available, matched itinerary updates."
                    : "Activate Live Trip to monitor relevant conditions."}
                </p>
              </section>
              <section className="ad-card ad-coverage">
                <h3>Monitoring coverage</h3>
                {capabilities.providers.map((p) => (
                  <p key={p.id}>
                    <span className={"ad-dot " + (!p.supported ? "ad-dot-muted" : "")} />
                    {p.label}
                    <strong>{demo ? "Demo" : p.supported ? "Configured" : "Not configured"}</strong>
                  </p>
                ))}
                <small>
                  {capabilities.background
                    ? "Background worker checked in within the last 15 minutes."
                    : "No recent background-worker check-in. Sync now refreshes available sources."}
                </small>
              </section>
            </div>
            <div className="ad-columns">
              <div className="ad-stack">
                <section className="ad-next">
                  <span className="ad-eyebrow">
                    Up next{" "}
                    <span>
                      {next ? countdown(effectiveStart(state, next), now) : "Nothing scheduled"}
                    </span>
                  </span>
                  <h2>{next?.reservation.title ?? "Room to explore."}</h2>
                  <p>
                    {next
                      ? stamp(effectiveStart(state, next), next.reservation.timezone)
                      : "Add or review a reservation to see your next step."}
                  </p>
                  {next && (
                    <p className="ad-muted">
                      Itinerary location:{" "}
                      {next.reservation.origin ??
                        next.reservation.location ??
                        next.reservation.destination}{" "}
                      · {stamp(now, next.reservation.timezone)} local
                    </p>
                  )}
                  {next && state.live.find((l) => l.itemId === next.id)?.values.departureBy && (
                    <p>
                      Suggested departure:{" "}
                      {stamp(
                        state.live.find((l) => l.itemId === next.id)?.values.departureBy,
                        next.reservation.timezone,
                      )}{" "}
                      · provider estimate
                    </p>
                  )}
                </section>
                <section className="ad-card">
                  <h2>Needs your attention</h2>
                  {attention.length ? (
                    attention.map((event) => {
                      const a = state.assessments.find((a) => a.signalId === event.signalId),
                        s = state.signals.find((s) => s.id === event.signalId),
                        i = state.items.find((i) => i.id === event.itemId);
                      return (
                        <article className={"ad-alert ad-alert-" + event.tier} key={event.id}>
                          <span className="ad-eyebrow">{event.tier}</span>
                          <h3>{event.text}</h3>
                          <p>{event.rationale}</p>
                          {a?.downstream.map((d) => (
                            <p className="ad-downstream" key={d.itemId}>
                              <ArrowUpRight size={14} />
                              {d.reason}
                            </p>
                          ))}
                          {s?.action && (
                            <p>
                              <strong>TravelDoss suggestion:</strong> {s.action}
                            </p>
                          )}
                          <p className="ad-muted">
                            {s?.source.name} · {stamp(s?.observedAt)} ·{" "}
                            {event.suppression ??
                              (event.status === "sent" ? "Push delivered" : "Push queued")}
                          </p>
                          <div className="ad-actions">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setTab("timeline");
                                if (i)
                                  setTimeout(
                                    () =>
                                      document
                                        .getElementById("reservation-" + i.id)
                                        ?.scrollIntoView({ block: "center" }),
                                    0,
                                  );
                              }}
                            >
                              View details
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={busy}
                              onClick={() =>
                                run(() => onCommand({ kind: "dismiss", notificationId: event.id }))
                              }
                            >
                              Dismiss
                            </Button>
                          </div>
                        </article>
                      );
                    })
                  ) : (
                    <p className="ad-muted">
                      No meaningful known issue is currently flagged. Unavailable sources are not an
                      all-clear guarantee.
                    </p>
                  )}
                </section>
                <section className="ad-card">
                  <h2>Today, in order</h2>
                  {active
                    .filter(
                      (i) =>
                        i.reservation.startAt &&
                        dayKey(effectiveStart(state, i)!, i.reservation.timezone) ===
                          dayKey(now, i.reservation.timezone),
                    )
                    .map(itemCard)}
                  {!active.some(
                    (i) =>
                      i.reservation.startAt &&
                      dayKey(effectiveStart(state, i)!, i.reservation.timezone) ===
                        dayKey(now, i.reservation.timezone),
                  ) && (
                    <p className="ad-muted">
                      No active reservation starts today in its local timezone.
                    </p>
                  )}
                </section>
              </div>
              <aside className="ad-stack">
                <section className="ad-card">
                  <CloudSun size={25} />
                  <h2>Weather for your plans</h2>
                  {weather ? (
                    <>
                      <p>{weather.summary}</p>
                      <p className="ad-muted">
                        {weather.source.name} · retrieved {stamp(weather.observedAt)} · applies
                        through {stamp(weather.validUntil)}
                      </p>
                    </>
                  ) : (
                    <p className="ad-muted">
                      No fresh, matched forecast available. Forecasts appear for an itinerary
                      location and time when supported.
                    </p>
                  )}
                </section>
                {trip.preferences.preparation && preparation.length > 0 && (
                  <section className="ad-card ad-prep">
                    <Sparkles size={23} />
                    <h2>Worth bringing</h2>
                    {preparation.map((r) => (
                      <div key={r.id}>
                        <p>{r.text}</p>
                        <small>
                          {state.items.find((i) => i.id === r.itemId)?.reservation.title} ·
                          TravelDoss suggestion
                        </small>
                      </div>
                    ))}
                  </section>
                )}
                {helpful.length > 0 && (
                  <section className="ad-card">
                    <h3>Helpful updates · {helpful.length}</h3>
                    <p className="ad-muted">Grouped here to keep your trip quiet.</p>
                    {helpful.map((n) => (
                      <p key={n.id}>{n.text}</p>
                    ))}
                  </section>
                )}
                {reviews.length > 0 && (
                  <section className="ad-card">
                    <h3>{reviews.length} need review</h3>
                    <Button variant="outline" onClick={() => setTab("review")}>
                      Review uncertain details
                    </Button>
                  </section>
                )}
              </aside>
            </div>
          </div>
        )}
        {tab === "review" && (
          <section className="ad-card">
            <span className="ad-eyebrow">Accuracy before automation</span>
            <h2>Review queue</h2>
            <p className="ad-muted">
              These changes have not been applied. Select a trip and reservation, correct the
              details, then apply explicitly.
            </p>
            {reviews.length === 0 && (
              <div className="ad-empty">
                <CheckCircle2 size={30} />
                <h3>Nothing waiting on you.</h3>
                <p>Uncertain matches will appear here.</p>
              </div>
            )}
            {reviews.map((r) => (
              <article className="ad-review" key={r.id}>
                <span className="ad-badge ad-warning">Needs Review</span>
                <h3>{r.entity?.reservation.title ?? r.signal?.summary ?? "Travel information"}</h3>
                <p>{r.reason}</p>
                <p className="ad-muted">
                  {r.entity?.reservation.provider} ·{" "}
                  {r.entity?.reservation.confirmation ?? "No booking reference"} · {stamp(r.at)}
                </p>
                {r.sourceId && (
                  <details>
                    <summary>Source evidence</summary>
                    <p>{state.sources.find((s) => s.id === r.sourceId)?.excerpt}</p>
                  </details>
                )}
                <div className="ad-actions">
                  <Button size="sm" onClick={() => openReview(r.id)}>
                    Review details
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      run(() => onCommand({ kind: "review", reviewId: r.id, decision: "dismiss" }))
                    }
                  >
                    Dismiss evidence
                  </Button>
                </div>
              </article>
            ))}
          </section>
        )}
        {tab === "cancelled" && (
          <section className="ad-card">
            <h2>Cancelled / Changes</h2>
            <p className="ad-muted">
              History stays intact. These reservations are excluded from the active timeline, map,
              and routine reminders.
            </p>
            {cancelled.length ? cancelled.map(itemCard) : <p>No cancelled reservations.</p>}
            <h3>Recent reservation changes</h3>
            {changes
              .filter((c) => ["updated", "cancelled", "rebooked", "restored"].includes(c.kind))
              .map((c) => (
                <p key={c.id}>
                  {stamp(c.at)} · {c.summary}
                </p>
              ))}
          </section>
        )}
        {tab === "activity" && (
          <section className="ad-card">
            <h2>Activity history</h2>
            <p className="ad-muted">
              Every applied update and traveler decision, with its source and reasoning.
            </p>
            {changes.length === 0 && <p>No changes yet.</p>}
            <ol className="ad-history">
              {changes.map((c) => (
                <li key={c.id}>
                  <span className="ad-history-dot" />
                  <div>
                    <small>
                      {stamp(c.at)} · {c.actor}
                    </small>
                    <h3>{c.summary}</h3>
                    <p>{c.rationale}</p>
                    {c.sourceId && (
                      <p className="ad-muted">
                        Source:{" "}
                        {state.sources.find((s) => s.id === c.sourceId)?.subject ??
                          state.signals.find((s) => s.source.id === c.sourceId)?.source.name ??
                          c.sourceId}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
            <h3>Processing log</h3>
            {state.logs
              .slice(-15)
              .reverse()
              .map((l) => (
                <p key={l.id} className={l.status === "error" ? "ad-error" : "ad-muted"}>
                  {stamp(l.at)} · {l.message} · {l.processed} processed
                </p>
              ))}
          </section>
        )}
        {tab === "map" && <AdaptiveMap state={state} tripId={tripId} />}
        {tab === "settings" && (
          <div className="ad-columns">
            <div className="ad-stack">
              <section className="ad-card">
                <Mail size={22} />
                <h2>Email Sync</h2>
                <p>
                  Connect your own Gmail account with read-only OAuth. TravelDoss reads
                  travel-related messages to reconcile reservations and retains only the evidence
                  needed to explain changes. No email passwords.
                </p>
                <label className="ad-field">
                  Scan range
                  <select
                    aria-label="Scan range"
                    value={scope}
                    onChange={(e) => setScope(e.target.value as ScanScope)}
                  >
                    <option value="30">Last 30 days</option>
                    <option value="90">Last 90 days</option>
                    <option value="all">All available travel-related history</option>
                    <option value="new">New travel emails only, going forward</option>
                  </select>
                </label>
                <Button
                  disabled={busy || !capabilities.gmail}
                  onClick={() => run(() => props.onConnect(scope))}
                >
                  <Mail size={16} /> Connect Gmail
                </Button>
                {!capabilities.gmail && (
                  <p className="ad-muted">
                    {demo
                      ? "This demo does not connect to an inbox."
                      : "Gmail OAuth is not configured on this installation yet."}
                  </p>
                )}
                {accounts.map((a) => (
                  <div className="ad-account" key={a.id}>
                    <h3>{a.email}</h3>
                    <p>
                      <span className="ad-badge">{a.status}</span>{" "}
                      {a.sync.scanning ? "Historical scan in progress" : "New-message sync"} ·{" "}
                      {a.sync.processed} processed
                    </p>
                    <p className="ad-muted">
                      Last synced: {a.sync.lastSyncedAt ? stamp(a.sync.lastSyncedAt) : "Not yet"} ·
                      scope: {a.sync.scope}
                    </p>
                    {a.sync.error && (
                      <p role="alert" className="ad-error">
                        {a.sync.error}
                      </p>
                    )}
                    <div className="ad-actions">
                      {a.status !== "disconnected" && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() =>
                              run(() =>
                                props.onAccount(a.id, a.status === "paused" ? "resume" : "pause"),
                              )
                            }
                          >
                            {a.status === "paused" ? "Resume sync" : "Pause sync"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() => {
                              if (
                                window.confirm(
                                  "Disconnect Gmail and revoke TravelDoss access? Imported reservations and history will remain.",
                                )
                              )
                                void run(() => props.onAccount(a.id, "disconnect"));
                            }}
                          >
                            Disconnect & revoke
                          </Button>
                        </>
                      )}
                      {a.status === "disconnected" && (
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={busy}
                          onClick={() => {
                            if (
                              window.confirm(
                                "Permanently delete this account’s imported reservations, email evidence, and associated history, including your edits to those reservations? This cannot be undone.",
                              )
                            )
                              void run(() =>
                                props.onAccount(a.id, "delete", "DELETE IMPORTED DATA"),
                              );
                          }}
                        >
                          Delete imported data
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                <p className="ad-muted">
                  You can also revoke access in{" "}
                  <a
                    href="https://myaccount.google.com/permissions"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Google Account permissions ↗
                  </a>
                  .
                </p>
              </section>
              <PreferenceForm
                key={trip.preferences.location + String(trip.preferences.notifications.push)}
                initial={trip.preferences}
                busy={busy}
                pushAvailable={capabilities.push}
                onSave={(preferences) =>
                  run(() => onCommand({ kind: "preferences", tripId, preferences }), true)
                }
                onLocation={location}
                onNotifications={() => run(props.onNotifications)}
              />
            </div>
            <aside className="ad-card ad-fit">
              <ShieldCheck size={24} />
              <h2>Built around your trust.</h2>
              <ul>
                <li>One reservation. Its full history.</li>
                <li>Uncertain matches go to Review.</li>
                <li>Location stays optional.</li>
                <li>
                  No booking changes, purchases, or provider messages without your confirmation.
                </li>
                <li>Source times are visible. Missing data stays missing.</li>
              </ul>
              {position && (
                <a
                  href={
                    "https://www.openstreetmap.org/?mlat=" +
                    position.lat +
                    "&mlon=" +
                    position.lng +
                    "#map=15/" +
                    position.lat +
                    "/" +
                    position.lng
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  View my current location ↗
                </a>
              )}
            </aside>
          </div>
        )}
        <footer className="ad-footer">
          <span>TravelDoss · Your plans, preserved.</span>
          <span>
            <ShieldCheck size={13} /> Evidence first. You decide.
          </span>
        </footer>
      </main>
      <Dialog
        open={!!dialog}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
      >
        <DialogContent className="ad-dialog">
          <DialogHeader>
            <DialogTitle>
              {dialog?.kind === "review"
                ? "Review this reservation"
                : dialog?.kind === "edit"
                  ? "Edit your reservation"
                  : "Add a reservation"}
            </DialogTitle>
            <DialogDescription>
              Changes update your TravelDoss dossier only. They do not change a provider booking.
            </DialogDescription>
          </DialogHeader>
          {reviewing && !reviewing.signal && (
            <>
              <p>{reviewing.reason}</p>
              <div className="ad-form-grid">
                <label className="ad-field">
                  Trip
                  <select
                    value={targetTrip}
                    onChange={(e) => {
                      setTargetTrip(e.target.value);
                      setTargetItem("");
                    }}
                  >
                    {state.trips.map((t) => (
                      <option value={t.id} key={t.id}>
                        {t.destination}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="ad-field">
                  Apply to reservation
                  <select value={targetItem} onChange={(e) => setTargetItem(e.target.value)}>
                    <option value="">Create a new reservation</option>
                    {state.items
                      .filter((i) => i.tripId === targetTrip)
                      .map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.reservation.title} · {i.reservation.confirmation}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
            </>
          )}
          {reviewing?.signal && (
            <div className="ad-stack">
              <p>{reviewing.reason}</p>
              <p>{reviewing.signal.summary}</p>
              <p className="ad-muted">
                {reviewing.signal.source.name} · {stamp(reviewing.signal.observedAt)} ·{" "}
                {Math.round(reviewing.signal.confidence * 100)}% confidence
              </p>
              <Button
                variant="outline"
                onClick={() => setDialog({ kind: "edit", id: reviewing.candidateIds[0] })}
              >
                Edit reservation after verifying
              </Button>
            </div>
          )}
          {dialog && !reviewing?.signal && (
            <ReservationForm
              key={(dialog.id ?? "add") + targetItem}
              initial={
                editing?.reservation ??
                (reviewing
                  ? {
                      ...selected?.reservation,
                      ...reviewing.entity?.reservation,
                      details: {
                        ...selected?.reservation.details,
                        ...reviewing.entity?.reservation.details,
                      },
                    }
                  : undefined)
              }
              busy={busy}
              label={reviewing ? "Apply reviewed change" : "Save reservation"}
              onCancel={() => setDialog(null)}
              onSave={async (reservation: Reservation) => {
                await run(async () => {
                  await onCommand(
                    reviewing
                      ? {
                          kind: "review",
                          reviewId: reviewing.id,
                          decision: "apply",
                          target: {
                            tripId: targetTrip,
                            itemId: targetItem || undefined,
                            reservation,
                          },
                        }
                      : editing
                        ? { kind: "edit", itemId: editing.id, reservation }
                        : { kind: "add", tripId, reservation },
                  );
                  setDialog(null);
                }, true);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
