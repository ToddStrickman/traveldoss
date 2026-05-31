import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { motion } from "motion/react";
import { getDossierBySlug } from "@/lib/templates.functions";
import type { DocBlock } from "@/lib/templates";

type DossierContent = {
  blocks?: DocBlock[];
  accent?: string;
  days?: number;
  crawl?: string[];
};

export const Route = createFileRoute("/t/$slug")({
  loader: async ({ params }) => {
    const { trip } = await getDossierBySlug({ data: { slug: params.slug } });
    if (!trip) throw notFound();
    return { trip };
  },
  head: ({ loaderData }) => {
    const trip = loaderData?.trip;
    if (!trip) return { meta: [{ title: "Dossier — TravelDoss" }] };
    const title = `${trip.destination} — A TravelDoss Dossier`;
    const description =
      trip.subtitle ?? `A travel dossier for ${trip.destination}.`;
    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ];
    if (trip.hero_image_url) {
      meta.push({ property: "og:image", content: trip.hero_image_url });
      meta.push({ name: "twitter:image", content: trip.hero_image_url });
    }
    return { meta };
  },
  component: DossierPage,
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
      <div>
        <p className="text-[10px] uppercase tracking-[0.4em] text-ink/45">404</p>
        <h1
          className="mt-4 text-5xl text-ink"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Dossier not found
        </h1>
        <p className="mt-3 text-sm text-ink-soft">
          This trip URL doesn't exist, or it has been made private.
        </p>
        <Link
          to="/"
          className="mt-8 inline-block border-y border-ink/20 py-3 text-[10px] uppercase tracking-[0.4em] text-ink hover:border-seal hover:text-seal"
        >
          ← TravelDoss
        </Link>
      </div>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
      <div>
        <h1 className="text-2xl text-ink">Couldn't load this dossier</h1>
        <p className="mt-2 text-sm text-ink-soft">{error.message}</p>
      </div>
    </div>
  ),
});

function DossierPage() {
  const { trip } = Route.useLoaderData();
  const content = (trip.content ?? {}) as DossierContent;
  const blocks = content.blocks ?? [];
  const accent = content.accent ?? "#8c2b1f";

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground selection:bg-seal/40">
      {/* Film grain */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>\")",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.55) 100%)",
        }}
      />

      {/* Header */}
      <header className="relative z-10 mx-auto flex max-w-[1400px] items-center justify-between border-b border-ink/10 px-6 py-6 md:px-12">
        <Link
          to="/"
          className="inline-flex items-center gap-3 text-[10px] font-medium uppercase tracking-[0.4em] text-ink/60 transition-colors hover:text-seal"
        >
          TravelDoss<span className="text-ink/30">®</span>
        </Link>
        <div className="hidden items-center gap-3 text-[10px] uppercase tracking-[0.4em] text-ink/45 md:flex">
          <span className="h-px w-6 bg-ink/30" />
          Dossier · /t/{trip.slug}
        </div>
      </header>

      {/* Cover */}
      <section className="relative z-10 mx-auto max-w-[1400px] px-6 pt-16 md:px-12 md:pt-24">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="flex items-center gap-3 text-[10px] font-medium uppercase tracking-[0.45em] text-ink/55"
        >
          <span className="h-1 w-1 rounded-full" style={{ background: accent }} />
          The {trip.template_id ? "TravelDoss" : "Custom"} Dossier
          {content.days ? <span className="text-ink/30">· {String(content.days).padStart(2, "0")} days</span> : null}
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          className="mt-10 text-[14vw] font-normal leading-[0.95] tracking-[-0.03em] md:text-[8vw]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          <span className="text-ink">{trip.destination}</span>
          <span className="text-seal">.</span>
        </motion.h1>

        {trip.subtitle && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.3 }}
            className="mt-8 max-w-xl text-base italic leading-relaxed text-ink/80 md:text-lg"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {trip.subtitle}
          </motion.p>
        )}

        {trip.tone && (
          <p className="mt-6 text-[10px] uppercase tracking-[0.45em] text-ink/40">
            {trip.tone}
          </p>
        )}

        {trip.hero_image_url && (
          <div className="mt-12 overflow-hidden border border-ink/10">
            <img
              src={trip.hero_image_url}
              alt={trip.destination}
              className="aspect-[16/9] w-full object-cover"
            />
          </div>
        )}
      </section>

      {/* Meta strip */}
      <section className="relative z-10 mx-auto mt-20 max-w-[1400px] px-6 md:px-12">
        <div className="grid grid-cols-2 gap-px border border-ink/10 bg-ink/10 md:grid-cols-4">
          <MetaCell label="Dates" value={
            trip.start_date && trip.end_date
              ? `${trip.start_date} → ${trip.end_date}`
              : "To be set"
          } />
          <MetaCell label="Status" value={trip.status} />
          <MetaCell label="Visibility" value={trip.visibility} />
          <MetaCell label="Share" value={`/t/${trip.slug}`} mono />
        </div>
      </section>

      {/* Body */}
      <main className="relative z-10 mx-auto mt-24 max-w-[860px] px-6 pb-32 md:px-12">
        <div className="mb-10 flex items-center gap-4 text-[9px] font-medium uppercase tracking-[0.45em] text-ink/40">
          <div className="h-px w-10 bg-ink/15" />
          The Itinerary
          <div className="h-px w-10 bg-ink/15" />
        </div>

        <div className="space-y-10">
          {blocks.length === 0 && (
            <p className="text-sm italic text-ink-soft">
              Your dossier is being prepared.
            </p>
          )}
          {blocks.map((b, i) =>
            b.kind === "heading" ? (
              <h2
                key={i}
                className={
                  b.level === 1
                    ? "border-b border-ink/10 pb-4 text-4xl tracking-tight text-ink md:text-5xl"
                    : b.level === 2
                      ? "mt-12 text-2xl tracking-tight text-ink md:text-3xl"
                      : "text-lg tracking-tight text-ink"
                }
                style={{ fontFamily: "var(--font-display)" }}
              >
                {b.text}
              </h2>
            ) : (
              <p
                key={i}
                className="text-base leading-relaxed text-ink/85 md:text-lg"
                style={{ fontFamily: "var(--font-body)" }}
              >
                {b.text}
              </p>
            ),
          )}
        </div>

        {content.crawl && content.crawl.length > 0 && (
          <div className="mt-20 border-t border-ink/10 pt-10">
            <div className="mb-4 text-[9px] uppercase tracking-[0.45em] text-seal">
              Sources to weave in
            </div>
            <div className="flex flex-wrap gap-2">
              {content.crawl.map((c) => (
                <span
                  key={c}
                  className="border border-ink/15 px-3 py-1.5 text-[10px] uppercase tracking-[0.3em] text-ink/70"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-ink/10">
        <div className="mx-auto flex max-w-[1400px] flex-col items-center gap-3 px-6 py-10 text-center md:px-12">
          <Link
            to="/"
            className="text-[10px] uppercase tracking-[0.45em] text-ink/45 transition-colors hover:text-seal"
          >
            Prepared with TravelDoss<span className="text-ink/25">®</span>
          </Link>
          <p className="max-w-md text-[10px] uppercase tracking-[0.3em] text-ink/30">
            The art of arriving well.
          </p>
        </div>
      </footer>
    </div>
  );
}

function MetaCell({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="bg-background px-5 py-5">
      <div className="text-[9px] uppercase tracking-[0.45em] text-ink/40">{label}</div>
      <div
        className={`mt-2 text-sm text-ink ${mono ? "font-mono text-xs" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}