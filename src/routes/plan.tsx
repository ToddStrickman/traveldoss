import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { SKINS, getSkin, FALLBACK_SKIN } from "@/lib/skins/registry";
import type { Block, SkinView, TripView } from "@/lib/skins/types";
import { adaptItinerary } from "@/lib/itinerary/adapt";
import { parseDropIn, type IngestSource } from "@/lib/itinerary/parse";
import {
  type TripBrief, DEFAULT_BRIEF,
  DESTINATION_TYPES, SEASONS, TRAVELERS, BUDGETS, PACES, MOBILITY, INTERESTS,
} from "@/lib/itinerary/framework";
import { GenerationLoader } from "@/components/GenerationLoader";

export const Route = createFileRoute("/plan")({
  component: PlanPage,
  head: () => ({
    meta: [
      { title: "Plan a trip — TravelDoss" },
      { name: "description", content: "Build a day-by-day itinerary from a short brief, or drop in raw text, an AI output, or a call transcript — previewed live in any skin." },
    ],
  }),
});

const TABS: { key: IngestSource | "brief" | "email"; label: string }[] = [
  { key: "brief", label: "From a brief" },
  { key: "text", label: "Paste text" },
  { key: "ai", label: "AI output" },
  { key: "transcript", label: "Transcript" },
  { key: "email", label: "Email" },
];

function PlanPage() {
  const [brief, setBrief] = useState<TripBrief>(DEFAULT_BRIEF);
  const [blocks, setBlocks] = useState<Block[]>(() => adaptItinerary(DEFAULT_BRIEF));
  const [skinId, setSkinId] = useState<string>(SKINS[0]?.meta.id ?? "epictetus");
  const [view, setView] = useState<SkinView>("vertical");
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("brief");
  const [text, setText] = useState("");
  const [loadingSteps, setLoadingSteps] = useState<string[] | null>(null);
  const [pendingBlocks, setPendingBlocks] = useState<Block[] | null>(null);

  const set = <K extends keyof TripBrief>(k: K, v: TripBrief[K]) => setBrief((b) => ({ ...b, [k]: v }));
  const toggleInterest = (i: (typeof INTERESTS)[number]) =>
    setBrief((b) => ({ ...b, interests: b.interests.includes(i) ? b.interests.filter((x) => x !== i) : [...b.interests, i] }));

  const skin = getSkin(skinId) ?? FALLBACK_SKIN;
  const previewTrip: TripView = {
    destination: brief.destination?.trim() || "Your trip",
    subtitle: blocks.find((b) => b.kind === "hero")?.kind === "hero"
      ? (blocks[0] as Extract<Block, { kind: "hero" }>).subtitle ?? null
      : null,
    slug: "preview",
  };

  function runWith(steps: string[], next: Block[]) {
    setPendingBlocks(next);
    setLoadingSteps(steps);
  }
  function build() {
    runWith(
      ["Reading your brief…", "Researching your destination…", "Designing your doc…"],
      adaptItinerary(brief),
    );
  }
  function ingest() {
    if (tab === "brief" || tab === "email") return;
    const parsed = parseDropIn(text, tab);
    if (!parsed.length) return;
    const sourceLabel =
      tab === "ai" ? "Reading your AI output…" : tab === "transcript" ? "Reading your transcript…" : "Reading your notes…";
    runWith([sourceLabel, "Structuring days and places…", "Designing your doc…"], parsed);
  }

  return (
    <div className="grid min-h-dvh grid-cols-1 bg-background text-ink lg:grid-cols-[380px_1fr]">
      <GenerationLoader
        open={loadingSteps !== null}
        steps={loadingSteps ?? []}
        onDone={() => {
          if (pendingBlocks) setBlocks(pendingBlocks);
          setPendingBlocks(null);
          setLoadingSteps(null);
        }}
      />
      {/* ---- left: controls ---- */}
      <aside className="border-b border-ink/10 p-6 lg:sticky lg:top-0 lg:h-dvh lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <Link to="/" className="text-[10px] uppercase tracking-[0.4em] text-ink-soft hover:text-seal">← TravelDoss</Link>
        <h1 className="mt-4 text-3xl" style={{ fontFamily: "var(--font-display)" }}>Plan a trip</h1>
        <p className="mt-1 text-sm text-ink-soft">A universal framework that rewrites itself for where you’re going — or drop in what you already have.</p>

        <div className="mt-5 flex flex-wrap gap-1 rounded-full border border-ink/10 p-1 text-[11px]">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`rounded-full px-3 py-1.5 font-semibold uppercase tracking-[0.1em] ${tab === t.key ? "bg-ink text-background" : "text-ink-soft"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === "brief" && (
          <div className="mt-5 space-y-3">
            <Field label="Destination (optional)">
              <input value={brief.destination ?? ""} onChange={(e) => set("destination", e.target.value)} placeholder="Lisbon, Hokkaido, Patagonia…" className={inputCls} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type"><Select value={brief.destinationType} opts={DESTINATION_TYPES} onChange={(v) => set("destinationType", v as TripBrief["destinationType"])} /></Field>
              <Field label="Days"><input type="number" min={1} max={30} value={brief.durationDays} onChange={(e) => set("durationDays", Math.max(1, Math.min(30, +e.target.value || 1)))} className={inputCls} /></Field>
              <Field label="Season"><Select value={brief.season} opts={SEASONS} onChange={(v) => set("season", v as TripBrief["season"])} /></Field>
              <Field label="Pace"><Select value={brief.pace} opts={PACES} onChange={(v) => set("pace", v as TripBrief["pace"])} /></Field>
              <Field label="Travelers"><Select value={brief.travelers} opts={TRAVELERS} onChange={(v) => set("travelers", v as TripBrief["travelers"])} /></Field>
              <Field label="Budget"><Select value={brief.budget} opts={BUDGETS} onChange={(v) => set("budget", v as TripBrief["budget"])} /></Field>
            </div>
            <Field label="Mobility"><Select value={brief.mobility} opts={MOBILITY} onChange={(v) => set("mobility", v as TripBrief["mobility"])} /></Field>
            <Field label="Interests">
              <div className="flex flex-wrap gap-1.5">
                {INTERESTS.map((i) => (
                  <button key={i} onClick={() => toggleInterest(i)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] capitalize ${brief.interests.includes(i) ? "border-seal bg-seal/15 text-ink" : "border-ink/15 text-ink-soft"}`}>{i}</button>
                ))}
              </div>
            </Field>
            <button onClick={build} className="mt-1 w-full rounded-full bg-ink py-3 text-sm font-semibold text-background hover:bg-seal">
              {brief.destination?.trim() ? `Build my ${brief.destination.trim()} itinerary` : "Show the framework"}
            </button>
          </div>
        )}

        {(tab === "text" || tab === "ai" || tab === "transcript") && (
          <div className="mt-5 space-y-3">
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={10} placeholder={PLACEHOLDER[tab]} className={`${inputCls} font-mono text-[13px]`} />
            <button onClick={ingest} disabled={text.trim().length < 8} className="w-full rounded-full bg-ink py-3 text-sm font-semibold text-background hover:bg-seal disabled:opacity-40">Build it</button>
            <p className="text-[11px] text-ink-soft">Parsed on your device. Connect an AI key later for richer structuring — the button stays the same.</p>
          </div>
        )}

        {tab === "email" && (
          <div className="mt-5 space-y-3 text-sm text-ink-soft">
            <p>Connect your inbox (read-only) and we’ll find the trip for you:</p>
            <div className="rounded-xl border border-ink/15 p-3"><b className="text-ink">Last month</b><br />Bookings, reservations, confirmations</div>
            <div className="rounded-xl border border-ink/15 p-3"><b className="text-ink">Last 6 months</b><br />Anything about your destination</div>
            <a href="/api/public/google/start" className="block rounded-full bg-ink py-3 text-center text-sm font-semibold text-background hover:bg-seal">Connect email</a>
          </div>
        )}

        <Field label="Skin" className="mt-6">
          <Select value={skinId} opts={SKINS.map((s) => s.meta.id)} labels={Object.fromEntries(SKINS.map((s) => [s.meta.id, s.meta.codename]))} onChange={setSkinId} />
        </Field>
      </aside>

      {/* ---- right: live preview ---- */}
      <section className="relative overflow-y-auto lg:h-dvh">
        <div className="sticky top-0 z-20 flex items-center justify-center gap-1 border-b border-ink/10 bg-background/85 p-3 backdrop-blur-sm">
          {(["vertical", "horizontal", "grid"] as SkinView[]).map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={`rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] ${view === v ? "bg-seal text-background" : "text-ink-soft"}`}>{v}</button>
          ))}
        </div>
        {skin.tokens.fontUrl && <link rel="stylesheet" href={skin.tokens.fontUrl} />}
        <skin.Render trip={previewTrip} blocks={blocks} view={view} />
      </section>
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-ink/15 bg-background px-3 py-2 text-sm text-ink outline-none focus:border-seal";
const PLACEHOLDER: Record<IngestSource, string> = {
  text: "Paste notes…\nDay 1: arrive, hotel, dinner at…",
  ai: "Paste the itinerary your AI assistant gave you.",
  transcript: "Paste a call transcript — we’ll pull out the trip and skip the chit-chat.",
};

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft">{label}</span>
      {children}
    </label>
  );
}
function Select({ value, opts, labels, onChange }: { value: string; opts: readonly string[]; labels?: Record<string, string>; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
      {opts.map((o) => <option key={o} value={o}>{labels?.[o] ?? o}</option>)}
    </select>
  );
}
