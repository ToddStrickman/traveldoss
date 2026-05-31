import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronLeft, ChevronRight, FileText, Mail, MapPin, Calendar, Image as ImageIcon, Users } from "lucide-react";
import { TEMPLATES, type CrawlSource } from "@/lib/templates";
import { pickTemplate } from "@/lib/templates.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/templates")({
  component: TemplatesPage,
  head: () => ({
    meta: [
      { title: "Templates — TravelDoss" },
      {
        name: "description",
        content:
          "Pick a TravelDoss template. Get a private, shareable dossier at a unique URL — beautiful enough to send.",
      },
    ],
  }),
});

const ICON: Record<CrawlSource, typeof Mail> = {
  Gmail: Mail,
  Drive: FileText,
  Maps: MapPin,
  Calendar: Calendar,
  Photos: ImageIcon,
  Contacts: Users,
};

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return mobile;
}

function TemplateCard({
  template,
  onPick,
  picking,
}: {
  template: (typeof TEMPLATES)[number];
  onPick: (id: string) => void;
  picking: boolean;
}) {
  return (
    <article
      id={template.id}
      className="group relative flex h-full flex-col overflow-hidden border border-ink/10 bg-paper p-7 transition-all duration-500 hover:border-seal/50 md:p-9"
    >
      <div aria-hidden className="pointer-events-none absolute left-0 top-0 h-px w-0 transition-all duration-700 group-hover:w-full"
           style={{ background: template.accent }} />

      <div className="relative mb-6 flex items-center justify-between text-[9px] font-medium uppercase tracking-[0.45em] text-ink/45">
        <span className="inline-flex items-center gap-2">
          <span className="h-1 w-1 rounded-full" style={{ background: template.accent }} />
          TravelDoss Dossier
        </span>
        <span>{String(template.days).padStart(2, "0")} Days</span>
      </div>
      <h3
        className="relative text-4xl font-normal leading-[1.05] tracking-tight text-ink md:text-5xl"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {template.title}
      </h3>
      <p className="relative mt-4 text-sm leading-relaxed text-ink-soft" style={{ fontFamily: "var(--font-body)" }}>
        {template.subtitle}
      </p>
      <p className="relative mt-3 text-[9px] uppercase tracking-[0.45em] text-ink/35">
        {template.tone}
      </p>

      {/* Doc preview */}
      <div className="relative mt-7 flex-1 space-y-3 border-t border-ink/10 pt-5">
        {template.doc.slice(0, 6).map((b, i) =>
          b.kind === "heading" ? (
            <div
              key={i}
              className="font-normal tracking-tight text-ink"
              style={{ fontFamily: "var(--font-display)", fontSize: b.level === 1 ? 18 : 14 }}
            >
              {b.text}
            </div>
          ) : (
            <div key={i} className="space-y-1.5">
              {[100, 92, 78].map((w, j) => (
                <div key={j} className="h-px bg-ink/12" style={{ width: `${w}%` }} />
              ))}
            </div>
          ),
        )}
      </div>

      {/* Crawl chips */}
      <div className="relative mt-7">
        <div className="mb-3 text-[9px] font-medium uppercase tracking-[0.45em] text-seal">
          We'll crawl
        </div>
        <div className="flex flex-wrap gap-2">
          {template.crawl.map((c) => {
            const Icon = ICON[c];
            return (
              <span
                key={c}
                className="inline-flex items-center gap-1.5 border border-ink/15 px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.3em] text-ink/70"
              >
                <Icon className="h-3 w-3" strokeWidth={1.5} />
                {c}
              </span>
            );
          })}
        </div>
      </div>

      <button
        onClick={() => onPick(template.id)}
        disabled={picking}
        className="group/btn relative mt-7 inline-flex items-center justify-between gap-4 border-y border-ink/20 py-4 text-[10px] font-medium uppercase tracking-[0.4em] text-ink transition-colors duration-500 hover:border-seal hover:text-seal disabled:cursor-wait disabled:opacity-50"
      >
        <span>{picking ? "Preparing dossier…" : "Begin Dossier"}</span>
        <span className="inline-flex h-7 w-7 items-center justify-center border border-ink/20 transition-all duration-500 group-hover/btn:border-seal group-hover/btn:bg-seal group-hover/btn:text-paper">
          <ChevronRight className="h-3 w-3" />
        </span>
      </button>
    </article>
  );
}

function TemplatesPage() {
  const isMobile = useIsMobile();
  const pageSize = isMobile ? 1 : 3;
  const [page, setPage] = useState(0);
  const [picking, setPicking] = useState<string | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const pickFn = useServerFn(pickTemplate);
  const navigate = useNavigate();

  const maxPage = Math.max(0, Math.ceil(TEMPLATES.length / pageSize) - 1);

  // Honor #hash → jump to slide containing it
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (!hash) return;
    const idx = TEMPLATES.findIndex((t) => t.id === hash);
    if (idx >= 0) setPage(Math.floor(idx / pageSize));
  }, [pageSize]);

  // Cheap auth check
  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setAuthed(!!data.user);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const visible = TEMPLATES.slice(page * pageSize, page * pageSize + pageSize);

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
      alert("Could not create your dossier. Please try again.");
    } finally {
      setPicking(null);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground selection:bg-seal/40">
      {/* Ambient orbs */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 opacity-[0.05] mix-blend-overlay"
           style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>\")" }} />

      <header className="relative z-10 mx-auto flex max-w-[1600px] items-center justify-between border-b border-ink/10 px-6 py-6 md:px-12">
        <Link
          to="/"
          className="inline-flex items-center gap-3 text-[10px] font-medium uppercase tracking-[0.4em] text-ink/60 transition-colors hover:text-seal"
        >
          ← TravelDoss<span className="text-ink/30">®</span>
        </Link>
        <span className="inline-flex items-center gap-3 text-[10px] font-medium uppercase tracking-[0.4em] text-ink/60">
          <span className="h-px w-6 bg-ink/30" />
          The Library
        </span>
      </header>

      <main className="relative z-10 mx-auto max-w-[1600px] px-6 pb-24 md:px-12">
        <h1
          className="mt-16 text-[14vw] font-normal leading-[0.95] tracking-[-0.03em] md:text-[7vw]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          <span className="text-ink">Ten ways </span>
          <span className="italic text-ink/85">to begin<span className="text-seal">.</span></span>
        </h1>
        <p className="mt-6 max-w-xl text-sm leading-relaxed text-ink-soft md:text-base">
          Pick one — we'll mint a private dossier at a unique URL,
          seeded with the structure. Share the link like a wedding
          site; we'll fill it in as your trip takes shape.
        </p>

        {/* Carousel */}
        <div className="mt-16">
          <div className="mb-8 flex items-center justify-between border-t border-ink/10 pt-6">
            <div className="text-[10px] font-medium uppercase tracking-[0.45em] text-ink/50">
              {String(page + 1).padStart(2, "0")} / {String(maxPage + 1).padStart(2, "0")}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                aria-label="Previous"
                className="border border-ink/15 p-3 text-ink transition-colors hover:border-seal hover:text-seal disabled:opacity-25"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(maxPage, p + 1))}
                disabled={page === maxPage}
                aria-label="Next"
                className="border border-ink/15 p-3 text-ink transition-colors hover:border-seal hover:text-seal disabled:opacity-25"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={page}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="grid grid-cols-1 gap-6 md:grid-cols-3"
            >
              {visible.map((t) => (
                <TemplateCard
                  key={t.id}
                  template={t}
                  onPick={handlePick}
                  picking={picking === t.id}
                />
              ))}
            </motion.div>
          </AnimatePresence>

          {/* Dot pager */}
          <div className="mt-12 flex justify-center gap-2">
            {Array.from({ length: maxPage + 1 }).map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                aria-label={`Page ${i + 1}`}
                className={`h-px transition-all ${
                  i === page ? "w-12 bg-seal" : "w-6 bg-ink/20 hover:bg-ink/40"
                }`}
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}