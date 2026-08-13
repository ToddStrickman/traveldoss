import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { listTripAccessEvents, type TripAccessEventRow } from "@/lib/access-log.functions";
import { trackAccessTrailOpened } from "@/lib/analytics";

const LABELS: Record<TripAccessEventRow["event_type"], string> = {
  view: "Viewed",
  export_pdf: "Printed / PDF",
  export_ics: "Calendar file",
  export_gdoc: "Google Doc",
};

function when(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Owner-only access ledger for one dossier: who opened or exported the link
 * and when. Collapsed by default so it never competes with the itinerary.
 */
export function AccessAuditTrail({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const list = useServerFn(listTripAccessEvents);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["trip-access-events", slug],
    queryFn: () => list({ data: { slug, limit: 50 } }),
    enabled: open,
  });
  const events = data?.events ?? [];

  return (
    <section data-print="hide" className="mx-auto max-w-3xl px-6 pb-16">
      <button
        type="button"
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) trackAccessTrailOpened(slug, events.length);
        }}
        aria-expanded={open}
        className="tap inline-flex min-h-11 items-center gap-2 rounded-full border border-ink/15 px-4 text-[10px] font-medium uppercase tracking-[0.3em] text-ink-soft transition-elegant hover:border-seal/50 hover:text-seal"
      >
        <History className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
        {open ? "Hide access trail" : "Access trail"}
      </button>

      {/* Reserved min-height so opening the panel never shifts the page. */}
      {open && (
        <div className="mt-4 min-h-[7rem] rounded-2xl border border-ink/10 p-4">
          {isLoading && <p className="text-sm text-ink-soft">Loading access history…</p>}
          {isError && (
            <p className="text-sm text-ink-soft">
              Couldn't load the access trail. Try again in a moment.
            </p>
          )}
          {!isLoading && !isError && events.length === 0 && (
            <p className="text-sm text-ink-soft">
              No views or exports recorded yet. Every open and export of this link will appear
              here.
            </p>
          )}
          {events.length > 0 && (
            <ul className="divide-y divide-ink/10">
              {events.map((e) => (
                <li key={e.id} className="flex items-baseline justify-between gap-4 py-2">
                  <span className="text-sm text-ink">
                    {LABELS[e.event_type]}
                    <span className="text-ink-soft"> · {e.actor_label}</span>
                  </span>
                  <time dateTime={e.occurred_at} className="text-xs text-ink-soft">
                    {when(e.occurred_at)}
                  </time>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-ink-soft">
            Visitors are shown as anonymous codes — no emails or IP addresses are stored.
          </p>
        </div>
      )}
    </section>
  );
}
