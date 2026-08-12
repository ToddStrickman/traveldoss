import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LEGAL_DOCS, type LegalDocSlug } from "@/lib/legal/registry";
import { LEGAL_CONTENT } from "@/lib/legal/content";
import { LegalMarkdown } from "./LegalMarkdown";

/**
 * Inline trigger that opens a scrollable read-only view of a legal document,
 * so users can review Terms / Privacy without leaving the page.
 */
export function LegalDocDialog({
  slug,
  label,
  className,
}: {
  slug: LegalDocSlug;
  label: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const meta = LEGAL_DOCS[slug];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className={className}>
          {label}
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] max-w-2xl overflow-hidden p-0">
        <DialogHeader className="border-b border-ink/10 px-5 py-4 text-left">
          <DialogTitle>{meta.title}</DialogTitle>
          <DialogDescription>
            Version {meta.version} · Effective {meta.effectiveAt}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[65dvh] overflow-y-auto px-5 pb-6 text-[14px] leading-relaxed text-ink/75">
          <LegalMarkdown markdown={LEGAL_CONTENT[slug]} />
        </div>
      </DialogContent>
    </Dialog>
  );
}