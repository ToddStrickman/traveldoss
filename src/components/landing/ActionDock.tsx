import { ClipboardPaste, FileUp, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Fixed glassmorphism action dock for the landing page. Groups the three
 * high-intent flows into a single floating rail: primary compose, paste
 * text, and import a booking file. Pinned to the bottom safe-area on
 * mobile and floats centered on desktop.
 */
export function ActionDock({
  onCompose,
  onPaste,
  onImport,
  className,
}: {
  onCompose: () => void;
  onPaste: () => void;
  onImport: () => void;
  className?: string;
}) {
  return (
    <TooltipProvider delayDuration={1000} skipDelayDuration={300}>
    <div
      role="toolbar"
      aria-label="Quick actions"
      data-print="hide"
      className={cn(
        // Fixed bottom, safe-area aware, centered. Never causes horizontal
        // overflow at 375 (max-w clamped) and stays reachable on desktop.
        "fixed left-1/2 z-40 -translate-x-1/2",
        // On mobile, lift above the fixed MobileNavBar (~56px + safe area).
        // On md+ (where MobileNavBar is hidden), sit near the bottom edge.
        "bottom-[calc(env(safe-area-inset-bottom)+72px)] md:bottom-[max(16px,env(safe-area-inset-bottom))]",
        "flex items-center gap-1.5 rounded-full p-1.5",
        "border border-white/15 bg-white/10 shadow-[0_10px_40px_-12px_rgba(0,0,0,0.6)]",
        "backdrop-blur-[12px] backdrop-saturate-150",
        "max-w-[calc(100vw-16px)]",
        className,
      )}
      style={{
        // Subtle inner highlight for the "glass" bevel.
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.18), 0 10px 40px -12px rgba(0,0,0,0.6)",
      }}
    >
      {/* Primary — accent-filled, high-contrast, lifts on hover */}
      <Tooltip>
        <TooltipTrigger asChild>
        <button
        type="button"
        onClick={onCompose}
        className={cn(
          "tap group relative inline-flex min-h-11 items-center gap-2 rounded-full",
          "bg-seal px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-paper",
          "transition-all duration-300 will-change-transform",
          "hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-10px_rgba(191,161,74,0.7)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seal/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
          "sm:px-5",
        )}
      >
        <Sparkles className="h-4 w-4" aria-hidden />
        <span>Compose</span>
        </button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={8}>
          Compose a new dossier with AI
        </TooltipContent>
      </Tooltip>

      <span aria-hidden className="h-6 w-px bg-white/15" />

      {/* Paste text */}
      <DockButton
        onClick={onPaste}
        icon={<ClipboardPaste className="h-4 w-4" aria-hidden />}
        label="Paste text"
        tooltip="Paste an itinerary or booking email"
      />

      {/* Import file */}
      <DockButton
        onClick={onImport}
        icon={<FileUp className="h-4 w-4" aria-hidden />}
        label="Import file"
        tooltip="Upload a booking PDF or document"
      />
    </div>
    </TooltipProvider>
  );
}

function DockButton({
  onClick,
  icon,
  label,
  tooltip,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  tooltip: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
      <button
      type="button"
      onClick={onClick}
      className={cn(
        "tap inline-flex min-h-11 items-center gap-2 rounded-full px-3 py-2",
        "text-[11px] font-medium uppercase tracking-[0.2em] text-ink",
        "transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/15 hover:text-seal",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seal/60",
        "sm:px-4",
      )}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
      <span className="sr-only sm:hidden">{label}</span>
      </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={8}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}