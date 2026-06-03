import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { ArrowLeft, Search, X } from "lucide-react";
import { SKINS, type SkinModule } from "@/lib/skins/registry";
import { pickTemplate } from "@/lib/templates.functions";
import { supabase } from "@/integrations/supabase/client";

function TemplatesSkeleton() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>\")",
        }}
      />

      <header className="relative z-10 mx-auto flex max-w-[1600px] items-center justify-between border-b border-ink/10 px-6 py-6 md:px-12">
        <div className="h-3 w-32 animate-pulse rounded bg-ink/10" />
        <div className="h-3 w-24 animate-pulse rounded bg-ink/10" />
      </header>

      <main className="relative z-10 mx-auto max-w-[1600px] px-6 pb-24 md:px-12">
        <div className="mt-8 h-3 w-16 animate-pulse rounded bg-ink/10" />

        <div className="mt-16 h-[14vw] w-3/4 animate-pulse rounded bg-ink/10 md:h-[7vw]" />
        <div className="mt-6 h-4 w-full max-w-xl animate-pulse rounded bg-ink/10" />
        <div className="mt-2 h-4 w-48 animate-pulse rounded bg-ink/10" />
        <div className="mt-3 h-3 w-32 animate-pulse rounded bg-ink/10" />

        <div className="mt-10 flex flex-col gap-6">
          <div className="h-12 w-full max-w-md animate-pulse rounded bg-ink/10" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-7 w-20 animate-pulse rounded-full bg-ink/10" />
            ))}
          </div>
          <div className="h-3 w-24 animate-pulse rounded bg-ink/10" />
        </div>

        <div className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex h-full flex-col border border-ink/10 bg-surface"
            >
              <div className="h-[420px] w-full animate-pulse bg-ink/5" />
              <div className="flex flex-1 flex-col p-7 md:p-8">
                <div className="h-2 w-16 animate-pulse rounded bg-ink/10" />
                <div className="mt-3 h-10 w-3/4 animate-pulse rounded bg-ink/10" />
                <div className="mt-3 h-4 w-full animate-pulse rounded bg-ink/10" />
                <div className="mt-4 flex flex-wrap gap-2">
                  <div className="h-5 w-14 animate-pulse rounded-full bg-ink/10" />
                  <div className="h-5 w-16 animate-pulse rounded-full bg-ink/10" />
                </div>
                <div className="mt-auto h-10 w-full animate-pulse rounded bg-ink/10" style={{ marginTop: 28 }} />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

export const Route = createFileRoute("/templates")({
  component: TemplatesPage,
  pendingComponent: TemplatesSkeleton,
  head: () => ({
    meta: [
      { title: "Templates — TravelDoss" },
      {
        name: "description",
        content:
          "Pick a TravelDoss template. Each is a distinct editorial design for your trip's dossier — one URL, one dollar, one month.",
      },
      {
        property: "og:title",
        content: "TravelDoss Templates — Editorial Designs for Your Trip",
      },
      {
        property: "og:description",
        content:
          "Eight editorial templates for your trip dossier. One dollar, one URL, one month — composed like a magazine.",
      },
      { property: "og:url", content: "https://traveldoss.lovable.app/templates" },
    ],
    links: [{ rel: "canonical", href: "https://traveldoss.lovable.app/templates" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "TravelDoss Templates",
          description:
            "Gallery of editorial dossier templates for TravelDoss trips.",
          url: "https://traveldoss.lovable.app/templates",
        }),
      },
    ],
  }),
});

function SkinPreview({ skin }: { skin: SkinModule }) {
  const { Render, previewFixture, tokens } = skin;
  return (
    <div
      className="relative h-[420px] w-full overflow-hidden border"
      style={{ borderColor: "rgba(255,255,255,0.08)", background: tokens.bg }}
    >
      {/* Scale the real skin render to fit the tile so users see actual design */}
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{
          width: "1400px",
          transform: "scale(0.32)",
          transformOrigin: "top left",
          pointerEvents: "none",
        }}
      >
        {skin.tokens.fontUrl && (
          <link rel="stylesheet" href={skin.tokens.fontUrl} />
        )}
        <Render trip={previewFixture.trip} blocks={previewFixture.blocks} />
      </div>
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, transparent 55%, rgba(0,0,0,0.55) 100%)",
        }}
      />
    </div>
  );
}

function SkinCard({
  skin,
  onPick,
  picking,
}: {
  skin: SkinModule;
  onPick: (id: string) => void;
  picking: boolean;
}) {
  return (
    <article
      id={skin.meta.id}
      className="group flex h-full flex-col border border-ink/10 bg-paper transition-colors duration-500 hover:border-seal/50"
    >
      <SkinPreview skin={skin} />

      <div className="flex flex-1 flex-col p-7 md:p-8">
        <div className="flex items-center gap-2 text-[9px] font-medium uppercase tracking-[0.45em] text-ink/40">
          <span
            className="h-1 w-1 rounded-full"
            style={{ background: skin.tokens.accent }}
          />
          Template
        </div>
        <h2
          className="mt-3 text-4xl font-normal leading-[1.05] tracking-tight text-ink md:text-5xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {skin.meta.codename}
        </h2>
        <p
          className="mt-3 text-sm italic leading-relaxed text-ink-soft md:text-base"
          style={{ fontFamily: "var(--font-display)" }}
        >
          "{skin.meta.personality}"
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {skin.meta.tags.map((tag) => (
            <span
              key={tag}
              className="inline-block rounded-full border border-ink/10 px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.2em] text-ink/50"
            >
              {tag}
            </span>
          ))}
        </div>

        <button
          onClick={() => onPick(skin.meta.id)}
          disabled={picking}
          className="mt-auto inline-flex items-center justify-between gap-4 border-y border-ink/20 pt-7 pb-7 text-[10px] font-medium uppercase tracking-[0.4em] text-ink transition-colors duration-500 hover:border-seal hover:text-seal disabled:cursor-wait disabled:opacity-50"
          style={{ marginTop: 28 }}
        >
          <span>{picking ? "Minting your dossier…" : "Use this template · $1"}</span>
          <span className="text-ink/40 group-hover:text-seal">→</span>
        </button>
      </div>
    </article>
  );
}

function TemplatesPage() {
  const [picking, setPicking] = useState<string | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const pickFn = useServerFn(pickTemplate);
  const navigate = useNavigate();

  const allTags = useMemo(
    () => Array.from(new Set(SKINS.flatMap((s) => s.meta.tags))).sort(),
    []
  );

  const filteredSkins = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SKINS.filter((skin) => {
      const matchesSearch =
        !q ||
        skin.meta.codename.toLowerCase().includes(q) ||
        skin.meta.personality.toLowerCase().includes(q) ||
        skin.meta.tags.some((t) => t.toLowerCase().includes(q));
      const matchesTag = !activeTag || skin.meta.tags.includes(activeTag);
      return matchesSearch && matchesTag;
    });
  }, [query, activeTag]);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setAuthed(!!data.user);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handlePick = async (id: string) => {
    if (authed === false) {
      navigate({ to: "/login" });
      return;
    }
    setPicking(id);
    try {
      const result = await pickFn({ data: { templateId: id } });
      navigate({ to: "/t/$slug", params: { slug: result.slug } });
    } catch (e) {
      console.error(e);
      alert("Could not mint your dossier. Please try again.");
    } finally {
      setPicking(null);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground selection:bg-seal/40">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>\")",
        }}
      />

      <header className="relative z-10 mx-auto flex max-w-[1600px] items-center justify-between border-b border-ink/10 px-6 py-6 md:px-12">
        <Link
          to="/"
          className="inline-flex items-center gap-3 text-[10px] font-medium uppercase tracking-[0.4em] text-ink/60 transition-colors hover:text-seal"
        >
          TravelDoss<span className="text-ink/30">®</span>
        </Link>
        <span className="inline-flex items-center gap-3 text-[10px] font-medium uppercase tracking-[0.4em] text-ink/60">
          <span className="h-px w-6 bg-ink/30" />
          The Templates
        </span>
      </header>

      <main className="relative z-10 mx-auto max-w-[1600px] px-6 pb-24 md:px-12">
        <button
          onClick={() => window.history.back()}
          className="mt-8 inline-flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.4em] text-ink/60 transition-colors hover:text-seal"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mt-16 text-[14vw] font-normal leading-[0.95] tracking-[-0.03em] md:text-[7vw]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          <span className="text-ink">Pick your </span>
          <span className="italic text-ink/85">template<span className="text-seal">.</span></span>
        </motion.h1>
        <p className="mt-6 max-w-xl text-sm leading-relaxed text-ink-soft md:text-base">
          Eight named designs for your trip's quiet studio. One dollar mints a
          private URL for a month — mapped routes, day-by-day plans, reservations,
          and editorial notes composed into one shareable dossier.
        </p>
        <p className="mt-3 max-w-xl text-[10px] uppercase tracking-[0.4em] text-ink/40">
          {SKINS.length} of 8 live · more landing this week
        </p>

        {/* Search + Filter */}
        <div className="mt-10 flex flex-col gap-6">
          {/* Search bar */}
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/30" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, mood, or style…"
              className="w-full rounded-none border border-ink/10 bg-surface py-3 pl-10 pr-10 text-sm text-ink placeholder:text-ink/30 focus:border-seal/50 focus:outline-none"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/30 hover:text-ink"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Tag chips */}
          <div className="flex flex-wrap items-center gap-2">
            {allTags.map((tag) => {
              const active = activeTag === tag;
              return (
                <button
                  key={tag}
                  onClick={() => setActiveTag(active ? null : tag)}
                  className={`rounded-full border px-3.5 py-1.5 text-[10px] font-medium uppercase tracking-[0.25em] transition-colors duration-300 ${
                    active
                      ? "border-seal bg-seal/10 text-seal"
                      : "border-ink/10 text-ink/50 hover:border-ink/30 hover:text-ink"
                  }`}
                >
                  {tag}
                </button>
              );
            })}
            {(query || activeTag) && (
              <button
                onClick={() => {
                  setQuery("");
                  setActiveTag(null);
                }}
                className="ml-2 text-[10px] font-medium uppercase tracking-[0.25em] text-ink/40 underline-offset-4 transition-colors hover:text-seal"
              >
                Clear
              </button>
            )}
          </div>

          {/* Result count */}
          <p className="text-[10px] uppercase tracking-[0.4em] text-ink/40">
            {filteredSkins.length} template{filteredSkins.length !== 1 ? "s" : ""}
            {activeTag ? ` · ${activeTag}` : ""}
            {query ? ` · “${query.trim()}”` : ""}
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {filteredSkins.map((skin) => (
            <SkinCard
              key={skin.meta.id}
              skin={skin}
              onPick={handlePick}
              picking={picking === skin.meta.id}
            />
          ))}
          {filteredSkins.length === 0 && (
            <div className="col-span-full py-20 text-center">
              <p className="text-sm text-ink-soft">
                No templates match your search.
              </p>
              <button
                onClick={() => {
                  setQuery("");
                  setActiveTag(null);
                }}
                className="mt-4 text-[10px] font-medium uppercase tracking-[0.4em] text-seal underline-offset-4 hover:underline"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}