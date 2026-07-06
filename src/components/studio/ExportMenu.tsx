import { CalendarPlus, FileText, Link2, Printer } from "lucide-react";
import { toast } from "sonner";
import type { Block, TripView } from "@/lib/skins/types";
import { buildItineraryIcs, downloadIcs } from "@/lib/ics";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useLocation } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { exportItineraryToGoogleDoc } from "@/lib/itinerary/export.functions";
import { useState } from "react";
import { withRetry } from "@/lib/retry";

export function ExportMenu({
  slug,
  trip,
  blocks,
  isOwner = true,
}: {
  slug: string;
  trip?: TripView;
  blocks?: Block[];
  isOwner?: boolean;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const exportDoc = useServerFn(exportItineraryToGoogleDoc);
  const [exporting, setExporting] = useState(false);
  const [exportAttempt, setExportAttempt] = useState(0);
  function copyLink() {
    const url = `${window.location.origin}/t/${slug}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success("Link copied", { description: url }),
      () => toast.error("Couldn't copy"),
    );
  }
  function printPdf() {
    document.body.classList.add("td-print-mode");
    setTimeout(() => {
      window.print();
      document.body.classList.remove("td-print-mode");
    }, 50);
  }
  async function exportToGoogleDoc() {
    if (exporting) return;
    setExporting(true);
    setExportAttempt(0);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.message("Sign in to export to Google Docs", {
          description: "We'll bring you right back here.",
        });
        navigate({ to: "/login", search: { redirect: location.pathname } });
        return;
      }
      const r = await withRetry(() => exportDoc({ data: { slug } }), {
        attempts: 3,
        onAttempt: ({ attempt }) => setExportAttempt(attempt),
      });
      toast.success("Opened in Google Docs", { description: r.googleDocUrl });
      window.open(r.googleDocUrl, "_blank", "noopener");
    } catch (err) {
      console.error("[export-doc] failed", err);
      toast.error("Couldn't export to Google Docs", {
        description: err instanceof Error ? err.message : String(err),
        action: { label: "Retry", onClick: () => void exportToGoogleDoc() },
      });
    } finally {
      setExporting(false);
      setExportAttempt(0);
    }
  }
  async function addToCalendar() {
    if (!trip || !blocks) {
      toast.error("Nothing to export yet", {
        description: "Open a trip with at least one flight or hotel block first.",
      });
      return;
    }

    // 1. Verify the viewer is signed in. getUser() re-validates with the auth server,
    //    so a stale or revoked session surfaces here instead of silently failing later.
    let user;
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      user = data.user;
    } catch (err) {
      console.error("[calendar-export] auth check failed", err);
      toast.error("Couldn't verify your sign-in", {
        description:
          err instanceof Error
            ? `${err.message}. Try signing in again.`
            : "Please sign in again and retry.",
      });
      navigate({ to: "/login", search: { redirect: location.pathname } });
      return;
    }
    if (!user) {
      toast.message("Sign in to add to your calendar", {
        description: "We'll bring you right back here.",
      });
      navigate({ to: "/login", search: { redirect: location.pathname } });
      return;
    }

    // 2. Build the .ics. Any parsing/serialization failure should land as a
    //    readable message — not a console-only crash.
    let result;
    try {
      result = buildItineraryIcs(trip, blocks);
    } catch (err) {
      console.error("[calendar-export] build failed", err);
      toast.error("Couldn't generate the calendar file", {
        description:
          err instanceof Error
            ? err.message
            : "Something went wrong while reading your dossier. Try again, or check that flight times and stay dates are filled in.",
      });
      return;
    }

    if (result.count === 0) {
      toast.message("No flights or hotel stays to export", {
        description:
          "Add flight dates/times or accommodation check-in/check-out and try again.",
      });
      return;
    }

    // 3. Trigger the download. Blob creation or the synthetic click can fail
    //    in locked-down browsers / private modes — catch and surface that too.
    try {
      downloadIcs(result);
    } catch (err) {
      console.error("[calendar-export] download failed", err);
      toast.error("Couldn't download the calendar file", {
        description:
          "Your browser blocked the download. Check pop-up / download permissions for this site and try again.",
      });
      return;
    }

    const parts: string[] = [];
    if (result.breakdown.flights)
      parts.push(`${result.breakdown.flights} flight${result.breakdown.flights === 1 ? "" : "s"}`);
    if (result.breakdown.stays)
      parts.push(`${result.breakdown.stays} stay${result.breakdown.stays === 1 ? "" : "s"}`);
    toast.success("Calendar file ready", {
      description: `${parts.join(" · ")} — open the .ics to add to Apple, Google, or Outlook.`,
    });
  }

  return (
    <div
      data-print="hide"
      className="fixed right-3 z-40 flex items-center gap-1 rounded-full border border-white/10 bg-paper/85 p-1 text-ink backdrop-blur-md sm:right-5 sm:gap-2 sm:p-1.5 bottom-[max(72px,calc(env(safe-area-inset-bottom)+72px))]"
    >
      <ExportButton onClick={copyLink} icon={<Link2 className="h-3.5 w-3.5" />} label="Live URL" />
      {isOwner && (
        <>
          <ExportButton
            onClick={addToCalendar}
            icon={<CalendarPlus className="h-3.5 w-3.5" />}
            label="Calendar"
            disabled={!trip || !blocks}
          />
          <ExportButton
            onClick={exportToGoogleDoc}
            icon={<FileText className="h-3.5 w-3.5" />}
            label={
              exporting
                ? exportAttempt > 1
                  ? `Retrying (${exportAttempt}/3)…`
                  : "Exporting…"
                : "Google Doc"
            }
            disabled={exporting}
          />
        </>
      )}
      <ExportButton onClick={printPdf} icon={<Printer className="h-3.5 w-3.5" />} label="PDF" />
    </div>
  );
}

function ExportButton({
  onClick,
  icon,
  label,
  disabled,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.3em] text-ink-soft transition-elegant hover:bg-seal/15 hover:text-seal disabled:opacity-40 sm:min-h-0 sm:min-w-0"
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}