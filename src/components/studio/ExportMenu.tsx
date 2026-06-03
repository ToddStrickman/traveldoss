import { useState } from "react";
import { Link2, Printer, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function ExportMenu({ slug, canPushToDocs = true }: { slug: string; canPushToDocs?: boolean }) {
  const [busy, setBusy] = useState<null | "gdocs">(null);

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
  async function pushToDocs() {
    setBusy("gdocs");
    try {
      const res = await fetch("/api/public/export/gdocs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as { docUrl?: string };
      if (json.docUrl) {
        toast.success("Pushed to Google Docs", {
          action: { label: "Open", onClick: () => window.open(json.docUrl, "_blank") },
        });
      } else {
        toast.success("Pushed to Google Docs");
      }
    } catch (e) {
      toast.error("Couldn't push to Google Docs", { description: String(e) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      data-print="hide"
      className="fixed right-3 z-40 flex items-center gap-1 rounded-full border border-white/10 bg-paper/85 p-1 text-ink backdrop-blur-md sm:right-5 sm:gap-2 sm:p-1.5 bottom-[max(72px,calc(env(safe-area-inset-bottom)+72px))] sm:bottom-5 [@media(max-height:820px)]:bottom-[max(72px,calc(env(safe-area-inset-bottom)+72px))]"
    >
      <ExportButton onClick={copyLink} icon={<Link2 className="h-3.5 w-3.5" />} label="Live URL" />
      <ExportButton onClick={printPdf} icon={<Printer className="h-3.5 w-3.5" />} label="PDF" />
      <ExportButton
        onClick={pushToDocs}
        icon={busy === "gdocs" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
        label="Google Docs"
        disabled={!canPushToDocs || busy === "gdocs"}
      />
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