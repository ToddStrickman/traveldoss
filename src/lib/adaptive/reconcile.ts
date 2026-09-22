import {
  ReservationSchema,
  type CanonicalItineraryItem,
  type ExtractedTravelEntity,
  type ImportedEmailMessage,
  type Reservation,
  type TravelDossier,
} from "./types";
import {
  instant,
  normalized,
  normalizeReservation,
  providerName,
  reference,
  sameDay,
  sameRoute,
  stable,
} from "./normalize";

export function matchCanonical(items: CanonicalItineraryItem[], entity: ExtractedTravelEntity) {
  const r = entity.reservation;
  const compatible = items.filter(
    (i) =>
      i.reservation.type === r.type &&
      providerName(i.reservation.provider) === providerName(r.provider) &&
      !(
        entity.replacesConfirmation &&
        i.reservation.status === "cancelled" &&
        reference(i.reservation.confirmation) === reference(entity.replacesConfirmation) &&
        reference(r.confirmation) !== reference(entity.replacesConfirmation)
      ),
  );
  const exact = r.confirmation
    ? compatible.filter((i) => reference(i.reservation.confirmation) === reference(r.confirmation))
    : [];
  // PNRs can cover several travelers/legs. Never collapse a return leg just because its PNR matches.
  if (exact.length) {
    const narrowed = exact.filter(
      (i) =>
        (!r.traveler ||
          !i.reservation.traveler ||
          normalized(r.traveler) === normalized(i.reservation.traveler)) &&
        (!r.origin || !r.destination || sameRoute(r, i.reservation)),
    );
    return {
      candidates: narrowed.length ? narrowed : exact,
      confidence: narrowed.length === 1 ? 1 : 0.6,
      reason:
        narrowed.length === 1
          ? "Exact reservation reference, provider, and compatible journey"
          : "Reservation reference covers conflicting or multiple journeys",
    };
  }
  const composite = compatible.filter(
    (i) =>
      !!r.traveler &&
      normalized(r.traveler) === normalized(i.reservation.traveler) &&
      sameDay(r.startAt, i.reservation.startAt) &&
      sameRoute(r, i.reservation),
  );
  if (composite.length)
    return {
      candidates: composite,
      confidence:
        composite.length === 1 &&
        !(
          r.confirmation &&
          composite[0].reservation.confirmation &&
          reference(r.confirmation) !== reference(composite[0].reservation.confirmation)
        )
          ? 0.96
          : 0.6,
      reason:
        "Provider, traveler, time, and route/location match; conflicting references need review",
    };
  const contextual = compatible.filter(
    (i) => sameDay(r.startAt, i.reservation.startAt) && sameRoute(r, i.reservation),
  );
  return {
    candidates: contextual,
    confidence: contextual.length ? 0.8 : 0,
    reason: contextual.length
      ? "Similar itinerary details need confirmation"
      : "No existing reservation matches",
  };
}

function tripCandidates(state: TravelDossier, r: Partial<Reservation>): string[] {
  if (!r.startAt) return [];
  const day = r.startAt.slice(0, 10);
  return state.trips
    .filter(
      (t) =>
        !!t.startDate &&
        !!t.endDate &&
        day >= t.startDate &&
        day <= t.endDate &&
        [r.destination, r.location, r.address, r.details?.destinationCity].some(
          (v) => !!v && normalized(v).includes(normalized(t.destination)),
        ),
    )
    .map((t) => t.id);
}

export function recordChange(state: TravelDossier, change: TravelDossier["changes"][number]) {
  if (!state.changes.some((c) => c.id === change.id)) state.changes.push(change);
}
function review(
  state: TravelDossier,
  id: string,
  sourceId: string,
  entity: ExtractedTravelEntity,
  reason: string,
  candidates: CanonicalItineraryItem[],
  now: string,
) {
  state.reviews.push({
    id,
    sourceId,
    entity,
    reason,
    candidateIds: candidates.map((c) => c.id),
    tripId: candidates[0]?.tripId,
    status: "open",
    at: now,
  });
}
export function applyReservation(
  state: TravelDossier,
  item: CanonicalItineraryItem,
  next: Reservation,
  at: string,
  eventId: string,
  sourceId?: string,
  actor: "email" | "user" | "restore" = "email",
) {
  if (stable(item.reservation) === stable(next)) return;
  state.versions.push({
    id: `${eventId}:v`,
    itemId: item.id,
    at,
    actor,
    sourceId,
    reservation: structuredClone(item.reservation),
  });
  const fields = Object.keys(next).filter(
    (k) =>
      stable(item.reservation[k as keyof Reservation]) !== stable(next[k as keyof Reservation]),
  );
  item.reservation = next;
  item.updatedAt = at;
  recordChange(state, {
    id: eventId,
    itemId: item.id,
    tripId: item.tripId,
    at,
    actor: actor === "email" ? "email" : "user",
    sourceId,
    kind: next.status === "cancelled" ? "cancelled" : actor === "restore" ? "restored" : "updated",
    summary: next.status === "cancelled" ? `${next.title} cancelled` : `${next.title} updated`,
    rationale: `Changed ${fields.join(", ")}. Prior values are preserved in history.`,
  });
}

export function reconcileEmail(
  input: TravelDossier,
  message: ImportedEmailMessage,
  entities: ExtractedTravelEntity[],
  now: string,
): TravelDossier {
  const state = structuredClone(input);
  const messageKey = `${message.accountId}:${message.id}`;
  if (state.processed.includes(messageKey)) return state;
  state.processed.push(messageKey);
  if (!entities.length) return state; // no email body retained for non-travel messages
  for (const [index, raw] of entities.entries()) {
    const entity = { ...raw, reservation: normalizeReservation(raw.reservation) };
    const sourceId = `${messageKey}:${index}`;
    state.sources.push({
      id: sourceId,
      messageId: message.id,
      accountId: message.accountId,
      provider: message.provider,
      receivedAt: message.receivedAt,
      subject: message.subject.slice(0, 240),
      sender: message.sender.slice(0, 240),
      excerpt: message.text.slice(0, 1200),
      confidence: entity.confidence,
      rationale: entity.rationale,
    });
    const { candidates, confidence, reason } = matchCanonical(state.items, entity);
    const match = candidates.length === 1 && confidence >= 0.95 ? candidates[0] : undefined;
    const tripIds = tripCandidates(state, entity.reservation);
    if (entity.confidence < 0.95 || (candidates.length > 0 && !match)) {
      review(
        state,
        `${sourceId}:review`,
        sourceId,
        entity,
        entity.confidence < 0.95 ? entity.rationale : reason,
        candidates,
        now,
      );
      continue;
    }
    if (match) {
      if (!match.sourceIds.includes(sourceId)) match.sourceIds.push(sourceId);
      match.lastSyncedAt = now;
      if (
        match.latestEvidenceAt &&
        instant(message.receivedAt) <= instant(match.latestEvidenceAt)
      ) {
        recordChange(state, {
          id: `${sourceId}:stale`,
          itemId: match.id,
          tripId: match.tripId,
          at: now,
          kind: "evidence",
          actor: "email",
          sourceId,
          summary: "Earlier evidence retained",
          rationale:
            "This message predates the latest applied evidence; current reservation values were preserved.",
        });
        continue;
      }
      const patch = Object.fromEntries(
        Object.entries(entity.reservation).filter(
          ([k, v]) =>
            v !== undefined &&
            !(k === "title" && entity.reservation.title === "Travel reservation"),
        ),
      );
      // A cancellation notice may omit all booking details. Keep the original schedule/route.
      const next = {
        ...match.reservation,
        ...patch,
        details: { ...match.reservation.details, ...entity.reservation.details },
      } as Reservation;
      const changed = Object.keys(next).filter(
        (k) =>
          stable(match.reservation[k as keyof Reservation]) !==
          stable(next[k as keyof Reservation]),
      );
      if (
        (match.reservation.status === "cancelled" && next.status !== "cancelled") ||
        changed.some((k) => match.userEditedFields.includes(k))
      ) {
        review(
          state,
          `${sourceId}:review`,
          sourceId,
          entity,
          "This update conflicts with a user edit or would reactivate a cancelled reservation.",
          [match],
          now,
        );
        continue;
      }
      const valid = ReservationSchema.safeParse(next);
      if (!valid.success) {
        review(
          state,
          `${sourceId}:review`,
          sourceId,
          entity,
          "The updated dates or reservation details are incomplete or inconsistent.",
          [match],
          now,
        );
        continue;
      }
      applyReservation(state, match, valid.data, now, `${sourceId}:change`, sourceId);
      match.latestEvidenceAt = message.receivedAt;
      continue;
    }
    if (entity.reservation.status === "cancelled") {
      review(
        state,
        `${sourceId}:review`,
        sourceId,
        entity,
        "Cancellation has no confident match. No reservation was created or cancelled.",
        candidates,
        now,
      );
      continue;
    }
    const valid = ReservationSchema.safeParse(entity.reservation);
    if (!valid.success || !valid.data.startAt || tripIds.length !== 1) {
      review(
        state,
        `${sourceId}:review`,
        sourceId,
        entity,
        !valid.success || !entity.reservation.startAt
          ? "Dates, timezone, or reservation details need review."
          : "Choose the trip this reservation belongs to.",
        [],
        now,
      );
      continue;
    }
    const item: CanonicalItineraryItem = {
      id: `${sourceId}:item`,
      tripId: tripIds[0],
      reservation: valid.data,
      original: structuredClone(valid.data),
      sourceKind: "email",
      sourceIds: [sourceId],
      confidence: entity.confidence,
      userEditedFields: [],
      latestEvidenceAt: message.receivedAt,
      lastSyncedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    if (entity.replacesConfirmation) {
      const prior = state.items.filter(
        (i) =>
          i.tripId === item.tripId &&
          i.reservation.status === "cancelled" &&
          i.reservation.type === item.reservation.type &&
          providerName(i.reservation.provider) === providerName(item.reservation.provider) &&
          reference(i.reservation.confirmation) === reference(entity.replacesConfirmation),
      );
      if (prior.length === 1) {
        item.replacesItemId = prior[0].id;
        prior[0].replacedByItemId = item.id;
      }
    }
    state.items.push(item);
    // Gmail may return the cancellation before its older confirmation during history scans.
    // Reconcile only exact, authenticated cancellation evidence once the missing record exists.
    const waiting = state.reviews.filter(
      (q) =>
        q.status === "open" &&
        q.entity?.reservation.status === "cancelled" &&
        q.entity.confidence >= 0.95,
    );
    for (const queue of waiting) {
      const evidence = state.sources.find((s) => s.id === queue.sourceId);
      const matches = matchCanonical(state.items, queue.entity!);
      if (
        !evidence ||
        matches.candidates.length !== 1 ||
        matches.candidates[0].id !== item.id ||
        matches.confidence < 0.95 ||
        !queue.entity?.reservation.confirmation ||
        instant(evidence.receivedAt) <= instant(item.latestEvidenceAt)
      )
        continue;
      applyReservation(
        state,
        item,
        { ...item.reservation, status: "cancelled" },
        now,
        queue.id + ":reconciled",
        queue.sourceId,
      );
      if (queue.sourceId) item.sourceIds.push(queue.sourceId);
      item.latestEvidenceAt = evidence.receivedAt;
      queue.status = "applied";
      queue.resolvedAt = now;
      queue.tripId = item.tripId;
      queue.reason =
        "The missing confirmation arrived; exact cancellation evidence was reconciled automatically.";
    }
    recordChange(state, {
      id: `${sourceId}:created`,
      itemId: item.id,
      tripId: item.tripId,
      at: now,
      actor: "email",
      sourceId,
      kind: item.replacesItemId ? "rebooked" : "created",
      summary: `${item.reservation.title} added`,
      rationale: entity.rationale,
    });
  }
  return state;
}

export function resolveReview(
  input: TravelDossier,
  reviewId: string,
  decision: "dismiss" | "apply",
  now: string,
  target?: { tripId: string; itemId?: string; reservation?: Reservation },
): TravelDossier {
  const state = structuredClone(input),
    queue = state.reviews.find((r) => r.id === reviewId);
  if (!queue || queue.status !== "open") return state;
  if (decision === "apply") {
    if (queue.signal)
      throw new Error(
        "Verify this uncertain live update with the provider, then explicitly edit the reservation if needed.",
      );
    if (!target || !state.trips.some((t) => t.id === target.tripId))
      throw new Error("Choose an existing trip.");
    const source = state.sources.find((s) => s.id === queue.sourceId);
    const item = target.itemId
      ? state.items.find((i) => i.id === target.itemId && i.tripId === target.tripId)
      : undefined;
    if (target.itemId && !item)
      throw new Error("The selected reservation does not belong to this trip.");
    const r = ReservationSchema.parse(
      target.reservation ?? {
        ...item?.reservation,
        ...queue.entity?.reservation,
        details: { ...item?.reservation.details, ...queue.entity?.reservation.details },
      },
    );
    if (!item && r.status === "cancelled")
      throw new Error(
        "Select the existing reservation to cancel; a cancellation cannot create a new item.",
      );
    if (item) {
      applyReservation(state, item, r, now, `${reviewId}:applied`, queue.sourceId, "user");
      if (queue.sourceId && !item.sourceIds.includes(queue.sourceId))
        item.sourceIds.push(queue.sourceId);
      item.userEditedFields = [...new Set([...item.userEditedFields, ...Object.keys(r)])];
    } else {
      if (!r.startAt)
        throw new Error("Add a timezone-aware start time before creating a reservation.");
      const duplicates = matchCanonical(state.items, {
        key: reviewId,
        reservation: r,
        confidence: 1,
        rationale: "User reviewed",
      });
      if (duplicates.candidates.length)
        throw new Error("A similar reservation exists. Select it instead of creating a duplicate.");
      state.items.push({
        id: `${reviewId}:item`,
        tripId: target.tripId,
        reservation: r,
        original: structuredClone(r),
        sourceKind: source ? "email" : "user",
        sourceIds: queue.sourceId ? [queue.sourceId] : [],
        confidence: 1,
        userEditedFields: Object.keys(r),
        createdAt: now,
        updatedAt: now,
        latestEvidenceAt: source?.receivedAt,
      });
    }
  }
  queue.status = decision === "apply" ? "applied" : "dismissed";
  queue.resolvedAt = now;
  recordChange(state, {
    id: `${reviewId}:resolved`,
    tripId: target?.tripId ?? queue.tripId,
    at: now,
    actor: "user",
    kind: "review",
    sourceId: queue.sourceId,
    summary: `Review ${queue.status}`,
    rationale: "The traveler explicitly reviewed this evidence.",
  });
  return state;
}

export function restoreVersion(
  input: TravelDossier,
  versionId: string,
  now: string,
): TravelDossier {
  const state = structuredClone(input),
    version = state.versions.find((v) => v.id === versionId);
  const item = state.items.find((i) => i.id === version?.itemId);
  if (!version || !item) throw new Error("Version not found.");
  applyReservation(
    state,
    item,
    structuredClone(version.reservation),
    now,
    `restore:${versionId}:${now}`,
    undefined,
    "restore",
  );
  item.userEditedFields = Object.keys(item.reservation);
  return state;
}
