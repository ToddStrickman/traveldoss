import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Map, FileText, Route as RouteIcon } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "TravelDoss — Plan trips in a Google Doc, see them on a map" },
      {
        name: "description",
        content:
          "Write your trip in a Google Doc. TravelDoss pins, categorizes, and routes every place by day on a live Google Map.",
      },
    ],
  }),
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="inline-block size-2 rounded-full bg-primary" />
          TravelDoss
        </div>
        <nav className="flex items-center gap-3">
          <Link to="/login">
            <Button variant="ghost">Sign in</Button>
          </Link>
          <Link to="/login">
            <Button>Get started</Button>
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-20">
        <section className="grid gap-12 md:grid-cols-2 md:items-center">
          <div>
            <h1 className="text-5xl font-semibold tracking-tight md:text-6xl">
              Plan trips in a Google Doc.
              <br />
              See them on a map.
            </h1>
            <p className="mt-6 max-w-lg text-lg text-muted-foreground">
              Keep writing the way you already do. TravelDoss reads your Google
              Doc, pins every place, categorizes them, and routes them by day on
              a live Google Map.
            </p>
            <div className="mt-8 flex gap-3">
              <Link to="/login">
                <Button size="lg">Start planning</Button>
              </Link>
            </div>
          </div>

          <div className="grid gap-4">
            <Feature icon={<FileText className="size-5" />} title="Your doc is the source">
              Edit your itinerary in Google Docs. The map updates automatically.
            </Feature>
            <Feature icon={<Map className="size-5" />} title="Pinned and categorized">
              Lodging, food, sights, transport — colored and grouped per day.
            </Feature>
            <Feature icon={<RouteIcon className="size-5" />} title="Routed by day">
              Walking or driving directions between every stop, day by day.
            </Feature>
          </div>
        </section>
      </main>
    </div>
  );
}

function Feature({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center gap-2 font-medium">
        <span className="text-primary">{icon}</span>
        {title}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{children}</p>
    </div>
  );
}
