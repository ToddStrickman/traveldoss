import { Link } from "@tanstack/react-router";
import type { GuideDef } from "@/content/guides";
import { trackGuideCardOpen } from "@/lib/analytics";

/**
 * The server-rendered guide index: a semantic list of every guide with a real
 * link, heading and dek. This is the SEO surface and the no-WebGL /
 * reduced-motion experience — the globe only ever sits on top of it.
 */
export function GuideCardGrid({ guides }: { guides: GuideDef[] }) {
  return (
    <ul role="list" className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {guides.map((g) => (
        <li key={g.slug}>
          <Link
            to="/guides/$slug"
            params={{ slug: g.slug }}
            className="tdg-card h-full"
            onClick={() => trackGuideCardOpen(g.slug, "grid")}
          >
            <span className="tdg-eyebrow">
              <i style={{ background: g.accent }} />
              Insider Guide {g.no}
            </span>
            <h2 className="mt-3">{g.destination}</h2>
            <p>{g.dek}</p>
            <span className="mt-4 flex flex-wrap gap-2">
              {g.chips.map((c) => (
                <span key={c} className="tdg-chip">
                  {c}
                </span>
              ))}
              {!g.published && <span className="tdg-chip">Content landing soon</span>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
