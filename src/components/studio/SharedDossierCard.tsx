/**
 * SharedDossierCard — persistent "the URL is the share" affordance.
 *
 * Autosave IS publish on /t/:slug (the public route reads latest saved
 * content on every request), so this card just exposes the always-current
 * URL with a one-tap copy. Kept compact so it can sit inline in the
 * EditingStatusBar on both mobile and desktop without pushing content.
 */
import * as React from "react";
import { Link2, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SandBorder } from "@/components/flow/SandBorder";
import { SITE_URL } from "@/lib/site";

export function copyDossierLink(slug: string) {
  const url = `${SITE_URL}/t/${slug}`;
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    toast.error("Clipboard unavailable");
    return Promise.resolve(false);
  }
  return navigator.clipboard.writeText(url).then(
    () => {
      toast.success("Link copied", { description: url });
      return true;
    },
    () => {
      toast.error("Couldn't copy");
      return false;
    },
  );
}

export function SharedDossierCard({
  slug,
  className,
  compact = false,
}: {
  slug: string;
  className?: string;
  /** Icon-only variant for tight sticky bars. */
  compact?: boolean;
}) {
  const [copied, setCopied] = React.useState(false);
  const url = `${SITE_URL}/t/${slug}`;

  const onCopy = async () => {
    const ok = await copyDossierLink(slug);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    /* One clean champagne-gold ring with drifting sand grains — the same
       border language as the layout switcher. Purely local/decorative, so it
       renders identically offline. */
    <span
      className={cn(
        "td-sand-shell relative inline-flex rounded-full p-px",
        className,
      )}
      data-print="hide"
    >
      <SandBorder />
      <button
        type="button"
        onClick={onCopy}
        data-print="hide"
        title={`Share this dossier — ${url}`}
        aria-label={`Copy shareable link to this dossier`}
        className="tap group relative inline-flex min-h-11 items-center gap-2 rounded-full bg-paper/85 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.32em] text-ink-soft backdrop-blur-md transition-colors hover:bg-seal/5 hover:text-seal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seal motion-reduce:transition-none"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-seal" aria-hidden />
        ) : (
          <Link2 className="h-3.5 w-3.5" aria-hidden />
        )}
        {compact ? null : <span>{copied ? "Copied" : "Share"}</span>}
      </button>
    </span>
  );
}