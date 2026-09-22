import {
  adaptiveDb,
  checked,
  accounts,
  mutateState,
  readState,
  refreshTrips,
} from "./store.server";
import { decrypt, encrypt, digest } from "./crypto.server";
import { GmailAdapter, type GmailTokens } from "./gmail.server";
import { ConservativeTravelExtractor } from "./extract";
import { reconcileEmail } from "./reconcile";
import { activeItems, applySignals, lifecycle, suppression, signalRelevant } from "./live";
import { liveProviders, PushRelay } from "./live-providers.server";
import { instant, stable } from "./normalize";
import type { ImportedEmailMessage, LiveSignal, TravelDossier } from "./types";

function bookingSignals(
  before: TravelDossier,
  after: TravelDossier,
  message: ImportedEmailMessage,
  now: string,
): LiveSignal[] {
  return after.items.flatMap((item) => {
    const prior = before.items.find((i) => i.id === item.id),
      r = item.reservation;
    if (
      !prior ||
      prior.updatedAt === item.updatedAt ||
      stable(prior.reservation) === stable(r) ||
      !r.startAt
    )
      return [];
    const cancelled = r.status === "cancelled";
    return [
      {
        id: `email:${message.accountId}:${message.id}:${item.id}`,
        itemId: item.id,
        category: r.type === "flight" ? "flights" : "reservations",
        kind: cancelled ? "cancellation" : "schedule",
        source: {
          id: `gmail:${message.accountId}`,
          name: `Email from ${r.provider}`,
          kind: "email",
          authoritative: item.confidence >= 0.95,
        },
        observedAt: message.receivedAt,
        validFrom: now,
        validUntil: new Date(
          Math.max(
            instant(now) + 60_000,
            Math.min(instant(r.startAt) + 3 * 3600_000, instant(now) + 24 * 3600_000),
          ),
        ).toISOString(),
        confidence: item.confidence,
        summary: cancelled
          ? `${r.title} was cancelled.`
          : `${r.title} has updated reservation details.`,
        severity: cancelled ? "severe" : "meaningful",
        action: cancelled
          ? "Review the cancellation and any affected connections. Contact the provider if you need alternatives."
          : "Review the new reservation details and check later plans.",
        association: {
          startAt: r.startAt,
          location: r.origin ?? r.location ?? r.address ?? r.destination ?? "",
          provider: r.provider,
          confirmation: r.confirmation,
          flightNumber: r.details.flightNumber,
        },
        values: {},
      } satisfies LiveSignal,
    ];
  });
}
export async function syncAccount(userId: string, accountId: string) {
  const db = adaptiveDb(),
    lease = crypto.randomUUID();
  if (
    !checked(
      await db.rpc("adaptive_claim_account", {
        p_id: accountId,
        p_user_id: userId,
        p_lease: lease,
      }),
    )
  )
    return;
  try {
    const row = checked(
      await db
        .from("adaptive_email_accounts")
        .select("*")
        .eq("id", accountId)
        .eq("user_id", userId)
        .eq("lease_id", lease)
        .single(),
    );
    if (!row.encrypted_tokens) throw new Error("Reconnect Gmail to resume syncing.");
    const adapter = new GmailAdapter(
      await decrypt<GmailTokens>(row.encrypted_tokens, userId),
      async (tokens) => {
        checked(
          await db
            .from("adaptive_email_accounts")
            .update({ encrypted_tokens: await encrypt(tokens, userId) })
            .eq("id", accountId)
            .eq("user_id", userId)
            .eq("lease_id", lease),
        );
      },
    );
    const page = await adapter.scan(row.sync),
      extractor = new ConservativeTravelExtractor();
    let processed = 0;
    for (const id of page.ids) {
      if ((await readState(userId)).state.processed.includes(`${accountId}:${id}`)) continue;
      const held = checked(
        await db
          .from("adaptive_email_accounts")
          .update({ lease_until: new Date(Date.now() + 120_000).toISOString() })
          .eq("id", accountId)
          .eq("user_id", userId)
          .eq("lease_id", lease)
          .in("status", ["connected", "error"])
          .select("id"),
      );
      if (!held?.length) throw new Error("Sync stopped because the account changed.");
      let message: ImportedEmailMessage;
      try {
        message = await adapter.message(id, accountId);
      } catch (e) {
        if ((e as { status?: number }).status === 404) continue;
        throw e;
      }
      const entities =
        row.sync.scope === "new" && instant(message.receivedAt) < instant(row.sync.connectedAt)
          ? []
          : extractor.extract(message);
      const now = new Date().toISOString();
      await mutateState(userId, (state) => {
        const next = reconcileEmail(state, message, entities, now);
        return applySignals(next, bookingSignals(state, next, message, now), now);
      });
      processed++;
    }
    const now = new Date().toISOString();
    checked(
      await db
        .from("adaptive_email_accounts")
        .update({
          sync: {
            ...page.next,
            processed: row.sync.processed + processed,
            lastSyncedAt: now,
            error: undefined,
          },
          status: "connected",
          updated_at: now,
        })
        .eq("id", accountId)
        .eq("user_id", userId)
        .eq("lease_id", lease),
    );
    await mutateState(userId, (state) => {
      state.logs.push({
        id: `${lease}:log`,
        at: now,
        accountId,
        processed,
        reviewed: state.reviews.filter((r) => r.status === "open").length,
        status: "ok",
        message: page.next.scanning
          ? "Historical scan continues on the next page."
          : "New-message sync is up to date.",
      });
      return state;
    });
  } catch (error) {
    const row = checked(
      await db
        .from("adaptive_email_accounts")
        .select("sync")
        .eq("id", accountId)
        .eq("user_id", userId)
        .eq("lease_id", lease)
        .maybeSingle(),
    );
    if (row)
      checked(
        await db
          .from("adaptive_email_accounts")
          .update({
            status: "error",
            sync: {
              ...row.sync,
              error:
                error instanceof Error &&
                /Gmail|Reconnect|storage limit|Sync stopped/.test(error.message)
                  ? error.message
                  : "Sync could not finish. No scan progress was discarded; retry or reconnect.",
            },
          })
          .eq("id", accountId)
          .eq("user_id", userId)
          .eq("lease_id", lease),
      );
  } finally {
    checked(
      await db
        .from("adaptive_email_accounts")
        .update({ lease_id: null, lease_until: null })
        .eq("id", accountId)
        .eq("user_id", userId)
        .eq("lease_id", lease),
    );
  }
}
export async function monitorUser(userId: string) {
  const now = new Date().toISOString();
  const state = await mutateState(userId, (s) => lifecycle(s, now));
  for (const trip of state.trips.filter((t) => t.session.phase === "live")) {
    const items = activeItems(state, trip.id).filter(
      (i) =>
        instant(i.reservation.startAt) >= instant(now) - 3 * 3600_000 &&
        instant(i.reservation.startAt) <= instant(now) + 48 * 3600_000,
    );
    const providers = liveProviders().filter(
      (p) =>
        p.supported && (p.id !== "open-meteo" || trip.preferences.notifications.categories.weather),
    );
    const results = await Promise.allSettled(
      providers.map((p) =>
        p.poll(
          p.id === "flights" ? items.filter((i) => i.reservation.type === "flight") : items,
          trip,
          now,
        ),
      ),
    );
    for (const [index, result] of results.entries()) {
      if (result.status === "fulfilled")
        await mutateState(userId, (s) => applySignals(s, result.value, now));
      else
        await mutateState(userId, (s) => {
          s.logs.push({
            id: `${trip.id}:${providers[index].id}:${now}`,
            accountId: "live",
            at: now,
            processed: 0,
            reviewed: 0,
            status: "error",
            message: `${providers[index].label} is unavailable. Last known data may be stale.`,
          });
          return s;
        });
    }
  }
}
export async function dispatchNotifications(userId: string) {
  if (!process.env.ADAPTIVE_PUSH_RELAY_URL || !process.env.ADAPTIVE_PUSH_RELAY_TOKEN) return;
  const state = (await readState(userId)).state;
  const subscriptions =
    checked(
      await adaptiveDb().from("adaptive_push_subscriptions").select("*").eq("user_id", userId),
    ) ?? [];
  const relay = new PushRelay();
  for (const event of state.notifications
    .filter((n) => n.status === "pending" && !n.dismissedAt)
    .slice(0, 30)) {
    const latest = (await readState(userId)).state,
      trip = latest.trips.find((t) => t.id === event.tripId),
      signal = latest.signals.find((s) => s.id === event.signalId),
      assessment = latest.assessments.find((a) => a.signalId === event.signalId);
    if (!trip || !signal || !assessment) continue;
    const item = latest.items.find((i) => i.id === event.itemId);
    const reason =
      !item ||
      instant(event.expiresAt) <= Date.now() ||
      !signalRelevant(item, signal, new Date().toISOString())
        ? "Update expired or became irrelevant before delivery"
        : suppression(trip, signal, assessment, new Date().toISOString());
    if (reason) {
      await mutateState(userId, (s) => {
        const n = s.notifications.find((n) => n.id === event.id);
        if (n) {
          n.status = "dashboard";
          n.suppression = reason;
        }
        return s;
      });
      continue;
    }
    let delivered = false;
    for (const sub of subscriptions) {
      const outcome = await relay.send(await digest(`${event.id}:${sub.id}`), sub.subscription, {
        title: "TravelDoss · trip update",
        body: event.text,
        url: `/app/dossier/${event.tripId}`,
        tag: event.id,
      });
      if (outcome === "expired")
        checked(
          await adaptiveDb()
            .from("adaptive_push_subscriptions")
            .delete()
            .eq("id", sub.id)
            .eq("user_id", userId),
        );
      else delivered = true;
    }
    if (delivered)
      await mutateState(userId, (s) => {
        const n = s.notifications.find((n) => n.id === event.id);
        if (n) {
          n.status = "sent";
          n.deliveredAt = new Date().toISOString();
        }
        return s;
      });
  }
}
export async function runAdaptiveJobs(limit = 5) {
  const jobs = checked(await adaptiveDb().rpc("adaptive_claim_jobs", { p_limit: limit })) ?? [];
  const results: { ok: boolean }[] = [];
  for (const job of jobs) {
    try {
      await refreshTrips(job.user_id);
      for (const account of (await accounts(job.user_id)).filter(
        (a) => a.status === "connected" || a.status === "error",
      ))
        await syncAccount(job.user_id, account.id);
      await monitorUser(job.user_id);
      await dispatchNotifications(job.user_id);
      await mutateState(job.user_id, (s) => {
        s.lastBackgroundAt = new Date().toISOString();
        return s;
      });
      results.push({ ok: true });
    } catch {
      results.push({ ok: false });
    } finally {
      checked(
        await adaptiveDb()
          .from("adaptive_workspaces")
          .update({
            lease_id: null,
            lease_until: null,
            next_run_at: new Date(Date.now() + 5 * 60_000).toISOString(),
          })
          .eq("user_id", job.user_id)
          .eq("lease_id", job.lease_id),
      );
    }
  }
  return { processed: results.length, failed: results.filter((r) => !r.ok).length };
}
