import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listTripDocPreviews } from "@/lib/gmail-import.functions";
import { ExternalLink } from "lucide-react";

/**
 * Renders every Google Doc preview attached to a trip as an embedded
 * iframe. Empty when no previews exist (no chrome shown).
 */
export function TripDocPreviews({ tripId }: { tripId: string }) {
  const fetchPreviews = useServerFn(listTripDocPreviews);
  const { data } = useQuery({
    queryKey: ["trip-doc-previews", tripId],
    queryFn: () => fetchPreviews({ data: { tripId } }),
    staleTime: 30_000,
  });

  const previews = data?.previews ?? [];
  if (previews.length === 0) return null;

  return (
    <section
      className="mt-8 space-y-4"
      data-testid="trip-doc-previews"
    >
      <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
        Attached booking documents
      </h2>
      {previews.map((p) => (
        <div
          key={p.id}
          data-testid={`doc-preview-${p.google_doc_id}`}
          className="overflow-hidden rounded-lg border border-border bg-card"
        >
          <div className="flex items-center justify-between px-4 py-2 text-xs text-muted-foreground">
            <span>Source: {p.source}</span>
            <a
              href={p.google_doc_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              Open <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <iframe
            data-testid={`doc-preview-iframe-${p.google_doc_id}`}
            src={`${p.google_doc_url.replace(/\/edit$/, "")}/preview`}
            title={`Booking preview ${p.google_doc_id}`}
            className="h-[480px] w-full border-0"
            sandbox="allow-scripts allow-same-origin allow-popups"
            loading="lazy"
          />
        </div>
      ))}
    </section>
  );
}