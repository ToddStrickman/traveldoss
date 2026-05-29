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
          "Pick a TravelDoss template. We open it as a fresh Google Doc and pin every place on a routed map.",
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
      className="relative flex h-full flex-col border border-ink/25 bg-[oklch(0.97_0.012_85)] p-6 shadow-[10px_10px_0_rgba(26,26,26,0.14)] md:p-8"
    >
      <div
        className="absolute left-0 top-0 h-full w-1.5"
        style={{ background: template.accent }}
        aria-hidden
      />
      <div className="mb-4 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.4em] text-ink/50"
           style={{ fontFamily: "var(--font-sans)" }}>
        <span style={{ color: template.accent }}>Google Doc</span>
        <span>{template.days} days</span>
      </div>
      <h3
        className="text-3xl leading-tight text-ink md:text-4xl"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {template.title.toUpperCase()}
      </h3>
      <p className="mt-3 text-sm text-ink/70" style={{ fontFamily: "var(--font-body)" }}>
        {template.subtitle}
      </p>
      <p className="mt-1 text-[10px] uppercase tracking-[0.3em] text-ink/40"
         style={{ fontFamily: "var(--font-sans)" }}>
        {template.tone}
      </p>

      {/* Doc preview */}
      <div className="mt-6 flex-1 space-y-3 border border-ink/15 bg-paper/60 p-5">
        {template.doc.slice(0, 6).map((b, i) =>
          b.kind === "heading" ? (
            <div
              key={i}
              className="text-sm font-bold tracking-tight text-ink"
              style={{ fontFamily: "var(--font-display)", fontSize: b.level === 1 ? 18 : 14 }}
            >
              {b.text}
            </div>
          ) : (
            <div key={i} className="space-y-1.5">
              {[100, 92, 78].map((w, j) => (
                <div key={j} className="h-[3px] rounded-full bg-ink/15" style={{ width: `${w}%` }} />
              ))}
            </div>
          ),
        )}
      </div>

      {/* Crawl chips */}
      <div className="mt-6">
        <div
          className="mb-2 text-[10px] font-bold uppercase tracking-[0.35em] text-seal"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          We'll crawl
        </div>
        <div className="flex flex-wrap gap-2">
          {template.crawl.map((c) => {
            const Icon = ICON[c];
            return (
              <span
                key={c}
                className="inline-flex items-center gap-1.5 border border-ink/20 bg-paper/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-ink/70"
                style={{ fontFamily: "var(--font-sans)" }}
              >
                <Icon className="h-3 w-3" strokeWidth={2} />
                {c}
              </span>
            );
          })}
        </div>
      </div>

      <button
        onClick={() => onPick(template.id)}
        disabled={picking}
        className="group/btn relative mt-6 inline-flex items-center justify-center gap-3 bg-ink px-6 py-3 text-base tracking-[0.15em] text-paper transition-colors hover:bg-seal disabled:cursor-wait disabled:opacity-60"
        style={{ fontFamily: "var(--font-display)" }}
      >
        <span className="h-1.5 w-1.5 rotate-45 bg-seal transition-colors group-hover/btn:bg-paper" />
        {picking ? "OPENING DOC…" : "USE THIS TEMPLATE"}
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
      if (result.needsGoogle) {
        window.location.href = result.authUrl;
        return;
      }
      window.open(result.docUrl, "_blank", "noopener,noreferrer");
      navigate({ to: "/app" });
    } catch (e) {
      console.error(e);
      alert("Could not create the doc. Please try again.");
    } finally {
      setPicking(null);
    }
  };

  return (
    <div className="relative min-h-screen bg-background text-foreground selection:bg-seal selection:text-paper">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[1] opacity-[0.35] mix-blend-multiply"
        style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/natural-paper.png')" }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[1]"
        style={{ boxShadow: "inset 0 0 220px rgba(0,0,0,0.28)" }}
      />

      <header className="relative z-10 mx-auto flex max-w-[1600px] items-center justify-between px-6 py-6 md:px-12">
        <Link
          to="/"
          className="text-[10px] font-bold uppercase tracking-[0.4em] text-ink transition-colors hover:text-seal"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          ← TravelDoss
        </Link>
        <span
          className="text-[10px] font-bold uppercase tracking-[0.4em] text-seal"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          Chapter II — Pick a Template
        </span>
      </header>

      <main className="relative z-10 mx-auto max-w-[1600px] px-6 pb-24 md:px-12">
        <h1
          className="text-[14vw] leading-[0.85] tracking-tight text-ink mix-blend-multiply md:text-[7vw]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          THE LIBRARY
        </h1>
        <p className="mt-4 max-w-2xl text-base text-ink/75 md:text-lg">
          Ten ways to begin. Pick one — we'll open a fresh Google Doc seeded
          with the structure and tell you what we'll crawl from your Gmail,
          Drive, and Calendar to fill in the details.
        </p>

        {/* Carousel */}
        <div className="mt-12">
          <div className="mb-6 flex items-center justify-between">
            <div
              className="text-[10px] font-bold uppercase tracking-[0.4em] text-ink/50"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              {String(page + 1).padStart(2, "0")} / {String(maxPage + 1).padStart(2, "0")}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                aria-label="Previous"
                className="border border-ink/30 p-3 text-ink transition-colors hover:bg-ink hover:text-paper disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ink"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(maxPage, p + 1))}
                disabled={page === maxPage}
                aria-label="Next"
                className="border border-ink/30 p-3 text-ink transition-colors hover:bg-ink hover:text-paper disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ink"
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
          <div className="mt-10 flex justify-center gap-2">
            {Array.from({ length: maxPage + 1 }).map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                aria-label={`Page ${i + 1}`}
                className={`h-2 transition-all ${
                  i === page ? "w-10 bg-seal" : "w-2 bg-ink/30 hover:bg-ink/60"
                }`}
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}