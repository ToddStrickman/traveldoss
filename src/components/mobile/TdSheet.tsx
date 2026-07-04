/**
 * TdSheet — the branded bottom sheet for the mobile visitor path.
 *
 * One primitive, many contexts (view switch, day jump, place detail, mint
 * flow, utilities). Wraps the shadcn/vaul drawer with TravelDoss physics:
 * elevated-navy panel, hairline top rule, grabber, editorial title row, an
 * always-visible close affordance (swipe-to-dismiss alone is not
 * discoverable or accessible), and reduced-motion-aware entry.
 *
 * Design notes (.design/traveldoss-mobile/DESIGN_BRIEF.md):
 * - Sheets carry complexity so screens can stay single-action.
 * - `snapHeight` "full" pins the sheet to the top safe area for flows that
 *   host a keyboard (mint paste step); "content" hugs its children.
 */
import * as React from "react";
import { X } from "lucide-react";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

interface TdSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Editorial title row. Rendered as the accessible sheet title. */
  title: string;
  /** Optional whispered subtitle under the title. */
  description?: string;
  /** "content" hugs children (default); "full" pins near the top edge. */
  snapHeight?: "content" | "full";
  className?: string;
  children: React.ReactNode;
}

export function TdSheet({
  open,
  onOpenChange,
  title,
  description,
  snapHeight = "content",
  className,
  children,
}: TdSheetProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
      <DrawerContent
        className={cn(
          // Panel: elevated navy, soft top radius, hairline rule, no default border
          "border-0 bg-surface text-ink shadow-elev",
          "rounded-t-2xl",
          snapHeight === "full" && "h-[calc(100dvh-max(12px,var(--safe-t))-12px)]",
          className,
        )}
        aria-describedby={description ? undefined : ""}
      >
        {/* Hairline rule under the grabber the drawer already renders */}
        <div aria-hidden className="mx-6 border-t border-white/5" />

        <div className="flex items-start justify-between gap-4 px-6 pt-4">
          <div className="min-w-0">
            <DrawerTitle
              className="font-normal text-[11px] uppercase tracking-[0.35em] text-seal"
            >
              {title}
            </DrawerTitle>
            {description ? (
              <DrawerDescription className="mt-2 text-sm leading-relaxed text-ink-soft">
                {description}
              </DrawerDescription>
            ) : null}
          </div>
          <DrawerClose
            aria-label="Close"
            className="tap -mr-2 -mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-ink/5 hover:text-seal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seal"
          >
            <X className="h-4 w-4" />
          </DrawerClose>
        </div>

        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pt-4",
            "pb-safe",
          )}
        >
          {children}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
