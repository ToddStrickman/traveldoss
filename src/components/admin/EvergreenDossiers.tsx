/**
 * Evergreen dossiers panel (admin only).
 *
 * A dossier marked evergreen has no publishing window: it never shows the
 * "resting" screen, which is what a master test dossier needs. Reverting hands
 * it a fresh 30-day window.
 */
import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Infinity as InfinityIcon, XCircle } from "lucide-react";
import { toast } from "sonner";
import { listEvergreen, setEvergreen } from "@/lib/admin.functions";
import { Panel, SOFT_TEXT, Skeleton, Empty } from "@/components/admin/primitives";

export function EvergreenDossiers({ enabled }: { enabled: boolean }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listEvergreen);
  const setFn = useServerFn(setEvergreen);
  const [ref, setRef] = React.useState("");

  const list = useQuery({
    queryKey: ["admin-evergreen"],
    queryFn: () => listFn(),
    enabled,
  });

  const mark = useMutation({
    mutationFn: (input: { ref: string; evergreen: boolean }) => setFn({ data: input }),
    onSuccess: async (res, input) => {
      if (!res.trip) {
        toast.error("No dossier found with that ID or link");
        return;
      }
      if (input.evergreen) setRef("");
      await qc.invalidateQueries({ queryKey: ["admin-evergreen"] });
      toast.success(
        input.evergreen
          ? `${res.trip.destination} never expires now`
          : `${res.trip.destination} expires again in 30 days`,
      );
    },
    onError: () => toast.error("Couldn’t update that dossier"),
  });

  const rows = list.data ?? [];

  return (
    <Panel
      title="Evergreen dossiers"
      subtitle="Paste a dossier ID or its link to switch off its publishing window. Useful for master and test dossiers."
      className="lg:col-span-2"
    >
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="evergreen-ref">
          Dossier ID or link
        </label>
        <input
          id="evergreen-ref"
          value={ref}
          onChange={(e) => setRef(e.target.value)}
          maxLength={200}
          placeholder="orsino-yhpv2w or /t/orsino-yhpv2w"
          className="min-h-11 min-w-0 flex-1 rounded-full border border-ink/15 bg-transparent px-4 text-xs text-ink placeholder:text-ink/40 focus:border-seal focus:outline-none"
        />
        <button
          type="button"
          onClick={() => ref.trim() && mark.mutate({ ref, evergreen: true })}
          disabled={mark.isPending || !ref.trim()}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-sunset-pink/45 px-4 td-eyebrow text-[10px] text-ink hover:border-seal hover:text-seal disabled:opacity-40"
        >
          <InfinityIcon className="h-3.5 w-3.5" strokeWidth={1.25} aria-hidden="true" />
          {mark.isPending ? "Saving…" : "Make evergreen"}
        </button>
      </div>

      <div className="mt-4">
        {list.isLoading ? (
          <Skeleton height={120} />
        ) : rows.length === 0 ? (
          <Empty note="No evergreen dossiers yet" />
        ) : (
          <ul className="flex flex-col">
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-ink/8 py-3 text-xs last:border-0"
              >
                <span className="min-w-0 flex-1 truncate text-ink/85">{r.destination}</span>
                <span className={"truncate tabular-nums " + SOFT_TEXT}>/t/{r.slug}</span>
                <button
                  type="button"
                  onClick={() => mark.mutate({ ref: r.id, evergreen: false })}
                  disabled={mark.isPending}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-ink/15 px-3 td-eyebrow text-[9px] text-ink/65 hover:border-seal hover:text-seal disabled:opacity-40"
                >
                  <XCircle className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" />
                  Restore window
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}
