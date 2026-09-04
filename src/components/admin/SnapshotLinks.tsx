/**
 * Investor snapshot links panel.
 *
 * Creating a link freezes the current numbers server-side; the console only
 * ever holds the token so it can be copied or revoked. Tokens are shown
 * truncated in the list — the full URL goes to the clipboard, not to the
 * screen, so a shared screen doesn't leak a live credential.
 */
import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Link2, Plus, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  createAdminSnapshot,
  listAdminSnapshots,
  revokeAdminSnapshot,
} from "@/lib/admin.functions";
import { Panel, SOFT_TEXT, Skeleton, Empty } from "@/components/admin/primitives";
import { SITE_URL } from "@/lib/site";

const TTL_DAYS = 30;

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function SnapshotLinks({ days, enabled }: { days: number; enabled: boolean }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listAdminSnapshots);
  const createFn = useServerFn(createAdminSnapshot);
  const revokeFn = useServerFn(revokeAdminSnapshot);

  const [label, setLabel] = React.useState("");
  const [copied, setCopied] = React.useState<string | null>(null);

  const list = useQuery({
    queryKey: ["admin-snapshots"],
    queryFn: () => listFn(),
    enabled,
  });

  const create = useMutation({
    mutationFn: () =>
      createFn({ data: { days, label: label.trim() || null, ttlDays: TTL_DAYS } }),
    onSuccess: async (row) => {
      setLabel("");
      await qc.invalidateQueries({ queryKey: ["admin-snapshots"] });
      await copy(row.token);
    },
    onError: () => toast.error("Snapshot couldn’t be created"),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => revokeFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-snapshots"] }),
    onError: () => toast.error("Couldn’t withdraw that link"),
  });

  async function copy(token: string) {
    const url = `${SITE_URL}/admin/s/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(token);
      window.setTimeout(() => setCopied(null), 1600);
      toast.success("Snapshot link copied");
    } catch {
      toast.error("Clipboard unavailable");
    }
  }

  const rows = list.data ?? [];

  return (
    <Panel
      title="Investor snapshot links"
      subtitle={`Freezes today's numbers behind a secret link. Expires after ${TTL_DAYS} days; withdraw any time.`}
      className="lg:col-span-2"
    >
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="snapshot-label">
          Snapshot name
        </label>
        <input
          id="snapshot-label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={80}
          placeholder={`Name this snapshot (last ${days} days)`}
          className="min-h-11 min-w-0 flex-1 rounded-full border border-ink/15 bg-transparent px-4 text-xs text-ink placeholder:text-ink/40 focus:border-seal focus:outline-none"
        />
        <button
          type="button"
          onClick={() => create.mutate()}
          disabled={create.isPending}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-sunset-pink/45 px-4 td-eyebrow text-[10px] text-ink hover:border-seal hover:text-seal disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.25} aria-hidden="true" />
          {create.isPending ? "Freezing…" : "Create link"}
        </button>
      </div>

      <div className="mt-4">
        {list.isLoading ? (
          <Skeleton height={140} />
        ) : rows.length === 0 ? (
          <Empty note="No snapshot links yet" />
        ) : (
          <ul className="flex flex-col">
            {rows.map((r) => {
              const expired = new Date(r.expiresAt).getTime() < Date.now();
              const dead = Boolean(r.revokedAt) || expired;
              return (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-ink/8 py-3 text-xs last:border-0"
                >
                  <span className="min-w-0 flex-1 truncate text-ink/85">
                    {r.label ?? `Last ${r.rangeDays} days`}
                  </span>
                  <span className={"tabular-nums " + SOFT_TEXT}>
                    {fmt(r.createdAt)} → {fmt(r.expiresAt)}
                  </span>
                  <span className={"tabular-nums " + SOFT_TEXT}>
                    {r.viewCount} {r.viewCount === 1 ? "view" : "views"}
                  </span>
                  {dead ? (
                    <span className="td-eyebrow text-[9px]" style={{ color: "var(--tds-ruby)" }}>
                      {r.revokedAt ? "Withdrawn" : "Expired"}
                    </span>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => void copy(r.token)}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-ink/15 px-3 td-eyebrow text-[9px] text-ink/65 hover:border-seal hover:text-seal"
                      >
                        {copied === r.token ? (
                          <Check className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" />
                        ) : (
                          <Link2 className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" />
                        )}
                        {copied === r.token ? "Copied" : "Copy link"}
                      </button>
                      <button
                        type="button"
                        onClick={() => revoke.mutate(r.id)}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-ink/15 px-3 td-eyebrow text-[9px] text-ink/65 hover:border-seal hover:text-seal"
                      >
                        <XCircle className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" />
                        Withdraw
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Panel>
  );
}
