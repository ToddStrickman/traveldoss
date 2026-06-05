import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Download, RefreshCw, Trash2 } from "lucide-react";
import {
  listDebugReports,
  deleteDebugReport,
} from "@/lib/itinerary/debug-reports.functions";
import {
  downloadDebugReport,
  type DebugReport,
} from "@/lib/itinerary/debug-report";

type Row = {
  id: string;
  trip_id: string | null;
  source: string;
  outcome: string;
  attempts_count: number;
  created_at: string;
  report: DebugReport;
};

/**
 * Owner-only panel listing recent AI parse/generate debug reports so the
 * owner can download the raw Gemini response, Zod issues, and final
 * fallback long after the toast has disappeared.
 */
export function DebugReportsPanel({ tripId }: { tripId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const list = useServerFn(listDebugReports);
  const del = useServerFn(deleteDebugReport);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      // Show this trip's reports + recent unassigned reports (the parse
      // happens before the trip exists, so those are tied to user only).
      const [tied, recent] = await Promise.all([
        list({ data: { tripId, limit: 20 } }),
        list({ data: { limit: 20 } }),
      ]);
      const merged = new Map<string, Row>();
      for (const r of [...(tied.reports ?? []), ...(recent.reports ?? [])]) {
        merged.set(r.id as string, r as unknown as Row);
      }
      setRows(
        Array.from(merged.values()).sort((a, b) =>
          b.created_at.localeCompare(a.created_at),
        ),
      );
    } catch (err) {
      console.error("[debug-panel] load failed", err);
    } finally {
      setLoading(false);
    }
  }, [list, tripId]);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  async function handleDelete(id: string) {
    try {
      await del({ data: { id } });
      setRows((rs) => rs.filter((r) => r.id !== id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete report.");
    }
  }

  return (
    <section data-print="hide" className="mt-10 border-t border-ink/10 pt-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left"
        aria-expanded={open}
      >
        <span className="text-[10px] uppercase tracking-[0.4em] text-ink/55">
          Parse Diagnostics
        </span>
        <span className="text-[10px] uppercase tracking-[0.3em] text-ink/45">
          {open ? "Hide" : "Show"}
        </span>
      </button>
      {open && (
        <div className="mt-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs text-ink-soft">
              Saved when a Gemini response needed retries, fell back, or threw.
            </p>
            <button
              type="button"
              onClick={refresh}
              disabled={loading}
              className="inline-flex items-center gap-1 rounded-full border border-ink/15 px-2.5 py-1 text-[10px] uppercase tracking-[0.25em] text-ink-soft transition-colors hover:border-seal hover:text-seal disabled:opacity-50"
            >
              <RefreshCw className="h-3 w-3" aria-hidden />
              Refresh
            </button>
          </div>
          {loading && rows.length === 0 ? (
            <p className="py-6 text-center text-xs text-ink/45">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="py-6 text-center text-xs text-ink/45">
              No diagnostics yet — clean parses don't get saved.
            </p>
          ) : (
            <ul className="divide-y divide-ink/10 rounded-md border border-ink/10">
              {rows.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-ink">
                      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
                        {r.source}
                      </span>
                      <span className="mx-2 text-ink/30">·</span>
                      <span>{r.outcome}</span>
                      <span className="mx-2 text-ink/30">·</span>
                      <span className="text-ink-soft">
                        {r.attempts_count} attempt{r.attempts_count === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[10px] text-ink/45">
                      {new Date(r.created_at).toLocaleString()}
                      {r.trip_id === tripId && " · this trip"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => downloadDebugReport(r.report)}
                    className="inline-flex items-center gap-1 rounded-full border border-ink/15 px-2.5 py-1 text-[10px] uppercase tracking-[0.25em] text-ink-soft transition-colors hover:border-seal hover:text-seal"
                    aria-label="Download debug JSON"
                  >
                    <Download className="h-3 w-3" aria-hidden />
                    JSON
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(r.id)}
                    className="inline-flex items-center rounded-full border border-ink/15 p-1.5 text-ink-soft transition-colors hover:border-red-500 hover:text-red-500"
                    aria-label="Delete debug report"
                  >
                    <Trash2 className="h-3 w-3" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}