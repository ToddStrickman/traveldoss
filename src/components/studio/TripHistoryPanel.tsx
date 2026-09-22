/**
 * TripHistoryPanel — owner-only change history with restore and roll back
 * (Directive 08, Phase 2, HISTORY_VISIBILITY = owner_only).
 *
 * Each row is one saved change: who made it, what it moved, and two ways
 * back — bring a single deleted item back to its old position, or return the
 * whole dossier to how it looked just before that change. A roll back is
 * itself a change, so it can be rolled back too.
 */
import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import { RotateCcw, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { TdSheet } from "@/components/mobile/TdSheet";
import { getTripHistory, restoreDeletedBlock, rollbackTripTo } from "@/lib/collab.functions";
import { trackChangeRestored, trackHistoryPanelOpened } from "@/lib/analytics";

type Change = {
  id: string;
  actorName: string;
  isOwnerActor: boolean;
  action: string;
  addedCount: number;
  removedCount: number;
  createdAt: string;
  deleted: Array<{ index: number; label: string }>;
};

const soft = "text-[11px] uppercase tracking-[0.3em] text-ink-soft";

function when(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function summary(c: Change) {
  if (c.addedCount > 0) return `Added ${c.addedCount} item${c.addedCount === 1 ? "" : "s"}`;
  if (c.removedCount > 0) return `Removed ${c.removedCount} item${c.removedCount === 1 ? "" : "s"}`;
  return "Edited the dossier";
}

export function TripHistoryPanel({
  tripId,
  open,
  onOpenChange,
  onRestored,
}: {
  tripId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a restore or roll back so the editor can reload content. */
  onRestored?: () => void;
}) {
  const load = useServerFn(getTripHistory);
  const rollback = useServerFn(rollbackTripTo);
  const restore = useServerFn(restoreDeletedBlock);
  const [changes, setChanges] = React.useState<Change[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [who, setWho] = React.useState<string>("all");
  const [busy, setBusy] = React.useState(false);

  const refresh = React.useCallback(
    (announce = false) => {
      setLoading(true);
      load({ data: { tripId } })
        .then((r) => {
          const list = r.changes as Change[];
          setChanges(list);
          if (announce) trackHistoryPanelOpened({ change_count: list.length });
        })
        .catch((e: Error) => toast.error("Couldn't load the history", { description: e.message }))
        .finally(() => setLoading(false));
    },
    [load, tripId],
  );

  React.useEffect(() => {
    if (open) refresh(true);
  }, [open, refresh]);

  const people = [...new Set(changes.map((c) => c.actorName))];
  const shown = who === "all" ? changes : changes.filter((c) => c.actorName === who);

  return (
    <TdSheet
      open={open}
      onOpenChange={onOpenChange}
      title="History"
      description="Every saved change, newest first"
      snapHeight="full"
      className="max-w-xl md:mx-auto"
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-8 pt-4">
        {people.length > 1 ? (
          <div className="mb-4 flex flex-wrap gap-2">
            {["all", ...people].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setWho(p)}
                className={`tap min-h-[44px] rounded-full px-3 text-xs ${
                  who === p ? "bg-seal text-paper" : "bg-white/[0.04] text-ink-soft"
                }`}
              >
                {p === "all" ? "Everyone" : p}
              </button>
            ))}
          </div>
        ) : null}

        {loading && changes.length === 0 ? <p className="text-sm text-ink-soft">Loading…</p> : null}
        {!loading && changes.length === 0 ? (
          <p className="text-sm text-ink-soft">No changes recorded yet. Every future edit appears here.</p>
        ) : null}

        <ol className="space-y-3">
          {shown.map((c) => (
            <li key={c.id} className="rounded-xl bg-white/[0.03] p-3">
              <p className="text-sm text-ink">
                {summary(c)} · <span className="text-ink-soft">{c.isOwnerActor ? "You" : c.actorName}</span>
              </p>
              <p className="mt-0.5 text-xs text-ink-soft">{when(c.createdAt)}</p>
              {c.deleted.length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {c.deleted.map((d) => (
                    <li key={`${c.id}-${d.index}`} className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-xs text-ink-soft">{d.label}</span>
                      <button
                        type="button"
                        disabled={busy}
                        className="tap inline-flex min-h-[44px] items-center gap-1 rounded-full px-3 text-xs text-ink hover:text-seal disabled:opacity-60"
                        onClick={async () => {
                          setBusy(true);
                          try {
                            const r = await restore({ data: { tripId, changeId: c.id, index: d.index } });
                            trackChangeRestored({ mode: "single" });
                            toast.success(`Restored ${r.label}`);
                            onRestored?.();
                            refresh();
                          } catch (e) {
                            toast.error("Couldn't restore it", { description: (e as Error).message });
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        <Undo2 className="h-3.5 w-3.5" aria-hidden />
                        Restore
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <button
                type="button"
                disabled={busy}
                className="tap mt-2 inline-flex min-h-[44px] items-center gap-1 rounded-full border border-white/10 px-3 text-xs text-ink-soft hover:text-ink disabled:opacity-60"
                onClick={async () => {
                  if (!window.confirm("Return the whole dossier to how it looked just before this change?")) return;
                  setBusy(true);
                  try {
                    await rollback({ data: { tripId, changeId: c.id } });
                    trackChangeRestored({ mode: "point_in_time" });
                    toast.success("Rolled back", { description: "This roll back is itself in the history." });
                    onRestored?.();
                    refresh();
                  } catch (e) {
                    toast.error("Couldn't roll back", { description: (e as Error).message });
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                Roll back to here
              </button>
            </li>
          ))}
        </ol>
      </div>
    </TdSheet>
  );
}
