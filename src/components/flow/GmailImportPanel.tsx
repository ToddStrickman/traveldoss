import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listBookingEmails,
  importBookingEmail,
} from "@/lib/gmail-import.functions";
import { Button } from "@/components/ui/button";
import { Mail, Loader2 } from "lucide-react";
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

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["gmail-booking-emails"],
    queryFn: () => fetchList({ data: undefined as never }),
    enabled: open,
    staleTime: 60_000,
  });

  const importMut = useMutation({
    mutationFn: (messageId: string) =>
      importOne({ data: { messageId, tripId } }),
    onSuccess: (res) => {
      if (res.alreadyImported) {
        toast.info("That email was already imported to this trip.");
      } else {
        toast.success("Booking imported and Doc preview attached.");
      }
      qc.invalidateQueries({ queryKey: ["trip-doc-previews", tripId] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : String(err));
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
              <Loader2 className="h-4 w-4 animate-spin" /> Loading inbox…
            </div>
          )}
          {data?.error && (
            <p className="text-sm text-destructive">{data.error}</p>
          )}
          {data?.emails?.length === 0 && !isLoading && (
            <p className="text-sm text-muted-foreground">
              No booking-shaped emails found in the last 6 months.
            </p>
          )}
          {data?.emails?.map((e) => (
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
              </div>
              <Button
                size="sm"
                disabled={importMut.isPending && importMut.variables === e.id}
                onClick={() => importMut.mutate(e.id)}
                data-testid={`gmail-import-button-${e.id}`}
              >
                {importMut.isPending && importMut.variables === e.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Import"
                )}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}