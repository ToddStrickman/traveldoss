import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { parseDropInWithMeta } from "@/lib/itinerary/parse";
import { parseItineraryAi } from "@/lib/itinerary/parse-ai.functions";
import { generateItineraryAi } from "@/lib/itinerary/generate.functions";
import { useServerFn } from "@tanstack/react-start";
import type { Block } from "@/lib/skins/types";
import type { SkinModule } from "@/lib/skins/registry";
import { toast } from "sonner";
import {
  GripVertical,
  Trash2,
  Plus,
  ArrowLeft,
  MapPin,
  Phone,
  Globe,
  Ticket,
  StickyNote,
  AlertTriangle,
  Info,
  Sparkles,
  Bookmark,
  X,
  Accessibility,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { motion } from "motion/react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useSavedTripRequests, type SavedTripRequest } from "@/hooks/use-saved-trip-requests";
import { useGeneratorA11y } from "@/hooks/use-generator-a11y";

type Tab = "paste" | "transcript" | "generate";

const TABS: { id: Tab; n: string; label: string; sub: string }[] = [
  { id: "paste", n: "I", label: "Paste Itinerary", sub: "ChatGPT, Claude, notes." },
  { id: "transcript", n: "II", label: "Upload Transcript", sub: "Text or .vtt / .srt files." },
  { id: "generate", n: "III", label: "Generate Itinerary", sub: "Describe the trip — we'll draft it live." },
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
  onGenerate: (blocks: Block[], sourceLabel: string, destination: string | null) => void;
}) {
  const [tab, setTab] = useState<Tab>("paste");
  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [ref] = useState(serial);
  const tabIndex = TABS.findIndex((t) => t.id === tab);
  const [stage, setStage] = useState<"source" | "review">("source");
  const [reviewBlocks, setReviewBlocks] = useState<Block[]>([]);
  const [reviewLabel, setReviewLabel] = useState("Reading your itinerary…");
  const [reviewDestination, setReviewDestination] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const parseAi = useServerFn(parseItineraryAi);
  const generateAi = useServerFn(generateItineraryAi);

  // ── Generate-tab state ───────────────────────────────────────────────
  const [genPrompt, setGenPrompt] = useState("");
  const [genDestination, setGenDestination] = useState("");
  const [genDuration, setGenDuration] = useState("");
  const [genStartDate, setGenStartDate] = useState("");
  const [genTravelers, setGenTravelers] = useState("");
  const [genPace, setGenPace] = useState<"" | "relaxed" | "balanced" | "packed">("");
  const [genBudget, setGenBudget] = useState<
    "" | "shoestring" | "moderate" | "elevated" | "luxury"
  >("");
  const [genInterests, setGenInterests] = useState<string[]>([]);
  const [clarifyQs, setClarifyQs] = useState<string[]>([]);
  const [clarifyAs, setClarifyAs] = useState<string[]>([]);

  const INTEREST_OPTIONS = [
    "food", "wine", "design", "architecture", "art",
    "history", "nature", "hiking", "beaches", "nightlife",
    "shopping", "kids", "wellness", "music",
  ];

  function toggleInterest(tag: string) {
    setGenInterests((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  async function submit() {
    if (!template) return;
    if (tab === "generate") {
      if (clarifyQs.length) submitClarifications();
      else await submitGenerate();
      return;
    }
    const trimmed = text.trim();
    if (trimmed.length < 8) {
      toast.error("Add a few lines first so we have something to craft.");
      return;
    }
    setParsing(true);
    let blocks: Block[] = [];
    let destination: string | null = null;
    try {
      const r = await parseAi({
        data: {
          text: trimmed,
          source: tab === "transcript" ? "transcript" : "text",
        },
      });
      blocks = r.blocks;
      destination = r.destination;
    } catch (err) {
      console.error("[ai-parse] failed, falling back to local parser", err);
      toast.message("Using offline parser", {
        description:
          err instanceof Error
            ? err.message
            : "AI enrichment unavailable — we'll still structure your text.",
      });
      const r = parseDropInWithMeta(
        trimmed,
        tab === "transcript" ? "transcript" : "text",
      );
      blocks = r.blocks;
      destination = r.destination;
    } finally {
      setParsing(false);
    }
    if (!blocks.length) {
      toast.error("We couldn't read structure out of that. Try Day 1, Day 2…");
      return;
    }
    setReviewBlocks(blocks);
    setReviewLabel(tab === "transcript" ? "Reading your transcript…" : "Reading your itinerary…");
    setReviewDestination(destination);
    setStage("review");
  }

  async function submitGenerate(
    extraAnswers?: Array<{ question: string; answer: string }>,
  ) {
    if (!template) return;
    const trimmed = genPrompt.trim();
    if (trimmed.length < 6 && !genDestination.trim()) {
      toast.error("Tell us a little about the trip, or give us a destination.");
      return;
    }
    setParsing(true);
    try {
      const gen = await generateAi({
        data: {
          prompt: trimmed || `Plan a trip to ${genDestination.trim()}.`,
          destination: genDestination.trim() || undefined,
          duration: genDuration.trim() || undefined,
          startDate: genStartDate.trim() || undefined,
          travelers: genTravelers.trim() || undefined,
          pace: genPace || undefined,
          budget: genBudget || undefined,
          interests: genInterests.length ? genInterests : undefined,
          clarifications: extraAnswers,
          useLiveResearch: true,
        },
      });
      if (gen.kind === "clarify") {
        setClarifyQs(gen.questions);
        setClarifyAs(gen.questions.map(() => ""));
        toast.message("A few quick questions", {
          description: "Answer these so we can tailor the itinerary.",
        });
        return;
      }
      // Hand the AI draft to the existing parser for blocks + live enrichment.
      const parsed = await parseAi({
        data: { text: gen.draft, source: "ai" },
      });
      if (!parsed.blocks.length) {
        toast.error("Generation came back empty. Try a different prompt.");
        return;
      }
      setReviewBlocks(parsed.blocks);
      setReviewLabel("Drafting your itinerary…");
      setReviewDestination(parsed.destination ?? genDestination.trim() ?? null);
      setClarifyQs([]);
      setClarifyAs([]);
      setStage("review");
    } catch (err) {
      console.error("[ai-generate] failed", err);
      toast.error(
        err instanceof Error
          ? err.message
          : "Couldn't generate that itinerary. Try again in a moment.",
      );
    } finally {
      setParsing(false);
    }
  }

  function submitClarifications() {
    if (clarifyAs.some((a) => !a.trim())) {
      toast.error("Answer every question, or leave the field blank to skip.");
      return;
    }
    void submitGenerate(
      clarifyQs.map((q, i) => ({ question: q, answer: clarifyAs[i].trim() })),
    );
  }

  function confirmReview() {
    if (!reviewBlocks.length) {
      toast.error("Add at least one block before minting.");
      return;
    }
    onGenerate(reviewBlocks, reviewLabel, reviewDestination);
    setStage("source");
    setReviewBlocks([]);
  }

  function handleOpenChange(v: boolean) {
    if (!v) {
      setStage("source");
      setReviewBlocks([]);
    }
    onOpenChange(v);
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[92dvh] w-[calc(100vw-16px)] max-w-3xl overflow-y-auto border-white/10 bg-paper/95 p-0 text-ink shadow-[0_40px_120px_-30px_rgba(0,0,0,0.6)] sm:w-full sm:rounded-xl">
        <DialogTitle className="sr-only">Bring your trip in</DialogTitle>
        {stage === "review" ? (
          <ReviewStage
            blocks={reviewBlocks}
            destination={reviewDestination}
            onBlocksChange={setReviewBlocks}
            onDestinationChange={setReviewDestination}
            onBack={() => setStage("source")}
            onConfirm={confirmReview}
            onCancel={() => handleOpenChange(false)}
            templateName={template?.meta.codename ?? "Template"}
            refCode={ref}
          />
        ) : (
          <>
        {/* Letterhead */}
        <div className="relative border-b border-ink/10 px-5 sm:px-8 md:px-10 pb-8 pt-10">
          <div className="flex items-start justify-between gap-8">
            <div className="flex flex-col gap-4">
              <div className="td-eyebrow flex items-center gap-3 text-ink/55">
                <span className="h-px w-8 bg-ink/25" />
                TravelDoss<span className="text-ink/30">®</span>
                <span className="text-ink/30">·</span>
                {template ? template.meta.codename : "Dossier Template"}
              </div>
              <h2 className="td-headline text-[2.75rem] font-normal leading-[1.02] tracking-[-0.022em] text-ink">
                Bring your trip
                <span className="italic text-ink/75"> in</span>
                <span className="text-seal">.</span>
              </h2>
              <p
                className="max-w-md text-[15px] leading-[1.55] text-ink-soft"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Three ways in. One result —{" "}
                <span className="italic text-ink/70">a quietly composed dossier,</span> set in this dossier template.
              </p>
            </div>
            <div className="hidden shrink-0 text-right md:block">
              <div className="td-eyebrow text-ink/40">Ref.</div>
              <div className="mt-1.5 font-mono text-[11px] tracking-[0.28em] text-ink/70">{ref}</div>
              <div className="td-rule mx-auto my-3 w-20" />
              <div className="td-eyebrow text-ink/40">Composed in</div>
              <div
                className="mt-1.5 text-[13px] italic leading-snug text-ink/75"
                style={{ fontFamily: "var(--font-display)" }}
              >
                London &amp; New York
              </div>
            </div>
          </div>
        </div>

        {/* Serialised steps */}
        <div className="px-5 sm:px-8 md:px-10 pt-8">
          <div className="td-eyebrow mb-4 flex items-center justify-between text-ink/45">
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
                  className={`group relative flex flex-col items-start gap-3 px-6 py-6 text-left transition-elegant ${
                    on ? "bg-paper" : "bg-paper/40 hover:bg-paper/70"
                  } ${i > 0 ? "md:border-l md:border-ink/10" : ""}`}
                >
                  <span className="flex items-baseline gap-2">
                    <span className="font-mono text-[10px] tracking-[0.35em] text-seal/80">{opt.n}</span>
                    <span className="td-rule w-6 opacity-60" />
                  </span>
                  <span
                    className="text-[19px] leading-[1.15] tracking-[-0.005em] text-ink"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {opt.label.split(" ")[0]}{" "}
                    <span className="italic text-ink/75">{opt.label.split(" ").slice(1).join(" ")}</span>
                  </span>
                  <span className="text-[12px] leading-[1.55] text-ink-soft">{opt.sub}</span>
                  {on && (
                    <span aria-hidden className="absolute inset-x-6 bottom-0 h-px bg-seal" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-5 sm:px-8 md:px-10 pt-8">
          {tab === "paste" && (
            <div className="flex flex-col gap-3">
              <p
                className="text-[15px] leading-[1.55] text-ink/80"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Paste anything —{" "}
                <span className="italic text-ink/65">a draft, a list, a stream of consciousness.</span>
              </p>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Day 1: arrive, check into hotel, dinner at…"
                rows={8}
                className="w-full rounded-md border border-ink/15 bg-paper/60 px-4 py-3.5 font-mono text-[12.5px] leading-[1.6] text-ink outline-none transition-elegant placeholder:text-ink/35 focus:border-seal focus:bg-paper"
              />
            </div>
          )}
          {tab === "transcript" && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              className="flex flex-col items-center justify-center rounded-md border border-dashed border-ink/20 bg-paper/40 px-6 py-14 text-center transition-elegant hover:border-seal/60 hover:bg-paper/60"
            >
              <p
                className="text-[19px] leading-[1.2] text-ink/85"
                style={{ fontFamily: "var(--font-display)" }}
              >
                <span className="italic">Drop a transcript</span>{" "}
                <span className="text-ink/55">— or</span>{" "}
                <button
                  onClick={() => fileRef.current?.click()}
                  className="text-seal underline-offset-4 hover:underline"
                >
                  browse
                </button>
              </p>
              <p className="td-eyebrow mt-4 text-ink/40">
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
                <pre className="mt-6 max-h-32 w-full overflow-y-auto rounded-md border border-ink/10 bg-paper/70 p-3 text-left font-mono text-[11px] leading-[1.6] text-ink-soft">
                  {text.slice(0, 600)}
                  {text.length > 600 ? "…" : ""}
                </pre>
              )}
            </div>
          )}
          {tab === "generate" && (
            <GenerateForm
              prompt={genPrompt}
              setPrompt={setGenPrompt}
              destination={genDestination}
              setDestination={setGenDestination}
              duration={genDuration}
              setDuration={setGenDuration}
              startDate={genStartDate}
              setStartDate={setGenStartDate}
              travelers={genTravelers}
              setTravelers={setGenTravelers}
              pace={genPace}
              setPace={setGenPace}
              budget={genBudget}
              setBudget={setGenBudget}
              interests={genInterests}
              interestOptions={INTEREST_OPTIONS}
              onToggleInterest={toggleInterest}
              clarifyQs={clarifyQs}
              clarifyAs={clarifyAs}
              setClarifyAnswer={(i: number, v: string) =>
                setClarifyAs((prev) => prev.map((a, j) => (j === i ? v : a)))
              }
              onSubmitClarifications={submitClarifications}
              parsing={parsing}
            />
          )}
        </div>

        {/* Footer */}
        <div className="mt-10 flex items-center justify-between gap-4 border-t border-ink/10 bg-paper/40 px-5 sm:px-8 md:px-10 py-5">
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
            disabled={!template || parsing}
            className="group inline-flex items-center gap-4 rounded-md border border-seal/40 bg-seal/15 py-3 pl-5 pr-3 text-[11px] font-medium uppercase tracking-[0.4em] text-seal transition-elegant hover:border-seal hover:bg-seal hover:text-paper disabled:opacity-40"
          >
            <span>
              {parsing
                ? tab === "generate"
                  ? "Generating live…"
                  : "Reading & enriching…"
                : tab === "generate"
                ? clarifyQs.length
                  ? "Continue"
                  : "Generate Itinerary"
                : "Review & Mint"}
            </span>
            <span aria-hidden className="inline-flex h-7 w-7 items-center justify-center rounded-sm border border-seal/40 transition-elegant group-hover:border-paper/40">
              →
            </span>
          </button>
        </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Review stage                                                        */
/* ------------------------------------------------------------------ */

function ReviewStage({
  blocks,
  destination,
  onBlocksChange,
  onDestinationChange,
  onBack,
  onConfirm,
  onCancel,
  templateName,
  refCode,
}: {
  blocks: Block[];
  destination: string | null;
  onBlocksChange: (next: Block[]) => void;
  onDestinationChange: (v: string | null) => void;
  onBack: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  templateName: string;
  refCode: string;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const items = blocks.map((_, i) => `b-${i}`);

  function update(i: number, patch: Partial<Block>) {
    const next = blocks.slice();
    next[i] = { ...(next[i] as object), ...(patch as object) } as Block;
    onBlocksChange(next);
  }
  function remove(i: number) {
    onBlocksChange(blocks.filter((_, j) => j !== i));
  }
  function add(kind: Block["kind"]) {
    const fresh: Block =
      kind === "day"
        ? { kind: "day", n: blocks.filter((b) => b.kind === "day").length + 1, label: "New day" }
        : kind === "place"
        ? { kind: "place", name: "New place", category: "other" }
        : kind === "flight"
        ? { kind: "flight", airline: "", from: "", to: "" }
        : kind === "section"
        ? { kind: "section", title: "New section" }
        : kind === "note"
        ? { kind: "note", text: "" }
        : { kind: "paragraph", text: "" };
    onBlocksChange([...blocks, fresh]);
  }
  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = items.indexOf(active.id as string);
    const to = items.indexOf(over.id as string);
    if (from < 0 || to < 0) return;
    onBlocksChange(arrayMove(blocks, from, to));
  }

  const counts = blocks.reduce<Record<string, number>>((acc, b) => {
    acc[b.kind] = (acc[b.kind] ?? 0) + 1;
    return acc;
  }, {});

  // Per-block heuristics: which standardized fields are missing, and whether
  // the block as a whole needs human review. A real confidence score from
  // the parser would replace this — the UI contract is identical.
  function missingFields(b: Block): Set<string> {
    const m = new Set<string>();
    if (b.kind === "place") {
      if (!b.address?.trim()) m.add("address");
      if (!b.phone?.trim()) m.add("phone");
      if (!b.website?.trim()) m.add("website");
      if (!b.reservation?.trim()) m.add("reservation");
      if (!b.note?.trim()) m.add("note");
    } else if (b.kind === "day") {
      if (!b.label?.trim()) m.add("label");
    } else if (b.kind === "flight") {
      if (!b.flightNumber?.trim()) m.add("flightNumber");
      if (!b.departTime?.trim()) m.add("departTime");
      if (!b.date?.trim()) m.add("date");
    }
    return m;
  }
  function needsReview(b: Block): boolean {
    if (b.kind === "place") {
      const noContact = !b.address?.trim() && !b.phone?.trim() && !b.website?.trim();
      const noCategory = !b.category || b.category === "other";
      return noContact || noCategory;
    }
    if (b.kind === "day") return !b.label?.trim();
    if (b.kind === "flight") return !b.flightNumber?.trim() || !b.departTime?.trim();
    if (b.kind === "paragraph") return (b.text?.trim().length ?? 0) < 12;
    return false;
  }

  // Compute nesting depth: place/note/paragraph/section that fall under a
  // preceding day are visually indented under a timeline rail.
  const nesting: boolean[] = [];
  {
    let inDay = false;
    for (const b of blocks) {
      if (b.kind === "day") {
        inDay = true;
        nesting.push(false);
        continue;
      }
      if (b.kind === "hero" || b.kind === "flight" || b.kind === "quote") {
        inDay = false;
        nesting.push(false);
        continue;
      }
      nesting.push(inDay);
    }
  }

  const reviewCount = blocks.filter(needsReview).length;
  const [filter, setFilter] = useState<"all" | "review">("all");

  return (
    <>
      <div className="relative border-b border-ink/10 px-5 sm:px-8 md:px-10 pb-7 pt-9">
        <div className="flex items-start justify-between gap-8">
          <div className="flex flex-col gap-3">
            <div className="td-eyebrow flex items-center gap-3 text-ink/55">
              <span className="h-px w-8 bg-ink/25" />
              TravelDoss<span className="text-ink/30">®</span>
              <span className="text-ink/30">·</span>
              {templateName}
              <span className="text-ink/30">·</span>
              Review
            </div>
            <h2 className="td-headline text-[2.25rem] font-normal leading-[1.05] tracking-[-0.022em] text-ink">
              Refine the <span className="italic text-ink/75">draft</span>
              <span className="text-seal">.</span>
            </h2>
            <p className="max-w-md text-[14px] leading-[1.55] text-ink-soft" style={{ fontFamily: "var(--font-display)" }}>
              Edit, reorder, or remove anything the parser got wrong before it replaces your dossier.
            </p>
          </div>
          <div className="hidden shrink-0 text-right md:block">
            <div className="td-eyebrow text-ink/40">Parsed</div>
            <div className="mt-1.5 font-mono text-[11px] tracking-[0.2em] text-ink/70">
              {blocks.length} blocks
            </div>
            <div className="td-rule mx-auto my-3 w-20" />
            <div className="td-eyebrow text-ink/40">Ref.</div>
            <div className="mt-1 font-mono text-[11px] tracking-[0.25em] text-ink/60">{refCode}</div>
          </div>
        </div>
      </div>

      <div className="px-5 sm:px-8 md:px-10 pt-6">
        <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-ink-soft">
          <span className="td-eyebrow text-ink/45">Summary</span>
          {Object.entries(counts).map(([k, n]) => (
            <span key={k}>
              <span className="font-mono text-ink">{n}</span>{" "}
              <span className="uppercase tracking-[0.2em] text-ink/55">{k}</span>
            </span>
          ))}
        </div>

        {/* Confidence filter */}
        <div className="mb-4 flex items-center gap-1.5">
          <button
            onClick={() => setFilter("all")}
            className={`td-eyebrow rounded-md border px-2.5 py-1.5 transition-elegant ${
              filter === "all"
                ? "border-seal/60 bg-seal/15 text-seal"
                : "border-ink/15 bg-paper/40 text-ink/55 hover:text-ink"
            }`}
          >
            Show all ({blocks.length})
          </button>
          <button
            onClick={() => setFilter("review")}
            disabled={reviewCount === 0}
            className={`td-eyebrow inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 transition-elegant disabled:opacity-40 ${
              filter === "review"
                ? "border-amber-400/60 bg-amber-400/15 text-amber-300"
                : "border-ink/15 bg-paper/40 text-ink/55 hover:text-ink"
            }`}
          >
            <AlertTriangle className="h-3 w-3" /> Needs review ({reviewCount})
          </button>
        </div>

        <label className="td-eyebrow mb-1.5 block text-ink/45">Destination</label>
        <input
          value={destination ?? ""}
          onChange={(e) => onDestinationChange(e.target.value || null)}
          placeholder="e.g. Lisbon"
          className="mb-6 w-full rounded-md border border-ink/15 bg-paper/60 px-3.5 py-2.5 text-[13px] text-ink outline-none focus:border-seal"
        />

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={items} strategy={verticalListSortingStrategy}>
            <ul className="space-y-2">
              {blocks.map((b, i) => {
                const flagged = needsReview(b);
                if (filter === "review" && !flagged) return null;
                return (
                  <ReviewRow
                    key={`b-${i}`}
                    id={`b-${i}`}
                    block={b}
                    nested={nesting[i]}
                    flagged={flagged}
                    missing={missingFields(b)}
                    onChange={(patch) => update(i, patch)}
                    onRemove={() => remove(i)}
                  />
                );
              })}
              {!blocks.length && (
                <li className="rounded-md border border-dashed border-ink/15 px-4 py-8 text-center text-[12px] text-ink/50">
                  Nothing parsed. Go back and try a different source.
                </li>
              )}
            </ul>
          </SortableContext>
        </DndContext>

        <div className="mt-5">
          <p className="td-eyebrow mb-2 text-ink/45">Add block</p>
          <div className="flex flex-wrap gap-1.5">
            {(["paragraph", "day", "place", "flight", "section", "note"] as const).map((k) => (
              <button
                key={k}
                onClick={() => add(k)}
                className="inline-flex items-center gap-1 rounded-md border border-ink/15 bg-paper/40 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.25em] text-ink-soft transition-elegant hover:border-seal hover:text-seal"
              >
                <Plus className="h-3 w-3" /> {k}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between gap-4 border-t border-ink/10 bg-paper/40 px-5 sm:px-8 md:px-10 py-5">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="td-eyebrow inline-flex items-center gap-1.5 text-ink/55 transition-elegant hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to source
          </button>
          <span className="hidden h-3 w-px bg-ink/15 sm:block" />
          <button onClick={onCancel} className="td-eyebrow text-ink/45 transition-elegant hover:text-ink">
            Cancel
          </button>
        </div>
        <button
          onClick={onConfirm}
          className="group inline-flex items-center gap-4 rounded-md border border-seal/40 bg-seal/15 py-3 pl-5 pr-3 text-[11px] font-medium uppercase tracking-[0.4em] text-seal transition-elegant hover:border-seal hover:bg-seal hover:text-paper"
        >
          <span>Replace Dossier</span>
          <span aria-hidden className="inline-flex h-7 w-7 items-center justify-center rounded-sm border border-seal/40 transition-elegant group-hover:border-paper/40">
            →
          </span>
        </button>
      </div>
    </>
  );
}

const fld =
  "w-full rounded border border-ink/15 bg-paper/70 px-2.5 py-1.5 text-[12.5px] text-ink outline-none focus:border-seal placeholder:text-ink/30 transition-elegant";

// Hoverable badge surfaced on `place` blocks whose parser/enricher
// confidence is below 0.85. On hover/focus it explains what was
// auto-filled and prompts the user to inspect the fields below.
function LowConfidenceBadge({
  confidence,
  source,
  fields,
}: {
  confidence: number;
  source?: "model" | "google-places" | "manual";
  fields?: string[];
}) {
  const pct = Math.round(confidence * 100);
  const sourceLabel =
    source === "google-places"
      ? "Google Places"
      : source === "manual"
      ? "Manual entry"
      : "AI model";
  const fieldList = fields && fields.length ? fields.join(", ") : "none";
  return (
    <TooltipProvider delayDuration={120}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`Low confidence enrichment, ${pct} percent. Inspect the enriched fields below.`}
            className="inline-flex items-center gap-1 rounded-sm border border-amber-400/40 bg-amber-400/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.25em] text-amber-300 transition-elegant hover:bg-amber-400/20 focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-400/60"
          >
            <Info className="h-2.5 w-2.5" /> {pct}%
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-left">
          <div className="space-y-1 text-[11px] leading-snug">
            <p className="font-medium">Low confidence ({pct}%)</p>
            <p className="opacity-80">
              Enriched by {sourceLabel}. Inspect the highlighted fields below and edit anything that looks wrong.
            </p>
            <p className="opacity-70">
              <span className="td-eyebrow opacity-70">Auto-filled:</span> {fieldList}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Field wrapper that paints a subtle amber warning tint when the value is
// missing/low-confidence. The actual <input> stays plain so screen readers
// still see normal field semantics.
function Field({
  icon,
  warn,
  children,
}: {
  icon?: React.ReactNode;
  warn?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`relative flex items-center rounded border ${
        warn
          ? "border-amber-400/40 bg-amber-400/10"
          : "border-transparent"
      }`}
    >
      {icon && (
        <span className="pointer-events-none absolute left-2 flex h-full items-center text-ink/40">
          {icon}
        </span>
      )}
      <div className={`flex-1 ${icon ? "[&_input]:pl-7 [&_textarea]:pl-7" : ""}`}>
        {children}
      </div>
      {warn && (
        <AlertTriangle
          aria-hidden
          className="pointer-events-none absolute right-2 h-3 w-3 text-amber-400/80"
        />
      )}
    </div>
  );
}

function ReviewRow({
  id,
  block,
  nested,
  flagged,
  missing,
  onChange,
  onRemove,
}: {
  id: string;
  block: Block;
  nested?: boolean;
  flagged?: boolean;
  missing?: Set<string>;
  onChange: (patch: Partial<Block>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }}
      className={
        nested
          ? "relative ml-6 before:pointer-events-none before:absolute before:-left-3 before:top-0 before:h-[calc(100%+0.5rem)] before:w-px before:bg-ink/15"
          : undefined
      }
    >
      <motion.div
        whileHover={{ y: -1 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        className={`group/card rounded-md bg-paper/70 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_1px_2px_rgba(0,0,0,0.35),0_10px_24px_-18px_rgba(0,0,0,0.6)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_2px_4px_rgba(0,0,0,0.4),0_14px_30px_-16px_rgba(0,0,0,0.7)] ${
          flagged ? "ring-1 ring-amber-400/30" : ""
        }`}
      >
      <div className="mb-2 flex items-center gap-2">
        <button
          {...attributes}
          {...listeners}
          className="inline-flex h-11 w-11 cursor-grab touch-none items-center justify-center rounded-md text-ink/50 hover:bg-seal/10 hover:text-seal active:cursor-grabbing sm:h-9 sm:w-9"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-5 w-5 sm:h-4 sm:w-4" />
        </button>
        <span className="font-mono text-[9px] uppercase tracking-[0.35em] text-seal/80">{block.kind}</span>
        {block.kind === "place" &&
          typeof block.confidence === "number" &&
          block.confidence < 0.85 && (
            <LowConfidenceBadge
              confidence={block.confidence}
              source={block.enrichmentSource}
              fields={block.enrichedFields}
            />
          )}
        {flagged && (
          <span className="inline-flex items-center gap-1 rounded-sm border border-amber-400/40 bg-amber-400/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.25em] text-amber-300">
            <AlertTriangle className="h-2.5 w-2.5" /> Review
          </span>
        )}
        <span className="ml-auto" />
        <button
          onClick={onRemove}
          className="inline-flex h-11 w-11 items-center justify-center rounded-md text-ink/50 hover:bg-red-500/10 hover:text-red-500 sm:h-9 sm:w-9"
          aria-label="Delete block"
        >
          <Trash2 className="h-5 w-5 sm:h-4 sm:w-4" />
        </button>
      </div>
      <BlockFields block={block} onChange={onChange} missing={missing ?? new Set()} />
      </motion.div>
    </li>
  );
}

function BlockFields({
  block,
  onChange,
  missing,
}: {
  block: Block;
  onChange: (patch: Partial<Block>) => void;
  missing: Set<string>;
}) {
  switch (block.kind) {
    case "paragraph":
      return (
        <textarea
          className={fld}
          rows={3}
          value={block.text}
          onChange={(e) => onChange({ text: e.target.value } as Partial<Block>)}
        />
      );
    case "note":
      return (
        <textarea
          className={fld}
          rows={2}
          value={block.text}
          onChange={(e) => onChange({ text: e.target.value } as Partial<Block>)}
        />
      );
    case "section":
      return (
        <input
          className={fld}
          value={block.title}
          onChange={(e) => onChange({ title: e.target.value } as Partial<Block>)}
        />
      );
    case "hero":
      return (
        <div className="space-y-1.5">
          <input className={fld} placeholder="Title" value={block.title} onChange={(e) => onChange({ title: e.target.value } as Partial<Block>)} />
          <input className={fld} placeholder="Subtitle" value={block.subtitle ?? ""} onChange={(e) => onChange({ subtitle: e.target.value } as Partial<Block>)} />
          <input className={fld} placeholder="Eyebrow" value={block.eyebrow ?? ""} onChange={(e) => onChange({ eyebrow: e.target.value } as Partial<Block>)} />
        </div>
      );
    case "day":
      return (
        <div className="space-y-1.5">
          <div className="flex gap-1.5">
            <input
              className={`${fld} w-20`}
              type="number"
              value={block.n}
              onChange={(e) => onChange({ n: Number(e.target.value) } as Partial<Block>)}
            />
            <Field warn={missing.has("label")}>
              <input
                className={fld}
                placeholder="Label (e.g. Bologna)"
                value={block.label}
                onChange={(e) => onChange({ label: e.target.value } as Partial<Block>)}
              />
            </Field>
          </div>
          <textarea
            className={fld}
            rows={2}
            placeholder="Notes"
            value={block.notes ?? ""}
            onChange={(e) => onChange({ notes: e.target.value } as Partial<Block>)}
          />
        </div>
      );
    case "place":
      return (
        <div className="space-y-1.5">
          <div className="flex gap-1.5">
            <input
              className={fld}
              placeholder="Name"
              value={block.name}
              onChange={(e) => onChange({ name: e.target.value } as Partial<Block>)}
            />
            <select
              className={`${fld} w-40`}
              value={block.category ?? "other"}
              onChange={(e) => onChange({ category: e.target.value as never } as Partial<Block>)}
            >
              <option value="transit">Transit</option>
              <option value="restaurant">Restaurant</option>
              <option value="walk">Walk / Hike</option>
              <option value="event">Event</option>
              <option value="accommodation">Accommodation</option>
              <option value="culture">Culture / Museum</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            <Field icon={<MapPin className="h-3 w-3" />} warn={missing.has("address")}>
              <input
                className={fld}
                placeholder="Address"
                value={block.address ?? ""}
                onChange={(e) => onChange({ address: e.target.value } as Partial<Block>)}
              />
            </Field>
            <Field icon={<Phone className="h-3 w-3" />} warn={missing.has("phone")}>
              <input
                className={fld}
                placeholder="Phone"
                value={block.phone ?? ""}
                onChange={(e) => onChange({ phone: e.target.value } as Partial<Block>)}
              />
            </Field>
            <Field icon={<Globe className="h-3 w-3" />} warn={missing.has("website")}>
              <input
                className={fld}
                placeholder="Website"
                value={block.website ?? ""}
                onChange={(e) => onChange({ website: e.target.value } as Partial<Block>)}
              />
            </Field>
            <Field icon={<Ticket className="h-3 w-3" />} warn={missing.has("reservation")}>
              <input
                className={fld}
                placeholder="Reservation / confirmation"
                value={block.reservation ?? ""}
                onChange={(e) => onChange({ reservation: e.target.value } as Partial<Block>)}
              />
            </Field>
          </div>
          <Field icon={<StickyNote className="h-3 w-3" />} warn={missing.has("note")}>
            <input
              className={fld}
              placeholder="Note"
              value={block.note ?? ""}
              onChange={(e) => onChange({ note: e.target.value } as Partial<Block>)}
            />
          </Field>
        </div>
      );
    case "flight":
      return (
        <div className="grid grid-cols-2 gap-1.5">
          <input className={fld} placeholder="Airline" value={block.airline ?? ""} onChange={(e) => onChange({ airline: e.target.value } as Partial<Block>)} />
          <input className={fld} placeholder="Flight #" value={block.flightNumber ?? ""} onChange={(e) => onChange({ flightNumber: e.target.value } as Partial<Block>)} />
          <input className={fld} placeholder="From (IATA)" value={block.from ?? ""} onChange={(e) => onChange({ from: e.target.value } as Partial<Block>)} />
          <input className={fld} placeholder="To (IATA)" value={block.to ?? ""} onChange={(e) => onChange({ to: e.target.value } as Partial<Block>)} />
          <input className={fld} placeholder="Depart" value={block.departTime ?? ""} onChange={(e) => onChange({ departTime: e.target.value } as Partial<Block>)} />
          <input className={fld} placeholder="Arrive" value={block.arriveTime ?? ""} onChange={(e) => onChange({ arriveTime: e.target.value } as Partial<Block>)} />
          <input className={fld} placeholder="Date" value={block.date ?? ""} onChange={(e) => onChange({ date: e.target.value } as Partial<Block>)} />
          <input className={fld} placeholder="Conf #" value={block.confirmation ?? ""} onChange={(e) => onChange({ confirmation: e.target.value } as Partial<Block>)} />
        </div>
      );
    case "quote":
      return (
        <div className="space-y-1.5">
          <textarea className={fld} rows={2} value={block.text} onChange={(e) => onChange({ text: e.target.value } as Partial<Block>)} />
          <input className={fld} placeholder="— attribution" value={block.attribution ?? ""} onChange={(e) => onChange({ attribution: e.target.value } as Partial<Block>)} />
        </div>
      );
  }
}
/* ------------------------------------------------------------------ */
/* Generate form                                                       */
/* ------------------------------------------------------------------ */

function GenerateForm({
  prompt, setPrompt,
  destination, setDestination,
  duration, setDuration,
  startDate, setStartDate,
  travelers, setTravelers,
  pace, setPace,
  budget, setBudget,
  interests, interestOptions, onToggleInterest,
  clarifyQs, clarifyAs, setClarifyAnswer,
  onSubmitClarifications,
  parsing,
}: {
  prompt: string; setPrompt: (v: string) => void;
  destination: string; setDestination: (v: string) => void;
  duration: string; setDuration: (v: string) => void;
  startDate: string; setStartDate: (v: string) => void;
  travelers: string; setTravelers: (v: string) => void;
  pace: "" | "relaxed" | "balanced" | "packed"; setPace: (v: "" | "relaxed" | "balanced" | "packed") => void;
  budget: "" | "shoestring" | "moderate" | "elevated" | "luxury"; setBudget: (v: "" | "shoestring" | "moderate" | "elevated" | "luxury") => void;
  interests: string[]; interestOptions: string[]; onToggleInterest: (t: string) => void;
  clarifyQs: string[]; clarifyAs: string[]; setClarifyAnswer: (i: number, v: string) => void;
  onSubmitClarifications: () => void;
  parsing: boolean;
}) {
  const fieldCls =
    "w-full rounded-md border border-ink/15 bg-paper/60 px-3 py-2.5 text-[13px] text-ink outline-none transition-elegant placeholder:text-ink/35 focus:border-seal focus:bg-paper";

  if (clarifyQs.length) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3 rounded-md border border-seal/30 bg-seal/10 px-4 py-3 text-[12.5px] leading-[1.6] text-ink">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-seal" />
          <p>
            A few details would sharpen this draft. Answer what you can —
            leave any field blank to let us infer.
          </p>
        </div>
        <ul className="flex flex-col gap-3">
          {clarifyQs.map((q, i) => (
            <li key={i} className="flex flex-col gap-1.5">
              <label className="td-eyebrow text-ink/55">Question {i + 1}</label>
              <p
                className="text-[14px] leading-[1.5] text-ink"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {q}
              </p>
              <input
                value={clarifyAs[i] ?? ""}
                onChange={(e) => setClarifyAnswer(i, e.target.value)}
                placeholder="Your answer…"
                className={fieldCls}
                disabled={parsing}
              />
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={onSubmitClarifications}
          disabled={parsing}
          className="self-end text-[11px] uppercase tracking-[0.35em] text-seal underline-offset-4 hover:underline disabled:opacity-40"
        >
          {parsing ? "Drafting…" : "Continue →"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label className="td-eyebrow text-ink/45">Describe your trip</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder='e.g. "Five days in Lisbon and Sintra for two, light on museums, big on seafood, balanced pace."'
          rows={5}
          className="w-full rounded-md border border-ink/15 bg-paper/60 px-4 py-3.5 text-[13.5px] leading-[1.6] text-ink outline-none transition-elegant placeholder:text-ink/35 focus:border-seal focus:bg-paper"
        />
        <p className="text-[11.5px] leading-[1.55] text-ink-soft">
          We'll draft a complete itinerary, then verify each vendor live
          against Google Places for current address, phone, and hours.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Labeled label="Destination">
          <input
            className={fieldCls}
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="Lisbon · Tokyo · Amalfi Coast"
          />
        </Labeled>
        <Labeled label="Duration">
          <input
            className={fieldCls}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="5 days · long weekend · 2 weeks"
          />
        </Labeled>
        <Labeled label="Start date (optional)">
          <input
            className={fieldCls}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            placeholder="Oct 14, 2026"
          />
        </Labeled>
        <Labeled label="Travelers">
          <input
            className={fieldCls}
            value={travelers}
            onChange={(e) => setTravelers(e.target.value)}
            placeholder="2 adults · family of 4 · solo"
          />
        </Labeled>
        <Labeled label="Pace">
          <select
            className={fieldCls}
            value={pace}
            onChange={(e) => setPace(e.target.value as typeof pace)}
          >
            <option value="">Let us decide</option>
            <option value="relaxed">Relaxed</option>
            <option value="balanced">Balanced</option>
            <option value="packed">Packed</option>
          </select>
        </Labeled>
        <Labeled label="Budget">
          <select
            className={fieldCls}
            value={budget}
            onChange={(e) => setBudget(e.target.value as typeof budget)}
          >
            <option value="">Let us decide</option>
            <option value="shoestring">Shoestring</option>
            <option value="moderate">Moderate</option>
            <option value="elevated">Elevated</option>
            <option value="luxury">Luxury</option>
          </select>
        </Labeled>
      </div>

      <div className="flex flex-col gap-2">
        <label className="td-eyebrow text-ink/45">Interests</label>
        <div className="flex flex-wrap gap-1.5">
          {interestOptions.map((tag) => {
            const on = interests.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => onToggleInterest(tag)}
                className={`rounded-full border px-3 py-1.5 text-[11px] uppercase tracking-[0.22em] transition-elegant ${
                  on
                    ? "border-seal bg-seal/20 text-seal"
                    : "border-ink/15 bg-paper/40 text-ink-soft hover:border-seal/40 hover:text-ink"
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="td-eyebrow text-ink/45">{label}</label>
      {children}
    </div>
  );
}
