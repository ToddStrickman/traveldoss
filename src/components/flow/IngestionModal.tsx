import { useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { parseDropIn } from "@/lib/itinerary/parse";
import type { Block } from "@/lib/skins/types";
import type { SkinModule } from "@/lib/skins/registry";
import { toast } from "sonner";

type Tab = "paste" | "transcript" | "inbox";

const TABS: { id: Tab; n: string; label: string; sub: string }[] = [
  { id: "paste", n: "I", label: "Paste Itinerary", sub: "ChatGPT, Claude, notes." },
  { id: "transcript", n: "II", label: "Upload Transcript", sub: "Text or .vtt / .srt files." },
  { id: "inbox", n: "III", label: "Scan Inbox", sub: "Bookings, last six months." },
];

function serial() {
  const d = new Date();
  const y = String(d.getFullYear()).slice(-2);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const r = Math.floor(Math.random() * 9000 + 1000);
  return `TD-${y}${m}${day}-${r}`;
}

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
  const [ref] = useState(serial);
  const tabIndex = TABS.findIndex((t) => t.id === tab);

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
      <DialogContent className="td-grain max-w-3xl overflow-hidden border-white/10 bg-paper/95 p-0 text-ink shadow-[0_40px_120px_-30px_rgba(0,0,0,0.6)] sm:rounded-xl">
        {/* Letterhead */}
        <div className="relative border-b border-ink/10 px-10 pb-7 pt-10">
          <div className="flex items-start justify-between gap-6">
            <div className="flex flex-col gap-3">
              <div className="td-eyebrow flex items-center gap-3 text-ink/55">
                <span className="h-px w-8 bg-ink/25" />
                TravelDoss<span className="text-ink/30">®</span>
                <span className="text-ink/30">·</span>
                {template ? template.meta.codename : "Template"}
              </div>
              <h2 className="td-headline text-[2.6rem] font-normal leading-[1.02] tracking-[-0.02em] text-ink">
                Bring your trip
                <span className="italic text-ink/80"> in</span>
                <span className="text-seal">.</span>
              </h2>
              <p className="max-w-md text-[13px] leading-relaxed text-ink-soft">
                Three ways in. One result — a quietly composed dossier, set in this template.
              </p>
            </div>
            <div className="hidden text-right md:block">
              <div className="td-eyebrow text-ink/40">Ref.</div>
              <div className="mt-1 font-mono text-[11px] tracking-[0.25em] text-ink/70">{ref}</div>
              <div className="td-rule mx-auto mt-3 w-20" />
              <div className="td-eyebrow mt-2 text-ink/40">Composed in</div>
              <div className="mt-1 text-[11px] italic text-ink/70" style={{ fontFamily: "var(--font-display)" }}>
                London &amp; New York
              </div>
            </div>
          </div>
        </div>

        {/* Serialised steps */}
        <div className="px-10 pt-7">
          <div className="td-eyebrow mb-3 flex items-center justify-between text-ink/45">
            <span>Step {tabIndex + 1} of {TABS.length}</span>
            <span>Choose a source</span>
          </div>
          <div className="grid grid-cols-1 gap-0 overflow-hidden rounded-md border border-ink/10 md:grid-cols-3">
            {TABS.map((opt, i) => {
              const on = tab === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setTab(opt.id)}
                  className={`group relative flex flex-col items-start gap-2 px-5 py-5 text-left transition-elegant ${
                    on ? "bg-paper" : "bg-paper/40 hover:bg-paper/70"
                  } ${i > 0 ? "md:border-l md:border-ink/10" : ""}`}
                >
                  <span className="flex items-baseline gap-2">
                    <span className="font-mono text-[10px] tracking-[0.35em] text-seal/80">{opt.n}</span>
                    <span className="td-rule w-6 opacity-60" />
                  </span>
                  <span className="text-[17px] leading-snug text-ink" style={{ fontFamily: "var(--font-display)" }}>
                    {opt.label}
                  </span>
                  <span className="text-[11px] leading-relaxed text-ink-soft">{opt.sub}</span>
                  {on && (
                    <span aria-hidden className="absolute inset-x-5 bottom-0 h-px bg-seal" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-10 pt-6">
          {tab === "paste" && (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Day 1: arrive, check into hotel, dinner at…"
              rows={8}
              className="w-full rounded-md border border-ink/15 bg-paper/60 px-4 py-3 font-mono text-[12.5px] leading-relaxed text-ink outline-none transition-elegant placeholder:text-ink/35 focus:border-seal focus:bg-paper"
            />
          )}
          {tab === "transcript" && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              className="flex flex-col items-center justify-center rounded-md border border-dashed border-ink/20 bg-paper/40 px-6 py-12 text-center transition-elegant hover:border-seal/60 hover:bg-paper/60"
            >
              <p className="text-[15px] italic text-ink/80" style={{ fontFamily: "var(--font-display)" }}>
                Drop a transcript file or{" "}
                <button
                  onClick={() => fileRef.current?.click()}
                  className="text-seal underline-offset-4 hover:underline"
                >
                  browse
                </button>
              </p>
              <p className="td-eyebrow mt-3 text-ink/40">
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
                <pre className="mt-5 max-h-32 w-full overflow-y-auto rounded-md border border-ink/10 bg-paper/70 p-3 text-left font-mono text-[11px] leading-relaxed text-ink-soft">
                  {text.slice(0, 600)}
                  {text.length > 600 ? "…" : ""}
                </pre>
              )}
            </div>
          )}
          {tab === "inbox" && (
            <div className="rounded-md border border-ink/15 bg-paper/60 px-6 py-7">
              <p className="text-[15px] leading-relaxed text-ink/85" style={{ fontFamily: "var(--font-display)" }}>
                Securely extracts bookings from the last 6 months for this destination.
                <span className="italic text-ink/65"> Read-only — the messages are never stored.</span>
              </p>
              <p className="td-eyebrow mt-4 text-ink/45">
                Continuing will redirect you to Google to grant access.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-10 flex items-center justify-between gap-4 border-t border-ink/10 bg-paper/40 px-10 py-5">
          <div className="flex items-center gap-4">
            <button
              onClick={() => onOpenChange(false)}
              className="td-eyebrow text-ink/45 transition-elegant hover:text-ink"
            >
              Cancel
            </button>
            <span className="hidden h-3 w-px bg-ink/15 sm:block" />
            <span className="td-eyebrow hidden text-ink/35 sm:inline">
              Ref. <span className="font-mono normal-case tracking-[0.25em] text-ink/55">{ref}</span>
            </span>
          </div>
          <button
            onClick={submit}
            disabled={!template}
            className="group inline-flex items-center gap-4 rounded-md border border-seal/40 bg-seal/15 py-3 pl-5 pr-3 text-[11px] font-medium uppercase tracking-[0.4em] text-seal transition-elegant hover:border-seal hover:bg-seal hover:text-paper disabled:opacity-40"
          >
            <span>Mint Dossier</span>
            <span aria-hidden className="inline-flex h-7 w-7 items-center justify-center rounded-sm border border-seal/40 transition-elegant group-hover:border-paper/40">
              →
            </span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}