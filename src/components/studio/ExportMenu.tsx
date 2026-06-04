import { CalendarPlus, Link2, Printer } from "lucide-react";
import { toast } from "sonner";
import type { Block, TripView } from "@/lib/skins/types";
import { buildItineraryIcs, downloadIcs } from "@/lib/ics";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useLocation } from "@tanstack/react-router";

export function ExportMenu({
  slug,
  trip,
  blocks,
}: {
  slug: string;
  trip?: TripView;
  blocks?: Block[];
}) {
  const navigate = useNavigate();
  const location = useLocation();
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
  async function addToCalendar() {
    if (!trip || !blocks) {
      toast.error("Nothing to export yet");
      return;
    }
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      toast.message("Sign in to add to your calendar", {
        description: "We'll bring you right back here.",
      });
      navigate({ to: "/login", search: { redirect: location.pathname } });
      return;
    }
    const result = buildItineraryIcs(trip, blocks);
    if (result.count === 0) {
      toast.message("No flights or hotel stays to export", {
        description:
          "Add flight dates/times or accommodation check-in/check-out and try again.",
      });
      return;
    }
    downloadIcs(result);
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
      <ExportButton
        onClick={addToCalendar}
        icon={<CalendarPlus className="h-3.5 w-3.5" />}
        label="Calendar"
        disabled={!trip || !blocks}
      />
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