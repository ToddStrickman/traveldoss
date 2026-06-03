import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTrips } from "@/lib/trips.functions";
import { supabase } from "@/integrations/supabase/client";
import { LogOut, Plus, ArrowUpRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "Your trips — TravelDoss" },
      {
        name: "description",
        content:
          "View and manage your personal TravelDoss trip dossiers and planning documents.",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
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
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground selection:bg-seal/40">
      <div aria-hidden className="td-grain fixed inset-0 z-0" />
      <div aria-hidden className="td-vignette fixed inset-0 z-0" />

      <header className="relative z-10 mx-auto flex max-w-[1500px] items-center justify-between border-b border-ink/10 px-8 py-6">
        <Link to="/" className="inline-flex items-center gap-3 td-eyebrow text-ink/70 transition-colors hover:text-seal">
          <span className="h-px w-6 bg-ink/30" />
          TravelDoss<span className="text-ink/30">®</span>
        </Link>
        <div className="flex items-center gap-6">
          <Link to="/templates" className="td-eyebrow text-ink/55 transition-colors hover:text-seal">
            Templates
          </Link>
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex items-center gap-2 td-eyebrow text-ink/55 transition-colors hover:text-seal"
          >
            <LogOut className="h-3.5 w-3.5" strokeWidth={1.25} />
            Sign out
          </button>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-[1500px] px-8 pb-28 pt-16">
        <div className="grid grid-cols-12 gap-10">
          <div className="col-span-12 md:col-span-7">
            <span className="td-eyebrow text-ink/50">The Library</span>
            <h1 className="td-headline mt-6 text-6xl text-ink md:text-7xl">
              Your <span className="italic text-ink/85">dossiers<span className="text-seal">.</span></span>
            </h1>
            <p className="mt-6 max-w-md text-sm leading-relaxed text-ink-soft">
              Every trip becomes a quiet studio — mapped routes, day-by-day plans, reservations,
              and editorial notes at a private URL you can share like a wedding site.
            </p>
          </div>
          <div className="col-span-12 flex md:col-span-5 md:items-end md:justify-end">
            <button
              onClick={() => navigate({ to: "/templates" })}
              className="surface-card group inline-flex items-center gap-5 rounded-md py-5 pl-5 pr-3 td-eyebrow text-ink transition-elegant hover:text-seal"
            >
              <span className="text-seal/70 transition-elegant group-hover:text-seal">+</span>
              <span>Mint a new dossier</span>
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-sm border border-white/10 bg-paper/40 transition-elegant group-hover:border-seal group-hover:bg-seal group-hover:text-paper">
                <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
              </span>
            </button>
          </div>
        </div>

        <div className="mt-14 flex items-center gap-4 td-eyebrow text-ink/35">
          <div className="td-rule w-10" />
          {tripsQ.data ? `${tripsQ.data.trips.length} on file` : "Retrieving your dossiers…"}
          <div className="td-rule flex-1" />
        </div>

        <div className="mt-10">
          {tripsQ.isLoading && (
            <p className="td-eyebrow text-ink/40">Retrieving your dossiers…</p>
          )}

          {tripsQ.isError && (
            <p role="alert" className="td-eyebrow text-seal">
              Couldn't load your dossiers: {tripsQ.error.message}
            </p>
          )}

          {tripsQ.data && tripsQ.data.trips.length === 0 && (
            <div className="surface-card flex flex-col items-center gap-5 px-10 py-20 text-center">
              <span className="td-eyebrow text-ink/40">The studio is quiet</span>
              <h3 className="td-headline text-4xl text-ink">
                No journeys <span className="italic">composed yet<span className="text-seal">.</span></span>
              </h3>
              <p className="max-w-md text-sm leading-relaxed text-ink-soft">
                Choose a template and begin. Your dossier will map every route, arrange each day,
                and hold every reservation — all at a private URL you can share.
              </p>
              <button
                onClick={() => navigate({ to: "/templates" })}
                className="mt-4 inline-block border-y border-ink/20 py-3 px-6 td-eyebrow text-ink transition-colors hover:border-seal hover:text-seal"
              >
                Open a Template
              </button>
            </div>
          )}

          {tripsQ.data && tripsQ.data.trips.length > 0 && (
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {tripsQ.data.trips.map((t, i) => (
                <li key={t.id}>
                  <Link
                    to="/t/$slug"
                    params={{ slug: t.slug }}
                    className="surface-card group block rounded-md p-6"
                  >
                    <div className="flex items-center justify-between td-eyebrow text-ink/35">
                      <span>№ {String(i + 1).padStart(2, "0")}</span>
                      <span className="capitalize text-ink/45">{t.status}</span>
                    </div>
                    <h2 className="td-headline mt-5 text-3xl text-ink">
                      {t.destination}
                    </h2>
                    <p className="mt-3 text-[11px] uppercase tracking-[0.3em] text-ink/50">
                      {t.start_date && t.end_date
                        ? `${t.start_date} → ${t.end_date}`
                        : "Dates not set"}
                    </p>
                    <div className="mt-8 flex items-center justify-between border-t border-white/10 pt-4 td-eyebrow text-ink/40">
                      <span className="truncate">/t/{t.slug}</span>
                      <ArrowUpRight
                        className="h-3.5 w-3.5 shrink-0 text-ink/40 transition-colors group-hover:text-seal"
                        strokeWidth={1.5}
                      />
                    </div>
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