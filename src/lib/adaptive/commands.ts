import { z } from "zod";
import { PreferenceSchema, ReservationSchema, type TravelDossier } from "./types";
import {
  applyReservation,
  matchCanonical,
  recordChange,
  resolveReview,
  restoreVersion,
} from "./reconcile";
import { setPhase } from "./live";
import { stable } from "./normalize";

export const AdaptiveCommandSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("phase"),
    tripId: z.string(),
    phase: z.enum(["planning", "live", "paused", "ended"]),
    extendedUntil: z.string().datetime({ offset: true }).optional(),
  }),
  z.object({ kind: z.literal("preferences"), tripId: z.string(), preferences: PreferenceSchema }),
  z.object({
    kind: z.literal("review"),
    reviewId: z.string(),
    decision: z.enum(["dismiss", "apply"]),
    target: z
      .object({
        tripId: z.string(),
        itemId: z.string().optional(),
        reservation: ReservationSchema.optional(),
      })
      .optional(),
  }),
  z.object({ kind: z.literal("edit"), itemId: z.string(), reservation: ReservationSchema }),
  z.object({ kind: z.literal("add"), tripId: z.string(), reservation: ReservationSchema }),
  z.object({ kind: z.literal("restore"), versionId: z.string() }),
  z.object({ kind: z.literal("restore-live"), auditId: z.string() }),
  z.object({ kind: z.literal("dismiss"), notificationId: z.string() }),
]);
export type AdaptiveCommand = z.infer<typeof AdaptiveCommandSchema>;
export function executeCommand(
  input: TravelDossier,
  cmd: AdaptiveCommand,
  now: string,
): TravelDossier {
  const state = structuredClone(input);
  if (cmd.kind === "phase") return setPhase(state, cmd.tripId, cmd.phase, now, cmd.extendedUntil);
  if (cmd.kind === "review")
    return resolveReview(state, cmd.reviewId, cmd.decision, now, cmd.target);
  if (cmd.kind === "restore") return restoreVersion(state, cmd.versionId, now);
  if (cmd.kind === "restore-live") {
    const audit = state.audit.find((a) => a.id === cmd.auditId);
    const item = state.items.find((i) => i.id === audit?.itemId);
    if (!audit || !item) throw new Error("Live history not found.");
    const current = state.live.find((l) => l.itemId === item.id);
    const restored = {
      ...(structuredClone(audit.before) ?? {
        itemId: item.id,
        signalIds: [],
        cancelled: false,
        values: {},
      }),
      updatedAt: now,
    };
    state.live = [...state.live.filter((l) => l.itemId !== item.id), restored];
    state.audit.push({
      id: "user-restore:" + item.id + ":" + now,
      itemId: item.id,
      signalId: audit.signalId,
      at: now,
      before: structuredClone(current),
      after: restored,
      rationale:
        "Traveler restored the prior dossier status after reviewing provider information. External bookings are unchanged.",
    });
    for (const notice of state.notifications.filter(
      (n) => n.itemId === item.id && !n.dismissedAt,
    )) {
      notice.dismissedAt = now;
      notice.status = "suppressed";
      notice.suppression = "Traveler restored prior live status";
    }
    recordChange(state, {
      id: "live-restore:" + item.id + ":" + now,
      tripId: item.tripId,
      itemId: item.id,
      at: now,
      kind: "restored",
      actor: "user",
      summary: "Prior live dossier status restored",
      rationale:
        "The traveler changed the displayed operational values only. New provider evidence can update them again.",
    });
  }
  if (cmd.kind === "preferences") {
    const trip = state.trips.find((t) => t.id === cmd.tripId);
    if (!trip) throw new Error("Trip not found.");
    trip.preferences = cmd.preferences;
    recordChange(state, {
      id: `prefs:${cmd.tripId}:${now}`,
      tripId: cmd.tripId,
      at: now,
      kind: "preferences",
      actor: "user",
      summary: "Notification and privacy preferences updated",
      rationale: "Changed by the traveler.",
    });
  }
  if (cmd.kind === "edit") {
    const item = state.items.find((i) => i.id === cmd.itemId);
    if (!item) throw new Error("Reservation not found.");
    const fields = Object.keys(cmd.reservation).filter(
      (k) =>
        stable(item.reservation[k as keyof typeof cmd.reservation]) !==
        stable(cmd.reservation[k as keyof typeof cmd.reservation]),
    );
    applyReservation(
      state,
      item,
      cmd.reservation,
      now,
      `edit:${item.id}:${now}`,
      undefined,
      "user",
    );
    item.userEditedFields = [...new Set([...item.userEditedFields, ...fields])];
  }
  if (cmd.kind === "add") {
    if (!state.trips.some((t) => t.id === cmd.tripId)) throw new Error("Trip not found.");
    if (!cmd.reservation.startAt) throw new Error("Add a timezone-aware start time.");
    if (cmd.reservation.status === "cancelled")
      throw new Error("Cancel an existing reservation instead of creating a cancelled item.");
    const match = matchCanonical(state.items, {
      key: "user",
      reservation: cmd.reservation,
      confidence: 1,
      rationale: "User entered",
    });
    if (match.candidates.length)
      throw new Error("A similar reservation already exists. Edit that item or review the match.");
    const id = `user:${cmd.tripId}:${now}`;
    state.items.push({
      id,
      tripId: cmd.tripId,
      reservation: cmd.reservation,
      original: structuredClone(cmd.reservation),
      sourceKind: "user",
      sourceIds: [],
      confidence: 1,
      userEditedFields: Object.keys(cmd.reservation),
      createdAt: now,
      updatedAt: now,
    });
    recordChange(state, {
      id: `${id}:created`,
      itemId: id,
      tripId: cmd.tripId,
      at: now,
      kind: "created",
      actor: "user",
      summary: `${cmd.reservation.title} added`,
      rationale: "Entered by the traveler.",
    });
  }
  if (cmd.kind === "dismiss") {
    const event = state.notifications.find((n) => n.id === cmd.notificationId);
    if (!event) throw new Error("Update not found.");
    event.dismissedAt = now;
    if (event.status === "pending") {
      event.status = "dashboard";
      event.suppression = "Dismissed by the traveler";
    }
    state.recommendations
      .filter((r) => r.signalId === event.signalId)
      .forEach((r) => (r.dismissedAt = now));
    recordChange(state, {
      id: `dismiss:${event.id}`,
      itemId: event.itemId,
      tripId: event.tripId,
      at: now,
      kind: "dismissed",
      actor: "user",
      summary: "Update dismissed",
      rationale: "Dismissed by the traveler; source and audit history retained.",
    });
  }
  return state;
}
