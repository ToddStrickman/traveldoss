import type { TravelDossier } from "./types";
/** Explicitly requested erasure. Never called by sync, cancellation, or normal reconciliation. */
export function eraseImportedAccount(
  input: TravelDossier,
  accountId: string,
  now: string,
): TravelDossier {
  const state = structuredClone(input);
  const sourceIds = new Set(
    state.sources.filter((s) => s.accountId === accountId).map((s) => s.id),
  );
  const itemIds = new Set(
    state.items.filter((i) => i.sourceIds.some((s) => sourceIds.has(s))).map((i) => i.id),
  );
  const signals = new Set(state.signals.filter((s) => itemIds.has(s.itemId)).map((s) => s.id));
  state.sources = state.sources.filter((s) => !sourceIds.has(s.id));
  state.items = state.items.filter((i) => !itemIds.has(i.id));
  state.versions = state.versions.filter((v) => !itemIds.has(v.itemId));
  state.reviews = state.reviews.filter(
    (r) => !sourceIds.has(r.sourceId ?? "") && !r.candidateIds.some((id) => itemIds.has(id)),
  );
  state.changes = state.changes.filter(
    (c) => !itemIds.has(c.itemId ?? "") && !sourceIds.has(c.sourceId ?? ""),
  );
  state.processed = state.processed.filter((p) => !p.startsWith(`${accountId}:`));
  state.signals = state.signals.filter((s) => !signals.has(s.id));
  state.live = state.live.filter((s) => !itemIds.has(s.itemId));
  state.dependencies = state.dependencies.filter(
    (d) => !itemIds.has(d.fromId) && !itemIds.has(d.toId),
  );
  state.assessments = state.assessments.filter((a) => !itemIds.has(a.itemId));
  state.recommendations = state.recommendations.filter((r) => !itemIds.has(r.itemId));
  state.notifications = state.notifications.filter((n) => !itemIds.has(n.itemId));
  state.audit = state.audit.filter((a) => !itemIds.has(a.itemId));
  state.logs = state.logs.filter((l) => l.accountId !== accountId);
  state.changes.push({
    id: `erase:${accountId}:${now}`,
    at: now,
    actor: "user",
    kind: "privacy",
    summary: "Imported account data deleted",
    rationale: `The traveler explicitly deleted ${itemIds.size} imported reservation(s), their evidence, and associated history.`,
  });
  return state;
}
