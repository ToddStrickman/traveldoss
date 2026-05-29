import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTrips, getDriveConnectionStatus } from "@/lib/trips.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, LogOut, Plus, MapPin } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Your trips — TravelDoss" }] }),
});

function Dashboard() {
  const navigate = useNavigate();
  const router = useRouter();
  const listTripsFn = useServerFn(listTrips);
  const driveStatusFn = useServerFn(getDriveConnectionStatus);

  const tripsQ = useQuery({ queryKey: ["trips"], queryFn: () => listTripsFn() });
  const driveQ = useQuery({ queryKey: ["drive-status"], queryFn: () => driveStatusFn() });

  const onSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  const onConnectDrive = () => {
    window.location.href = "/api/public/google/start";
  };

  // Surface OAuth callback result via query param
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  if (params.get("drive") === "connected") {
    toast.success("Google Drive connected");
    window.history.replaceState({}, "", "/app");
    router.invalidate();
  } else if (params.get("drive") === "error") {
    toast.error(params.get("msg") ?? "Drive connection failed");
    window.history.replaceState({}, "", "/app");
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/app" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="inline-block size-2 rounded-full bg-primary" />
            TravelDoss
          </Link>
          <Button variant="ghost" size="sm" onClick={onSignOut}>
            <LogOut className="size-4" />
            Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Your trips</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Each trip is a Google Doc. Edits sync to your map.
            </p>
          </div>
          <Button disabled>
            <Plus className="size-4" />
            New trip
          </Button>
        </div>

        {/* Drive connection card */}
        <Card className="mt-6 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 font-medium">
                <FileText className="size-4" />
                Google Drive
                {driveQ.data?.connected ? (
                  <Badge variant="secondary">Connected</Badge>
                ) : (
                  <Badge variant="outline">Not connected</Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {driveQ.data?.connected
                  ? `Connected as ${driveQ.data.email ?? "your Google account"}.`
                  : "Connect Google Drive so TravelDoss can create and read your trip docs."}
              </p>
            </div>
            <Button variant={driveQ.data?.connected ? "outline" : "default"} onClick={onConnectDrive}>
              {driveQ.data?.connected ? "Reconnect" : "Connect Google Drive"}
            </Button>
          </div>
        </Card>

        {/* Trips list */}
        <div className="mt-8">
          {tripsQ.isLoading && <p className="text-sm text-muted-foreground">Loading trips…</p>}
          {tripsQ.data && tripsQ.data.trips.length === 0 && (
            <Card className="flex flex-col items-center gap-3 p-12 text-center">
              <MapPin className="size-8 text-muted-foreground" />
              <h3 className="font-medium">No trips yet</h3>
              <p className="max-w-sm text-sm text-muted-foreground">
                Connect Google Drive, then create your first trip. We'll set up
                a Google Doc and a live map for it.
              </p>
            </Card>
          )}
          {tripsQ.data && tripsQ.data.trips.length > 0 && (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tripsQ.data.trips.map((t) => (
                <li key={t.id}>
                  <Card className="p-5">
                    <div className="font-medium">{t.destination}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {t.start_date} → {t.end_date}
                    </div>
                    <Badge className="mt-3" variant="secondary">
                      {t.status}
                    </Badge>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}