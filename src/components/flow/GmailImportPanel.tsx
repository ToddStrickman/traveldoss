import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listBookingEmails,
  importBookingEmail,
} from "@/lib/gmail-import.functions";
import { Button } from "@/components/ui/button";
import { Mail, Loader2, AlertTriangle, RotateCw } from "lucide-react";
import { toast } from "sonner";

/**
 * Lists candidate booking-confirmation emails from the connected Gmail
 * inbox and lets the user import any of them into the current trip.
 * Successful imports trigger a refetch of `trip-doc-previews` so the
 * embedded iframe appears on the dossier without a page reload.
 */
export function GmailImportPanel({ tripId }: { tripId: string }) {
  const [open, setOpen] = useState(false);
  const fetchList = useServerFn(listBookingEmails);
  const importOne = useServerFn(importBookingEmail);
  const qc = useQueryClient();

  const { data, isLoading, refetch, isFetching, error: listError, failureCount } = useQuery({
    queryKey: ["gmail-booking-emails"],
    queryFn: () => fetchList({ data: undefined as never }),
    enabled: open,
    staleTime: 60_000,
    retry: 2,
    retryDelay: (i) => Math.min(4000, 500 * 2 ** i),
  });

  const importMut = useMutation({
    mutationFn: (messageId: string) =>
      importOne({ data: { messageId, tripId } }),
    retry: (failureCount, err) => {
      const msg = err instanceof Error ? err.message : String(err);
      // Don't retry auth/scope/validation errors.
      if (/\b(401|403|404|invalid|unauthorized|forbidden|too short)\b/i.test(msg)) {
        return false;
      }
      return failureCount < 2;
    },
    retryDelay: (i) => Math.min(4000, 500 * 2 ** i),
    onSuccess: (res) => {
      if (res.alreadyImported) {
        toast.info("That email was already imported to this trip.");
      } else {
        toast.success("Booking imported and Doc preview attached.");
      }
      qc.invalidateQueries({ queryKey: ["trip-doc-previews", tripId] });
    },
    onError: (err: unknown) => {
      toast.error("Couldn't import that booking", {
        description: err instanceof Error ? err.message : String(err),
      });
    },
  });

  return (
    <div className="mt-8" data-testid="gmail-import-panel">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Import from Gmail
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setOpen((v) => !v);
            if (!open) void refetch();
          }}
          data-testid="gmail-import-toggle"
        >
          <Mail className="mr-2 h-4 w-4" />
          {open ? "Hide" : "Browse bookings"}
        </Button>
      </div>

      {open && (
        <div className="mt-4 space-y-2" data-testid="gmail-import-list">
          {(isLoading || isFetching) && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {failureCount > 0 ? `Retrying… (attempt ${failureCount + 1})` : "Loading inbox…"}
            </div>
          )}
          {(data?.error || listError) && !isFetching && (
            <div className="flex items-start justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {data?.error ||
                    (listError instanceof Error ? listError.message : String(listError))}
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void refetch()}
                data-testid="gmail-import-retry"
              >
                <RotateCw className="mr-1.5 h-3.5 w-3.5" /> Retry
              </Button>
            </div>
          )}
          {data?.emails?.length === 0 && !isLoading && (
            <p className="text-sm text-muted-foreground">
              No booking-shaped emails found in the last 6 months.
            </p>
          )}
          {data?.emails?.map((e) => {
            const isImporting =
              importMut.isPending && importMut.variables === e.id;
            const importFailed =
              importMut.isError && importMut.variables === e.id;
            return (
            <div
              key={e.id}
              data-testid={`gmail-email-${e.id}`}
              className="flex items-start justify-between gap-4 rounded-md border border-border bg-card p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{e.subject || "(no subject)"}</p>
                <p className="truncate text-xs text-muted-foreground">{e.from}</p>
                <p className="line-clamp-2 mt-1 text-xs text-muted-foreground">
                  {e.snippet}
                </p>
                {importFailed && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
                    <AlertTriangle className="h-3 w-3" />
                    {importMut.error instanceof Error
                      ? importMut.error.message
                      : "Import failed."}
                  </p>
                )}
                {isImporting && importMut.failureCount > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Retrying… (attempt {importMut.failureCount + 1})
                  </p>
                )}
              </div>
              <Button
                size="sm"
                disabled={isImporting}
                variant={importFailed ? "outline" : "default"}
                onClick={() => importMut.mutate(e.id)}
                data-testid={`gmail-import-button-${e.id}`}
              >
                {isImporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : importFailed ? (
                  <>
                    <RotateCw className="mr-1.5 h-3.5 w-3.5" /> Retry
                  </>
                ) : (
                  "Import"
                )}
              </Button>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}