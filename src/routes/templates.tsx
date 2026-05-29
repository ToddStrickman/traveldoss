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
      className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.05] p-6 shadow-[0_12px_48px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl transition-all duration-500 hover:border-white/20 hover:bg-white/[0.08] md:p-8"
    >
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-40 blur-3xl transition-opacity duration-500 group-hover:opacity-70"
           style={{ background: template.accent }} />

      <div className="relative mb-4 flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.35em] text-ink/50">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 backdrop-blur-xl">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: template.accent }} />
          Google Doc
        </span>
        <span>{template.days} days</span>
      </div>
      <h3
        className="relative text-3xl font-semibold leading-tight tracking-tight text-ink md:text-4xl"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {template.title}
      </h3>
      <p className="relative mt-3 text-sm text-ink/65" style={{ fontFamily: "var(--font-body)" }}>
        {template.subtitle}
      </p>
      <p className="relative mt-2 text-[10px] uppercase tracking-[0.3em] text-ink/40">
        {template.tone}
      </p>

      {/* Doc preview */}
      <div className="relative mt-6 flex-1 space-y-3 rounded-2xl border border-white/10 bg-black/20 p-5 backdrop-blur-xl">
        {template.doc.slice(0, 6).map((b, i) =>
          b.kind === "heading" ? (
            <div
              key={i}
              className="font-semibold tracking-tight text-ink"
              style={{ fontFamily: "var(--font-display)", fontSize: b.level === 1 ? 18 : 14 }}
            >
              {b.text}
            </div>
          ) : (
            <div key={i} className="space-y-1.5">
              {[100, 92, 78].map((w, j) => (
                <div key={j} className="h-[3px] rounded-full bg-white/15" style={{ width: `${w}%` }} />
              ))}
            </div>
          ),
        )}
      </div>

      {/* Crawl chips */}
      <div className="relative mt-6">
        <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.35em] text-seal">
          We'll crawl
        </div>
        <div className="flex flex-wrap gap-2">
          {template.crawl.map((c) => {
            const Icon = ICON[c];
            return (
              <span
                key={c}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-ink/70 backdrop-blur-xl"
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
        className="relative mt-6 inline-flex items-center justify-center gap-3 rounded-full border border-white/15 bg-gradient-to-r from-seal to-seal-soft px-6 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-paper shadow-[0_8px_24px_rgba(80,120,255,0.4)] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_12px_32px_rgba(80,120,255,0.55)] disabled:cursor-wait disabled:opacity-60"
      >
        {picking ? "Opening Doc…" : "Use This Template"}
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
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground selection:bg-seal/40">
      {/* Ambient orbs */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -left-32 top-0 h-[520px] w-[520px] rounded-full opacity-50 blur-[120px]"
             style={{ background: "radial-gradient(circle, oklch(0.6 0.2 250 / 0.6), transparent 70%)" }} />
        <div className="absolute -right-20 bottom-0 h-[460px] w-[460px] rounded-full opacity-40 blur-[120px]"
             style={{ background: "radial-gradient(circle, oklch(0.65 0.2 285 / 0.55), transparent 70%)" }} />
      </div>
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 opacity-[0.08]"
           style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)", backgroundSize: "64px 64px" }} />

      <header className="relative z-10 mx-auto flex max-w-[1600px] items-center justify-between px-6 py-6 md:px-12">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-[10px] font-medium uppercase tracking-[0.3em] text-ink/70 backdrop-blur-xl transition-colors hover:text-ink"
        >
          ← TravelDoss
        </Link>
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-[10px] font-medium uppercase tracking-[0.3em] text-ink/70 backdrop-blur-xl">
          <span className="h-1.5 w-1.5 rounded-full bg-seal" />
          Pick a Template
        </span>
      </header>

      <main className="relative z-10 mx-auto max-w-[1600px] px-6 pb-24 md:px-12">
        <h1
          className="text-[12vw] font-semibold leading-[0.9] tracking-[-0.04em] md:text-[6vw]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          <span className="bg-gradient-to-br from-white via-white to-white/40 bg-clip-text text-transparent">The </span>
          <span className="bg-gradient-to-br from-seal via-seal-soft to-seal bg-clip-text text-transparent">Library</span>
        </h1>
        <p className="mt-4 max-w-2xl text-base text-ink/65 md:text-lg">
          Ten ways to begin. Pick one — we'll open a fresh Google Doc seeded
          with the structure and tell you what we'll crawl from your Gmail,
          Drive, and Calendar to fill in the details.
        </p>

        {/* Carousel */}
        <div className="mt-12">
          <div className="mb-6 flex items-center justify-between">
            <div className="text-[10px] font-medium uppercase tracking-[0.4em] text-ink/50">
              {String(page + 1).padStart(2, "0")} / {String(maxPage + 1).padStart(2, "0")}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                aria-label="Previous"
                className="rounded-full border border-white/15 bg-white/[0.05] p-3 text-ink backdrop-blur-xl transition-all hover:scale-105 hover:bg-white/[0.1] disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(maxPage, p + 1))}
                disabled={page === maxPage}
                aria-label="Next"
                className="rounded-full border border-white/15 bg-white/[0.05] p-3 text-ink backdrop-blur-xl transition-all hover:scale-105 hover:bg-white/[0.1] disabled:opacity-30"
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
                className={`h-1.5 rounded-full transition-all ${
                  i === page ? "w-10 bg-gradient-to-r from-seal to-seal-soft" : "w-1.5 bg-white/20 hover:bg-white/40"
                }`}
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}