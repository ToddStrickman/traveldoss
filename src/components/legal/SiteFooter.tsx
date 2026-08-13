import { Link } from "@tanstack/react-router";
import { PUBLISHED_GUIDES } from "@/content/guides";

/**
 * Quiet site colophon: hairline rule, brand mark, and the legal links.
 * Styled entirely with existing idioms (td-eyebrow, ink hairlines, seal
 * hover) so it reads as if it had always been part of the page.
 */
export function SiteFooter({ mobileNavClearance = false }: { mobileNavClearance?: boolean }) {
  return (
    <footer className="relative z-10 border-t border-ink/10">
      <nav
        aria-label="Insider Guides"
        className="mx-auto max-w-[1600px] border-b border-ink/10 px-5 py-8 md:px-8"
      >
        <h2 className="td-eyebrow text-ink/40">Insider Guides</h2>
        <ul role="list" className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-5">
          {PUBLISHED_GUIDES.map((g) => (
            <li key={g.slug}>
              <Link
                to="/guides/$slug"
                params={{ slug: g.slug }}
                className="tap inline-flex min-h-[24px] items-center text-[13px] text-ink/55 transition-colors hover:text-seal"
              >
                {g.destination}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-5 py-8 md:flex-row md:items-center md:justify-between md:px-8">
        <span className="td-eyebrow text-ink/40">
          TravelDoss<span className="text-ink/25">®</span> · © {new Date().getFullYear()}
        </span>
        <nav aria-label="Legal" className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <Link to="/guides" className="td-eyebrow text-ink/45 transition-colors hover:text-seal">
            Insider Guides
          </Link>
          <Link to="/terms" className="td-eyebrow text-ink/45 transition-colors hover:text-seal">
            Terms of Service
          </Link>
          <Link to="/privacy" className="td-eyebrow text-ink/45 transition-colors hover:text-seal">
            Privacy Policy
          </Link>
          <Link
            to="/disclaimer"
            className="td-eyebrow text-ink/45 transition-colors hover:text-seal"
          >
            Disclaimer
          </Link>
        </nav>
      </div>
      {/* Clearance for the fixed mobile nav bar on pages that show it. */}
      {mobileNavClearance && <div aria-hidden className="h-16 md:hidden" />}
    </footer>
  );
}
