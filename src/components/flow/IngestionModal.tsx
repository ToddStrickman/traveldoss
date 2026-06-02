import { useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { parseDropIn } from "@/lib/itinerary/parse";
import type { Block } from "@/lib/skins/types";
import type { SkinModule } from "@/lib/skins/registry";
import { toast } from "sonner";

type Tab = "paste" | "transcript" | "inbox";

export function IngestionModal({
  open,
  onOpenChange,
  template,
  onGenerate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  template: SkinModule | null;
  onGenerate: (blocks: Block[], sourceLabel: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("paste");
  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function submit() {
    if (!template) return;
    if (tab === "inbox") {
      window.location.href = "/api/public/google/start";
      return;
    }
    const trimmed = text.trim();
    if (trimmed.length < 8) {
      toast.error("Add a few lines first so we have something to craft.");
      return;
    }
    const blocks = parseDropIn(trimmed, tab === "transcript" ? "transcript" : "text");
    if (!blocks.length) {
      toast.error("We couldn't read structure out of that. Try Day 1, Day 2…");
      return;
    }
    onGenerate(blocks, tab === "transcript" ? "Reading your transcript…" : "Reading your itinerary…");
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.type.startsWith("audio/")) {
      toast.message("Audio transcription is coming soon.", { description: "For now, paste a transcript." });
      return;
    }
    const t = await f.text();
    setText(t);
    toast.success(`Loaded ${f.name}`);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    if (f.type.startsWith("audio/")) {
      toast.message("Audio transcription is coming soon.");
      return;
    }
    f.text().then((t) => {
      setText(t);
      toast.success(`Loaded ${f.name}`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="surface-card max-w-3xl border-white/10 bg-paper/95 p-0 text-ink sm:rounded-xl">
        <div className="px-8 pt-8">
          <div className="flex items-center gap-3 text-[10px] font-medium uppercase tracking-[0.4em] text-ink/45">
            <span className="h-px w-6 bg-ink/25" />
            {template ? template.meta.codename : "Template"}
            <span className="h-px w-6 bg-ink/25" />
          </div>
          <h2
            className="mt-3 text-4xl font-normal leading-[1.05] tracking-tight text-ink"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Bring your trip<span className="italic text-ink/80"> in.</span>
          </h2>
          <p className="mt-2 text-sm text-ink-soft">
            Three ways. Same result — a quietly beautiful dossier in this template.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 px-8 pt-6 md:grid-cols-3">
          {(
            [
              { id: "paste", label: "Paste Itinerary", sub: "ChatGPT, Claude, notes." },
              { id: "transcript", label: "Upload Transcript", sub: "Text or .vtt/.srt files." },
              { id: "inbox", label: "Scan Inbox", sub: "Bookings from the last 6 months." },
            ] as { id: Tab; label: string; sub: string }[]
          ).map((opt) => {
            const on = tab === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setTab(opt.id)}
                className={`surface-card group flex flex-col items-start gap-1.5 rounded-lg px-4 py-4 text-left transition-elegant ${
                  on ? "ring-1 ring-seal" : "opacity-80 hover:opacity-100"
                }`}
              >
                <span className="text-[10px] font-medium uppercase tracking-[0.35em] text-seal/80">
                  {opt.id === "paste" ? "A" : opt.id === "transcript" ? "B" : "C"}
                </span>
                <span className="text-base text-ink" style={{ fontFamily: "var(--font-display)" }}>
                  {opt.label}
                </span>
                <span className="text-[11px] text-ink-soft">{opt.sub}</span>
              </button>
            );
          })}
        </div>

        <div className="px-8 pt-6">
          {tab === "paste" && (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Day 1: arrive, check into hotel, dinner at…"
              rows={8}
              className="w-full rounded-lg border border-white/10 bg-paper/40 px-4 py-3 font-mono text-[13px] text-ink outline-none transition-elegant focus:border-seal"
            />
          )}
          {tab === "transcript" && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              className="flex flex-col items-center justify-center rounded-lg border border-dashed border-white/15 bg-paper/30 px-6 py-10 text-center transition-elegant hover:border-seal/60"
            >
              <p className="text-sm text-ink-soft">
                Drop a transcript file or{" "}
                <button
                  onClick={() => fileRef.current?.click()}
                  className="text-seal underline-offset-4 hover:underline"
                >
                  browse
                </button>
              </p>
              <p className="mt-1 text-[11px] text-ink/40">
                .txt, .vtt, .srt — audio coming soon
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".txt,.vtt,.srt,text/*,audio/*"
                className="hidden"
                onChange={onFile}
              />
              {text && (
                <pre className="mt-4 max-h-32 w-full overflow-y-auto rounded-md border border-white/10 bg-paper/40 p-3 text-left text-[11px] text-ink-soft">
                  {text.slice(0, 600)}
                  {text.length > 600 ? "…" : ""}
                </pre>
              )}
            </div>
          )}
          {tab === "inbox" && (
            <div className="rounded-lg border border-white/10 bg-paper/40 px-5 py-6 text-sm text-ink-soft">
              <p>
                Securely extracts bookings from the last 6 months for this destination.
                Read-only — we never store the messages.
              </p>
              <p className="mt-3 text-[11px] text-ink/45">
                Continuing will redirect you to Google to grant access.
              </p>
            </div>
          )}
        </div>

        <div className="mt-8 flex items-center justify-between border-t border-white/10 px-8 py-5">
          <button
            onClick={() => onOpenChange(false)}
            className="text-[10px] uppercase tracking-[0.4em] text-ink/45 transition-elegant hover:text-ink"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!template}
            className="surface-card inline-flex items-center gap-3 rounded-md bg-seal/20 px-5 py-3 text-[11px] font-medium uppercase tracking-[0.4em] text-seal transition-elegant hover:bg-seal hover:text-paper disabled:opacity-40"
          >
            Generate Dossier
            <span aria-hidden>→</span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}