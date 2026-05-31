import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTrips } from "@/lib/trips.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LogOut, Plus, MapPin, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Your trips — TravelDoss" }] }),
});

function Dashboard() {
  const navigate = useNavigate();
  const listTripsFn = useServerFn(listTrips);

  const tripsQ = useQuery({ queryKey: ["trips"], queryFn: () => listTripsFn() });

  const onSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

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
              Each trip is a private dossier at its own unique URL — shareable like a wedding site.
            </p>
          </div>
          <Button onClick={() => navigate({ to: "/templates" })}>
            <Plus className="size-4" />
            New dossier
          </Button>
        </div>

        {/* Trips list */}
        <div className="mt-8">
          {tripsQ.isLoading && <p className="text-sm text-muted-foreground">Loading trips…</p>}
          {tripsQ.data && tripsQ.data.trips.length === 0 && (
            <Card className="flex flex-col items-center gap-3 p-12 text-center">
              <MapPin className="size-8 text-muted-foreground" />
              <h3 className="font-medium">No dossiers yet</h3>
              <p className="max-w-sm text-sm text-muted-foreground">
                Begin from a template. Every trip becomes a private,
                editorial dossier at its own URL — yours to share.
              </p>
              <Button className="mt-2" onClick={() => navigate({ to: "/templates" })}>
                Browse templates
              </Button>
            </Card>
          )}
          {tripsQ.data && tripsQ.data.trips.length > 0 && (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tripsQ.data.trips.map((t) => (
                <li key={t.id}>
                  <Link
                    to="/t/$slug"
                    params={{ slug: t.slug }}
                    className="block transition-opacity hover:opacity-80"
                  >
                    <Card className="p-5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-medium">{t.destination}</div>
                        <ExternalLink className="size-3.5 text-muted-foreground" />
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {t.start_date && t.end_date
                          ? `${t.start_date} → ${t.end_date}`
                          : "Dates not set"}
                      </div>
                      <div className="mt-1 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                        /t/{t.slug}
                      </div>
                      <Badge className="mt-3" variant="secondary">
                        {t.status}
                      </Badge>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}