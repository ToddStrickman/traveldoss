/**
 * SkinPeek — the template newsstand, every pointer type. Activating a
 * gallery tile opens the skin full-screen at its REAL rendering (mobile
 * layout on phones, desktop layout on desktops); swipe / drag / arrow keys
 * browse neighboring skins like magazines on a rack. Mint stays pinned at
 * the bottom — preview first, commit second.
 */
import * as React from "react";
import useEmblaCarousel from "embla-carousel-react";
import { X } from "lucide-react";
import type { SkinModule } from "@/lib/skins/registry";
import type { SkinView } from "@/lib/skins/types";
import { cn } from "@/lib/utils";
import { InertRender } from "@/lib/skins/shared/views/parts";
import { ViewSwitch } from "@/components/ViewSwitch";

export function SkinPeek({
  skins,
  startId,
  onClose,
  onMint,
  mintingId,
}: {
  skins: SkinModule[];
  startId: string;
  onClose: () => void;
  onMint: (id: string) => void;
  mintingId: string | null;
}) {
  const startIndex = Math.max(
    0,
    skins.findIndex((s) => s.meta.id === startId),
  );
  const [emblaRef, emblaApi] = useEmblaCarousel({ startIndex, align: "start" });
  const [index, setIndex] = React.useState(startIndex);
  // The signature pivot, present in the sample too. Horizontal/grid views
  // pan sideways themselves, so skin-to-skin drag is disabled off-vertical
  // (arrows, dots, and keyboard still browse the rack).
  const [view, setView] = React.useState<SkinView>("vertical");
  React.useEffect(() => {
    emblaApi?.reInit({ watchDrag: view === "vertical" });
  }, [emblaApi, view]);
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setIndex(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    if (import.meta.env.DEV) {
      (window as unknown as { __peekApi?: unknown }).__peekApi = emblaApi;
    }
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi]);

  // Scroll lock + escape + initial focus while the peek is up.
  React.useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") emblaApi?.scrollNext();
      if (e.key === "ArrowLeft") emblaApi?.scrollPrev();
      if (e.key === "Tab") {
        // Minimal trap: keep focus cycling inside the dialog.
        const root = rootRef.current;
        if (!root) return;
        const focusables = root.querySelectorAll<HTMLElement>(
          'button, a[href], [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, emblaApi]);

  const active = skins[index] ?? skins[0];
  const minting = mintingId === active.meta.id;

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Template preview: ${active.meta.codename}`}
      className="fixed inset-0 z-[60] flex flex-col bg-paper text-ink"
    >
      {/* Top bar: close + live codename/hook for the visible skin */}
      <div
        className="flex items-center gap-3 border-b border-white/10 px-2 py-2"
        style={{ paddingTop: "max(8px, env(safe-area-inset-top, 0px))" }}
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          className="tap inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-soft transition-colors hover:text-seal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seal"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <div className="text-[8px] font-medium uppercase tracking-[0.45em] text-ink/40">
            Preview
          </div>
          <div
            className="truncate text-lg leading-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {active.meta.codename}
          </div>
          <div className="truncate text-[11px] italic text-ink-soft">
            "{active.meta.personality}"
          </div>
        </div>
        <div className="h-11 w-11 shrink-0" aria-hidden />
      </div>

      {/* The rack: horizontal embla, each slide scrolls vertically */}
      <div ref={emblaRef} className="min-h-0 flex-1 overflow-hidden">
        <div className="flex h-full">
          {skins.map((skin) => (
            <div
              key={skin.meta.id}
              className="cv-slide h-full w-full flex-[0_0_100%] overflow-y-auto overscroll-contain"
              style={{ background: skin.tokens.bg }}
            >
              {skin.tokens.fontUrl && (
                <link rel="stylesheet" href={skin.tokens.fontUrl} />
              )}
              <InertRender>
                <skin.Render
                  trip={skin.previewFixture.trip}
                  blocks={skin.previewFixture.blocks}
                  view={view}
                />
              </InertRender>
              <div className="h-24" aria-hidden />
            </div>
          ))}
        </div>
      </div>

      {/* View pivot + rack dots + pinned mint (width-capped on desktop) */}
      <div className="border-t border-white/10 bg-paper/95 px-4 pt-3 backdrop-blur-md pb-safe sm:mx-auto sm:w-full sm:max-w-xl sm:border-x sm:border-t sm:rounded-t-xl">
        <ViewSwitch
          value={view}
          onChange={setView}
          tokens={active.tokens}
          className="mx-auto mb-2 flex w-fit gap-1 rounded-full p-1"
        />
        <div
          className="mb-3 flex items-center justify-center gap-0.5"
          role="tablist"
          aria-label="Template previews"
        >
          {skins.map((s, i) => (
            <button
              key={s.meta.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Preview ${s.meta.codename}`}
              onClick={() => emblaApi?.scrollTo(i)}
              className="tap inline-flex h-11 min-w-6 items-center justify-center focus-visible:outline-none"
            >
              <span
                aria-hidden
                className={cn(
                  "h-1 rounded-full transition-all duration-300",
                  i === index ? "w-5 bg-seal" : "w-1 bg-ink/20",
                )}
              />
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={minting}
          onClick={() => onMint(active.meta.id)}
          className="td-mint-button td-mint-cta inline-flex min-h-12 w-full items-center justify-center gap-2.5 rounded-full bg-seal px-5 text-[11px] font-semibold uppercase tracking-[0.32em] text-paper transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seal/60 focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:cursor-wait disabled:opacity-60"
        >
          {minting ? (
            <span
              aria-hidden
              className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent"
            />
          ) : (
            <span
              aria-hidden
              className="td-mint-pulse inline-block h-2 w-2 rounded-full bg-paper shadow-[0_0_10px_rgba(255,255,255,0.9)]"
            />
          )}
          {minting ? "Minting your dossier…" : `Mint ${active.meta.codename}`}
        </button>
        <div className="mt-2 hidden pb-2 text-center text-[9px] uppercase tracking-[0.3em] text-ink/35 sm:block">
          ← → browse templates · Esc closes
        </div>
      </div>
    </div>
  );
}
