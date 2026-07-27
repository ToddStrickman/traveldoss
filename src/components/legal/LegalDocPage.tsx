import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { LEGAL_DOCS, type LegalDocSlug } from "@/lib/legal/registry";
import { LEGAL_CONTENT } from "@/lib/legal/content";
import { extractToc } from "@/lib/legal/toc";
import { LegalMarkdown } from "./LegalMarkdown";
import { SiteFooter } from "./SiteFooter";

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Shared reading layout for /terms, /privacy and /disclaimer: editorial
 * header, sticky table of contents (left on desktop, collapsible above the
 * text on mobile) with scroll-spy, and comfortable long-form typography.
 */
export function LegalDocPage({ slug }: { slug: LegalDocSlug }) {
  const meta = LEGAL_DOCS[slug];
  const markdown = LEGAL_CONTENT[slug];
  const toc = useMemo(() => extractToc(markdown), [markdown]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const articleRef = useRef<HTMLElement | null>(null);
  const mobileTocRef = useRef<HTMLDetailsElement | null>(null);

  // Deep links (/terms#limitation-of-liability): the ids only exist after
  // hydration-independent first paint, so nudge the browser once on mount.
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    document.getElementById(hash)?.scrollIntoView({ behavior: "auto", block: "start" });
  }, []);

  // Scroll-spy: highlight the section currently in the reading band.
  useEffect(() => {
    const headings = Array.from(articleRef.current?.querySelectorAll("h2[id]") ?? []);
    if (!headings.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveId(entry.target.id);
        }
      },
      { rootMargin: "-15% 0px -75% 0px" },
    );
    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [markdown]);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
  };

  const tocLinks = (onPick?: () => void) => (
    <ul className="space-y-1">
      {toc.map((entry) => {
        const active = entry.id === activeId;
        return (
          <li key={entry.id}>
            <a
              href={`#${entry.id}`}
              aria-current={active ? "true" : undefined}
              onClick={(e) => {
                e.preventDefault();
                scrollTo(entry.id);
                onPick?.();
              }}
              className={`block border-l py-1 pl-4 text-xs leading-snug tracking-wide transition-colors ${
                active
                  ? "border-seal text-seal"
                  : "border-ink/10 text-ink/50 hover:border-ink/30 hover:text-ink"
              }`}
            >
              {entry.title}
            </a>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="relative min-h-dvh overflow-x-clip bg-background text-foreground selection:bg-seal/40">
      <div aria-hidden className="td-grain fixed inset-0 z-0" />
      <div aria-hidden className="td-vignette fixed inset-0 z-0" />

      <a
        href="#legal-content"
        className="sr-only z-50 rounded-none bg-seal px-4 py-2 text-paper focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to document
      </a>

      <header className="relative z-10 mx-auto flex max-w-[1600px] items-center justify-between border-b border-ink/10 px-5 py-5 md:px-8 md:py-6">
        <Link
          to="/"
          className="inline-flex items-center gap-3 td-eyebrow text-ink/70 transition-colors hover:text-seal"
        >
          <span className="h-px w-6 bg-ink/30" />
          TravelDoss<span className="text-ink/30">®</span>
        </Link>
        <Link to="/" className="td-eyebrow text-ink/45 transition-colors hover:text-seal">
          ← Back
        </Link>
      </header>

      <main className="relative z-10 mx-auto max-w-[1400px] px-5 pb-24 pt-12 md:px-8 md:pt-20">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <span className="td-eyebrow text-ink/50">Legal</span>
          <span className="td-eyebrow text-ink/35">
            Version {meta.version} · Effective {formatDate(meta.effectiveAt)}
          </span>
        </div>

        <div className="mt-10 grid grid-cols-12 gap-8 md:gap-12">
          <aside className="hidden md:col-span-4 md:block lg:col-span-3">
            <nav aria-label="Table of contents" className="sticky top-10">
              <span className="td-eyebrow text-ink/40">Contents</span>
              <div className="mt-5 max-h-[calc(100dvh-9rem)] overflow-y-auto pr-2">
                {tocLinks()}
              </div>
            </nav>
          </aside>

          <div className="col-span-12 md:col-span-8 lg:col-span-9">
            <details ref={mobileTocRef} className="group mb-8 border border-ink/10 md:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 td-eyebrow text-ink/60 [&::-webkit-details-marker]:hidden">
                Contents
                <span
                  aria-hidden
                  className="text-ink/40 transition-transform group-open:rotate-180"
                >
                  ▾
                </span>
              </summary>
              <nav aria-label="Table of contents" className="border-t border-ink/10 px-4 py-4">
                {tocLinks(() => mobileTocRef.current?.removeAttribute("open"))}
              </nav>
            </details>

            <article
              id="legal-content"
              ref={articleRef}
              tabIndex={-1}
              className="max-w-[780px] text-[15px] text-ink/75 outline-none"
            >
              <LegalMarkdown markdown={markdown} />
            </article>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
