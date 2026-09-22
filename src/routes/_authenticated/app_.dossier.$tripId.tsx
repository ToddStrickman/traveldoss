import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { DossierScreen } from "@/components/adaptive/DossierScreen";
import {
  adaptiveCommand,
  connectGmail,
  getAdaptiveDossier,
  importExistingPlans,
  manageEmailAccount,
  savePushSubscription,
  syncAdaptive,
} from "@/lib/adaptive/adaptive.functions";
import type { AdaptiveCommand } from "@/lib/adaptive/commands";

export const Route = createFileRoute("/_authenticated/app_/dossier/$tripId")({
  validateSearch: (s: Record<string, unknown>) => ({
    gmail:
      s.gmail === "connected"
        ? ("connected" as const)
        : s.gmail === "error"
          ? ("error" as const)
          : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Adaptive Trip Dossier — TravelDoss" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdaptivePage,
});
function AdaptivePage() {
  const { tripId } = Route.useParams(),
    search = Route.useSearch(),
    client = useQueryClient();
  const get = useServerFn(getAdaptiveDossier),
    command = useServerFn(adaptiveCommand),
    sync = useServerFn(syncAdaptive);
  const connect = useServerFn(connectGmail),
    account = useServerFn(manageEmailAccount),
    importPlans = useServerFn(importExistingPlans),
    savePush = useServerFn(savePushSubscription);
  const key = ["adaptive", tripId];
  const query = useQuery({
    queryKey: key,
    queryFn: () => get({ data: { tripId } }),
    refetchInterval: 60_000,
    retry: 1,
  });
  if (query.isPending)
    return (
      <div className="ad-root">
        <main className="ad-shell" role="status">
          Opening your private trip dossier…
        </main>
      </div>
    );
  if (query.isError || !query.data)
    return (
      <div className="ad-root">
        <main className="ad-shell">
          <h1>Adaptive Dossier is not ready yet</h1>
          <p role="alert">{query.error?.message ?? "Could not load this trip."}</p>
          <a href="/app">Return to your existing dossiers</a>
          <button onClick={() => query.refetch()}>Retry</button>
        </main>
      </div>
    );
  const data = query.data,
    trip = data.state.trips.find((t) => t.id === tripId)!;
  async function update(cmd: AdaptiveCommand) {
    const state = await command({ data: cmd });
    client.setQueryData(key, { ...data, state });
  }
  async function notifications() {
    if (
      !("Notification" in window) ||
      !("serviceWorker" in navigator) ||
      !data.capabilities.vapidPublicKey
    )
      throw new Error("Push is unavailable in this browser or installation.");
    const permission = await Notification.requestPermission();
    if (permission !== "granted")
      throw new Error("Notifications remain off. You can still view every update in Live Trip.");
    const registration = await navigator.serviceWorker.getRegistration("/");
    if (!registration)
      throw new Error(
        "Push needs the installed production service worker. Local previews keep notifications in-app.",
      );
    const raw = data.capabilities.vapidPublicKey.replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: bytes,
    });
    await savePush({
      data: subscription.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } },
    });
    await update({
      kind: "preferences",
      tripId,
      preferences: {
        ...trip.preferences,
        notifications: { ...trip.preferences.notifications, push: true },
      },
    });
  }
  return (
    <>
      {search.gmail && (
        <div role="status" style={{ padding: 12, textAlign: "center" }}>
          {search.gmail === "connected"
            ? "Gmail connected. Choose Sync now to begin, or let the background worker pick it up."
            : "Gmail connection did not complete. Try connecting again; no email password is needed."}
        </div>
      )}
      <DossierScreen
        {...data}
        tripId={tripId}
        onCommand={update}
        onSync={async () => {
          await sync({ data: { tripId } });
          await client.invalidateQueries({ queryKey: key });
        }}
        onConnect={async (scope) => {
          const result = await connect({ data: { tripId, scope } });
          window.location.assign(result.url);
        }}
        onAccount={async (accountId, action, confirmation) => {
          await account({ data: { accountId, action, confirmation } });
          await client.invalidateQueries({ queryKey: key });
        }}
        onImport={async () => {
          await importPlans({ data: { tripId } });
          await client.invalidateQueries({ queryKey: key });
        }}
        onNotifications={notifications}
      />
    </>
  );
}
