/**
 * The Live Map overlay.
 *
 * One full-screen plate owned by SkinFrame, opened from the masthead Map
 * button, the desktop view-switch segment, a day header's Map pill, or a
 * `?map=` link. It plots ONLY the stops currently visible on screen when
 * it opens (collapsed days, hidden carousel alternatives and the collapsed
 * Plan-B section are excluded by checking real DOM visibility), except the
 * day it was opened from, which is always included.
 *
 * Rendering: MapLibre over OpenFreeMap vector tiles restyled from the skin's
 * tokens (`MapCanvas`), or parchment mode when that is not possible
 * (`MapParchment`). Coordinates are persisted at enrichment time, so
 * opening the map never geocodes.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Crosshair, MapPin as MapPinIcon, Minus, Plus, X } from "lucide-react";
import type { Block, SkinTokens, TripView } from "@/lib/skins/types";
import { buildMapModel, type MapModel, type MapPlace } from "@/lib/maps/build-map-places";
import { alpha } from "@/lib/maps/color";
import { pinPalette } from "@/lib/maps/taxonomy";
import { useMapLocator, type MapEntry } from "@/lib/maps/use-map-param";
import {
  trackMapClosed,
  trackMapDayToggled,
  trackMapLocateRequested,
  trackMapOpened,
  trackMapPinSelected,
  trackMapPlanBToggled,
  trackMapRouteToggled,
  trackMapTilesFailed,
} from "@/lib/analytics";
import { MapCanvas, type MapCanvasHandle, type MapStatus } from "./MapCanvas";
import { MapParchment } from "./MapParchment";
import { visitLabel } from "./MapPin";
import "./map.css";

export { indexDayLookup } from "@/lib/maps/build-map-places";

/** Indexes of activity blocks currently visible (untruncated) on screen. */
export function collectVisibleIndexes(): Set<number> {
  const out = new Set<number>();
  if (typeof document === "undefined") return out;
  const nodes = document.querySelectorAll<HTMLElement>(".tds [data-block-index]");
  for (const el of nodes) {
    const idx = Number(el.dataset.blockIndex);
    if (Number.isNaN(idx)) continue;
    // Structural visibility only (display/visibility/collapsed ancestors).
    // content-visibility:auto skipping is a scroll-perf optimization, not
    // user truncation — off-screen days still belong on the map.
    const visible =
      typeof el.checkVisibility === "function" ? el.checkVisibility() : el.offsetParent !== null;
    if (visible) out.add(idx);
  }
  return out;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function DossierMapOverlay({
  trip,
  blocks,
  tokens,
  onClose,
  initialDay,
  entry,
}: {
  trip: TripView;
  blocks: Block[];
  tokens: SkinTokens;
  onClose: () => void;
  /** Open focused on one day: every OTHER day starts hidden; the day chips
   *  restore them. */
  initialDay?: number | null;
  entry?: MapEntry | null;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const canvasRef = useRef<MapCanvasHandle | null>(null);
  const openedAt = useRef(Date.now());
  const selections = useRef(0);
  const [status, setStatus] = useState<MapStatus>("loading");
  const [parchment, setParchment] = useState(false);
  const [showRoute, setShowRoute] = useState(true);
  const [showPlanB, setShowPlanB] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // "Locate stops": present only for the owner (the dossier route registers
  // it when the viewer can edit). Runs once automatically when the map opens
  // on unlocated stops, and on demand from the empty state or the footer.
  const locator = useMapLocator();
  const [locating, setLocating] = useState(false);
  const [locateNote, setLocateNote] = useState<string | null>(null);
  const [modelVersion, setModelVersion] = useState(0);
  const autoLocated = useRef(false);

  // Snapshot the screen at open time — the "untruncated only" contract.
  const model: MapModel = useMemo(
    () =>
      buildMapModel(trip, blocks, {
        onlyVisible: collectVisibleIndexes(),
        forceDay: initialDay ?? null,
      }),
    // Computed once per open on purpose (plus once per locate pass): the
    // overlay reflects the screen state at the moment it was opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [modelVersion],
  );
  const eligibleToLocate = useMemo(
    () => model.unlocated.filter((u) => u.status === "none" || u.status === "pending").length,
    [model],
  );
  const cappedStops = useMemo(() => model.unlocated.filter((u) => u.status === "needs_review").length, [model]);

  const runLocate = useCallback(
    async (auto: boolean, retryNeedsReview = false) => {
      if (!locator || locating) return;
      const requested = retryNeedsReview ? model.unlocated.length : eligibleToLocate;
      setLocating(true);
      setLocateNote(null);
      try {
        const res = await locator.locate({ retryNeedsReview });
        trackMapLocateRequested({
          auto,
          requested,
          located: res.located,
          unresolved: res.unresolved,
          configured: res.configured,
        });
        if (!res.configured) {
          setLocateNote("Location lookup isn't set up on this server yet, so stops can't be pinned here.");
        } else if (res.located > 0) {
          setLocateNote(
            `Located ${res.located} stop${res.located === 1 ? "" : "s"}` +
              (res.unresolved > 0 ? `. ${res.unresolved} couldn't be found; a street address helps.` : "."),
          );
        } else if (res.unresolved > 0) {
          setLocateNote(
            `${res.unresolved} stop${res.unresolved === 1 ? "" : "s"} couldn't be found. Add a street address to each and try again.`,
          );
        } else {
          setLocateNote("No new locations were found.");
        }
        setModelVersion((v) => v + 1);
      } catch (err) {
        console.error("[live-map] locate failed", err);
        setLocateNote("Couldn't locate stops just now. Try again in a moment.");
      } finally {
        setLocating(false);
      }
    },
    [locator, locating, model, eligibleToLocate],
  );

  useEffect(() => {
    if (autoLocated.current || !locator || eligibleToLocate === 0) return;
    autoLocated.current = true;
    void runLocate(true);
  }, [locator, eligibleToLocate, runLocate]);
  const palette = useMemo(() => pinPalette(tokens), [tokens]);
  const hasPlanB = useMemo(() => model.places.some((p) => p.tier === "shadow"), [model]);

  const [hiddenDays, setHiddenDays] = useState<Set<number>>(() =>
    initialDay == null ? new Set<number>() : new Set(model.days.filter((d) => d !== initialDay)),
  );
  const focusedDay =
    model.days.length - hiddenDays.size === 1
      ? (model.days.find((d) => !hiddenDays.has(d)) ?? null)
      : null;

  const visible = useMemo<MapPlace[]>(
    () =>
      model.places.filter((p) => {
        if (p.tier === "shadow" && !showPlanB) return false;
        // A place stays while any of its visits is on a shown day; preface
        // stops (hotel, essentials) always stay.
        return p.visits.some((v) => v.day == null || !hiddenDays.has(v.day));
      }),
    [model, hiddenDays, showPlanB],
  );

  const selected = useMemo(
    () => model.places.find((p) => p.key === selectedKey) ?? null,
    [model, selectedKey],
  );

  // Analytics: one open, one close.
  useEffect(() => {
    trackMapOpened({
      entry: entry ?? "deeplink",
      surface: typeof window !== "undefined" && window.innerWidth < 768 ? "mobile" : "desktop",
      located_count: model.places.length,
      unlocated_count: model.unlocated.length,
      day_count: model.days.length,
      focused_day: initialDay != null,
      renderer: parchment ? "parchment" : "maplibre",
    });
    const startedAt = openedAt.current;
    return () => {
      trackMapClosed({ duration_ms: Date.now() - startedAt, pins_selected: selections.current });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onStatus = useCallback((s: MapStatus) => {
    setStatus(s);
    if (s === "error") {
      setParchment(true);
      trackMapTilesFailed("openfreemap");
    }
  }, []);

  const onSelect = useCallback(
    (key: string | null) => {
      setSelectedKey(key);
      if (key) {
        selections.current++;
        const p = model.places.find((x) => x.key === key);
        if (p) {
          trackMapPinSelected({
            kind: p.kind,
            via: "click",
            has_image: !!p.imageUrl,
            has_reservation: !!p.reservation,
          });
        }
      }
    },
    [model],
  );

  const toggleDay = useCallback(
    (day: number) => {
      setHiddenDays((prev) => {
        const next = new Set(prev);
        const nowHidden = !next.has(day);
        if (nowHidden) next.add(day);
        else next.delete(day);
        trackMapDayToggled(!nowHidden, model.days.length - next.size);
        return next;
      });
    },
    [model.days.length],
  );

  // Escape closes; body scroll locks; focus is trapped inside the dialog.
  useEffect(() => {
    const dialog = dialogRef.current;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        if (selectedKey) setSelectedKey(null);
        else onClose();
        return;
      }
      if (e.key === "Tab" && dialog) {
        const nodes = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
          (n) => n.offsetParent !== null || n === document.activeElement,
        );
        if (nodes.length === 0) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, selectedKey]);

  const vars = {
    "--map-paper": tokens.bg,
    "--map-paper-90": alpha(tokens.bg, 0.9),
    "--map-paper-94": alpha(tokens.bg, 0.94),
    "--map-ink": tokens.ink,
    "--map-ink-70": alpha(tokens.ink, 0.7),
    "--map-ink-60": alpha(tokens.ink, 0.6),
    "--map-ink-08": alpha(tokens.ink, 0.08),
    "--map-accent": tokens.accent,
    "--map-rule": tokens.rule,
    "--tds-fontBody": tokens.fontBody,
    "--tds-fontDisplay": tokens.fontDisplay,
  } as CSSProperties;

  const count = visible.length;
  const empty = model.places.length === 0;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Live map of ${trip.destination}`}
      data-print="hide"
      id="live-map"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 70,
        display: "flex",
        flexDirection: "column",
        background: tokens.bg,
        color: tokens.ink,
        fontFamily: tokens.fontBody,
        ...vars,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "12px 16px",
          paddingTop: "calc(12px + env(safe-area-inset-top, 0px))",
          borderBottom: `1px solid ${tokens.rule}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <MapPinIcon size={16} color={tokens.accent} aria-hidden style={{ flex: "0 0 auto" }} />
          <span
            style={{
              font: `600 11px/1 ${tokens.fontBody}`,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
              flex: "0 0 auto",
            }}
          >
            The Live Map
          </span>
          <span
            style={{
              color: tokens.inkSoft,
              fontSize: 12,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {trip.destination} · {count} stop{count === 1 ? "" : "s"}
            {model.days.length > 0 ? ` · ${model.days.length} day${model.days.length === 1 ? "" : "s"}` : ""}
          </span>
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close map"
          className="tds-map-iconbtn"
          style={{ width: 40, height: 40, background: "transparent" }}
        >
          <X size={16} aria-hidden />
        </button>
      </header>

      {model.days.length > 0 || hasPlanB ? (
        <div
          style={{
            display: "flex",
            gap: 8,
            padding: "10px 16px",
            overflowX: "auto",
            alignItems: "center",
            borderBottom: `1px solid ${tokens.rule}`,
            scrollbarWidth: "none",
          }}
        >
          {model.days.map((d) => {
            const off = hiddenDays.has(d);
            return (
              <button key={d} type="button" className="tds-map-chip" onClick={() => toggleDay(d)} aria-pressed={!off}>
                <span className="dot" aria-hidden />
                Day {String(d).padStart(2, "0")}
              </button>
            );
          })}
          <span aria-hidden style={{ width: 1, height: 20, background: tokens.rule, margin: "0 4px", flex: "0 0 auto" }} />
          <button
            type="button"
            className="tds-map-chip"
            aria-pressed={showRoute}
            onClick={() =>
              setShowRoute((v) => {
                trackMapRouteToggled(!v);
                return !v;
              })
            }
          >
            Route
          </button>
          {hasPlanB ? (
            <button
              type="button"
              className="tds-map-chip"
              aria-pressed={showPlanB}
              onClick={() =>
                setShowPlanB((v) => {
                  trackMapPlanBToggled(!v);
                  return !v;
                })
              }
            >
              Plan B
            </button>
          ) : null}
        </div>
      ) : null}

      <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
        {empty ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              padding: 24,
              color: tokens.inkSoft,
              font: `500 13px/1.6 ${tokens.fontBody}`,
              textAlign: "center",
            }}
          >
            <div style={{ maxWidth: 380 }}>
              <div style={{ font: `500 22px/1.2 ${tokens.fontDisplay}`, color: tokens.ink, marginBottom: 8 }}>
                {locating ? "Locating your stops…" : "Nothing pinned yet"}
              </div>
              {locating ? (
                <span aria-live="polite">
                  Looking up {eligibleToLocate} stop{eligibleToLocate === 1 ? "" : "s"}. This takes a few seconds.
                </span>
              ) : locator ? (
                <>
                  {locateNote ??
                    `${model.unlocated.length} stop${model.unlocated.length === 1 ? " has" : "s have"} no location yet.`}
                  <div style={{ marginTop: 16, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                    {eligibleToLocate > 0 || cappedStops > 0 ? (
                      <button
                        type="button"
                        className="tds-map-chip"
                        aria-pressed="true"
                        onClick={() => void runLocate(false, eligibleToLocate === 0)}
                      >
                        {eligibleToLocate > 0 ? "Locate stops" : "Try the unfound stops again"}
                      </button>
                    ) : null}
                  </div>
                </>
              ) : (
                "This dossier's places haven't been pinned yet. The owner can locate them from the map."
              )}
            </div>
          </div>
        ) : parchment ? (
          <MapParchment
            model={model}
            visible={visible}
            tokens={tokens}
            palette={palette}
            showRoute={showRoute}
            showOrder={focusedDay != null}
            selectedKey={selectedKey}
            onSelect={onSelect}
            hiddenDays={hiddenDays}
          />
        ) : (
          <MapCanvas
            ref={canvasRef}
            model={model}
            visible={visible}
            tokens={tokens}
            palette={palette}
            hiddenDays={hiddenDays}
            showRoute={showRoute}
            showOrder={focusedDay != null}
            selectedKey={selectedKey}
            onSelect={onSelect}
            onStatus={onStatus}
          />
        )}

        {!empty && !parchment ? (
          <div className="tds-map-controls">
            <button
              type="button"
              className="tds-map-iconbtn"
              aria-label="Fit the whole trip"
              title="Fit trip"
              onClick={() => canvasRef.current?.fitAll()}
            >
              <Crosshair size={15} aria-hidden />
            </button>
            <button type="button" className="tds-map-iconbtn" aria-label="Zoom in" onClick={() => canvasRef.current?.zoomIn()}>
              <Plus size={15} aria-hidden />
            </button>
            <button type="button" className="tds-map-iconbtn" aria-label="Zoom out" onClick={() => canvasRef.current?.zoomOut()}>
              <Minus size={15} aria-hidden />
            </button>
          </div>
        ) : null}

        {status === "loading" && !parchment && !empty ? (
          <div
            aria-live="polite"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 12,
              display: "grid",
              placeItems: "center",
              pointerEvents: "none",
              color: tokens.inkSoft,
              font: `500 11px/1.5 ${tokens.fontBody}`,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            Plotting your dossier…
          </div>
        ) : null}

        {selected ? (
          <div className="tds-map-caption" role="status">
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="tds-map-caption-eyebrow">
                {[
                  selected.visits[0] ? visitLabel(selected.visits[0]) : null,
                  selected.tier === "shadow" ? "Plan B" : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Trip essentials"}
              </div>
              <div className="tds-map-caption-name">{selected.name}</div>
              {selected.address || selected.visits.length > 1 ? (
                <div
                  className="tds-map-caption-meta"
                  style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                >
                  {selected.visits.length > 1 ? `${selected.visits.length} visits · ` : ""}
                  {selected.address ?? ""}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className="tds-map-iconbtn"
              aria-label="Dismiss"
              style={{ width: 32, height: 32 }}
              onClick={() => setSelectedKey(null)}
            >
              <X size={14} aria-hidden />
            </button>
          </div>
        ) : null}
      </div>

      {!empty && (model.unlocated.length > 0 || locateNote) ? (
        <footer
          aria-live="polite"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            padding: "8px 16px",
            paddingBottom: "calc(8px + env(safe-area-inset-bottom, 0px))",
            borderTop: `1px solid ${tokens.rule}`,
            color: tokens.inkSoft,
            font: `500 11px/1.4 ${tokens.fontBody}`,
          }}
        >
          <span style={{ flex: "1 1 auto", minWidth: 0 }}>
            {locating
              ? `Locating ${eligibleToLocate} stop${eligibleToLocate === 1 ? "" : "s"}…`
              : locateNote ??
                `${model.unlocated.length} visible stop${model.unlocated.length === 1 ? "" : "s"} without a location` +
                  (cappedStops > 0
                    ? ` — ${cappedStops} couldn't be found`
                    : locator
                      ? ""
                      : " — the owner can locate them from the map") +
                  "."}
          </span>
          {locator && !locating && (eligibleToLocate > 0 || cappedStops > 0) ? (
            <button
              type="button"
              className="tds-map-chip"
              onClick={() => void runLocate(false, eligibleToLocate === 0)}
            >
              {eligibleToLocate > 0 ? "Locate stops" : "Try again"}
            </button>
          ) : null}
        </footer>
      ) : null}
    </div>
  );
}
