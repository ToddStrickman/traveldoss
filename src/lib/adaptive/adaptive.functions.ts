import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AdaptiveCommandSchema, executeCommand } from "./commands";
import { ScanScope } from "./types";
import {
  accounts,
  adaptiveDb,
  checked,
  mutateState,
  ownerTrips,
  readState,
  refreshTrips,
  requireTrip,
} from "./store.server";
import { beginGmail } from "./oauth.server";
import { GmailAdapter, type GmailTokens } from "./gmail.server";
import { decrypt } from "./crypto.server";
import { liveProviders } from "./live-providers.server";
import { monitorUser, syncAccount } from "./worker.server";
import { lifecycle } from "./live";
import { eraseImportedAccount } from "./privacy";
import { stageLegacy } from "./legacy";
import type { Block } from "@/lib/skins/types";

const tripInput = z.object({ tripId: z.string().uuid() });
function privateResponse() {
  setResponseHeader("Cache-Control", "private, no-store");
}
export const getAdaptiveDossier = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => tripInput.parse(i))
  .handler(async ({ data, context }) => {
    privateResponse();
    await requireTrip(context.userId, data.tripId);
    await refreshTrips(context.userId);
    const state = await mutateState(context.userId, (s) => lifecycle(s, new Date().toISOString()));
    return {
      state,
      accounts: await accounts(context.userId),
      capabilities: {
        gmail:
          !!process.env.GMAIL_CLIENT_ID &&
          !!process.env.GMAIL_CLIENT_SECRET &&
          !!process.env.GMAIL_REDIRECT_URI &&
          !!process.env.ADAPTIVE_TOKEN_KEY,
        push:
          !!process.env.ADAPTIVE_PUSH_RELAY_URL &&
          !!process.env.ADAPTIVE_PUSH_RELAY_TOKEN &&
          !!process.env.ADAPTIVE_VAPID_PUBLIC_KEY,
        vapidPublicKey: process.env.ADAPTIVE_VAPID_PUBLIC_KEY ?? null,
        background:
          !!state.lastBackgroundAt && Date.now() - Date.parse(state.lastBackgroundAt) < 15 * 60_000,
        providers: liveProviders().map((p) => ({
          id: p.id,
          label: p.label,
          supported: p.supported,
        })),
      },
    };
  });
export const adaptiveCommand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => AdaptiveCommandSchema.parse(i))
  .handler(async ({ data, context }) => {
    privateResponse();
    const owned = new Set((await ownerTrips(context.userId)).map((t) => t.id));
    if ("tripId" in data && !owned.has(data.tripId)) throw new Error("Trip not found.");
    if (data.kind === "review" && data.target && !owned.has(data.target.tripId))
      throw new Error("Trip not found.");
    return mutateState(context.userId, (s) => executeCommand(s, data, new Date().toISOString()));
  });
export const connectGmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => tripInput.extend({ scope: ScanScope }).parse(i))
  .handler(async ({ data, context }) => ({
    url: await beginGmail(context.userId, data.tripId, data.scope),
  }));
export const syncAdaptive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => tripInput.parse(i))
  .handler(async ({ data, context }) => {
    privateResponse();
    await requireTrip(context.userId, data.tripId);
    await refreshTrips(context.userId);
    for (const account of (await accounts(context.userId)).filter(
      (a) => a.status === "connected" || a.status === "error",
    ))
      await syncAccount(context.userId, account.id);
    await monitorUser(context.userId);
    return (await readState(context.userId)).state;
  });
export const manageEmailAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        accountId: z.string().uuid(),
        action: z.enum(["pause", "resume", "disconnect", "delete"]),
        confirmation: z.string().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    privateResponse();
    const db = adaptiveDb();
    const lease = crypto.randomUUID();
    if (
      !checked(
        await db.rpc("adaptive_lock_account", {
          p_id: data.accountId,
          p_user_id: context.userId,
          p_lease: lease,
        }),
      )
    )
      throw new Error(
        "A sync page is finishing or this account is unavailable. Try again in a moment.",
      );
    try {
      const row = checked(
        await db
          .from("adaptive_email_accounts")
          .select("*")
          .eq("user_id", context.userId)
          .eq("id", data.accountId)
          .eq("lease_id", lease)
          .single(),
      );
      if (data.action === "delete") {
        if (data.confirmation !== "DELETE IMPORTED DATA")
          throw new Error(
            "Confirm deletion of imported reservations, sources, and associated history.",
          );
        if (row.status !== "disconnected")
          throw new Error("Disconnect the account before deleting its imported data.");
        await mutateState(context.userId, (s) =>
          eraseImportedAccount(s, row.id, new Date().toISOString()),
        );
        checked(
          await db
            .from("adaptive_email_accounts")
            .delete()
            .eq("id", row.id)
            .eq("user_id", context.userId),
        );
      } else if (data.action === "disconnect") {
        if (row.encrypted_tokens)
          await new GmailAdapter(
            await decrypt<GmailTokens>(row.encrypted_tokens, context.userId),
            async () => {},
          ).revoke();
        checked(
          await db
            .from("adaptive_email_accounts")
            .update({
              status: "disconnected",
              encrypted_tokens: null,
              lease_id: null,
              lease_until: null,
            })
            .eq("id", row.id)
            .eq("user_id", context.userId),
        );
      } else {
        if (!row.encrypted_tokens) throw new Error("Reconnect Gmail first.");
        checked(
          await db
            .from("adaptive_email_accounts")
            .update({ status: data.action === "pause" ? "paused" : "connected" })
            .eq("id", row.id)
            .eq("user_id", context.userId),
        );
      }
      return { accounts: await accounts(context.userId) };
    } finally {
      checked(
        await db
          .from("adaptive_email_accounts")
          .update({ lease_id: null, lease_until: null })
          .eq("id", data.accountId)
          .eq("user_id", context.userId)
          .eq("lease_id", lease),
      );
    }
  });
export const importExistingPlans = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => tripInput.parse(i))
  .handler(async ({ data, context }) => {
    await requireTrip(context.userId, data.tripId);
    const trip = (await ownerTrips(context.userId)).find((t) => t.id === data.tripId)!;
    return mutateState(context.userId, (s) =>
      stageLegacy(
        s,
        data.tripId,
        (trip.content?.blocks ?? []) as Block[],
        new Date().toISOString(),
      ),
    );
  });
export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        endpoint: z.string().url().max(2048),
        keys: z.object({ p256dh: z.string().min(40).max(200), auth: z.string().min(16).max(100) }),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const url = new URL(data.endpoint);
    if (
      url.protocol !== "https:" ||
      ![
        "fcm.googleapis.com",
        "updates.push.services.mozilla.com",
        "web.push.apple.com",
        "notify.windows.com",
      ].some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`))
    )
      throw new Error("Unsupported push subscription endpoint.");
    if (!process.env.ADAPTIVE_PUSH_RELAY_URL) throw new Error("Push delivery is not configured.");
    checked(
      await adaptiveDb()
        .from("adaptive_push_subscriptions")
        .upsert(
          { user_id: context.userId, endpoint: data.endpoint, subscription: data },
          { onConflict: "user_id,endpoint" },
        ),
    );
    return { ok: true };
  });
