import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link } from "@tanstack/react-router";
import { headingSlug } from "@/lib/legal/toc";

/**
 * Markdown renderer for legal documents.
 *
 * Security: react-markdown compiles markdown straight to React elements and
 * ignores raw HTML by default (no rehype-raw here — do not add it), so the
 * pipeline cannot emit script tags, event handlers, or injected markup.
 * External links additionally get rel="noopener noreferrer".
 */

// Plain text of a hast node — used to derive stable heading ids.
interface HastLike {
  type?: string;
  value?: string;
  children?: HastLike[];
}
function hastText(node: HastLike | undefined): string {
  if (!node) return "";
  if (node.type === "text") return node.value ?? "";
  return (node.children ?? []).map(hastText).join("");
}

export function LegalMarkdown({ markdown }: { markdown: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h1 className="td-headline text-4xl text-ink md:text-5xl">
            {children}
            <span className="text-seal">.</span>
          </h1>
        ),
        h2: ({ node, children }) => (
          <h2
            id={headingSlug(hastText(node as HastLike))}
            className="mt-14 mb-5 scroll-mt-28 font-display text-2xl tracking-tight text-ink md:text-[1.7rem]"
          >
            {children}
          </h2>
        ),
        h3: ({ node, children }) => (
          <h3
            id={headingSlug(hastText(node as HastLike))}
            className="mt-10 mb-4 scroll-mt-28 font-display text-xl text-ink"
          >
            {children}
          </h3>
        ),
        p: ({ children }) => <p className="my-6 leading-[1.7]">{children}</p>,
        ul: ({ children }) => (
          <ul className="my-6 list-disc space-y-2 pl-5 leading-[1.7] marker:text-seal/60">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="my-6 list-decimal space-y-2 pl-5 leading-[1.7] marker:text-seal/60">
            {children}
          </ol>
        ),
        blockquote: ({ children }) => (
          <blockquote className="my-6 border-l-2 border-seal/50 pl-5 text-ink/60 [&_p]:my-3">
            {children}
          </blockquote>
        ),
        a: ({ href, children }) => {
          const url = href ?? "";
          if (url.startsWith("/")) {
            // Same-app links (e.g. /privacy referenced from the Terms).
            return (
              <Link
                to={url}
                className="text-seal underline decoration-seal/40 underline-offset-4 transition-colors hover:text-seal-soft"
              >
                {children}
              </Link>
            );
          }
          const external = /^https?:/i.test(url);
          return (
            <a
              href={url}
              {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="text-seal underline decoration-seal/40 underline-offset-4 transition-colors hover:text-seal-soft"
            >
              {children}
            </a>
          );
        },
        strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
        code: ({ children }) => (
          <code className="rounded-sm bg-ink/10 px-1.5 py-0.5 font-mono text-[0.85em] text-ink/80">
            {children}
          </code>
        ),
        hr: () => <div aria-hidden className="td-rule my-10" />,
        table: ({ children }) => (
          <div className="my-6 overflow-x-auto">
            <table className="w-full border-collapse text-sm">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border-b border-ink/20 px-3 py-2 text-left font-semibold text-ink">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border-b border-ink/10 px-3 py-2 align-top">{children}</td>
        ),
      }}
    >
      {markdown}
    </ReactMarkdown>
  );
}
