import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { Suspense, lazy, useEffect, useState } from "react";
import { PUBLISHED_GUIDES } from "@/content/guides";
import { GuideCardGrid } from "@/components/guides/GuideCardGrid";
import "@/components/guides/guides.css";
import { Ribbon } from "@/components/landing/Ribbon";
import { MobileNavBar } from "@/components/mobile/MobileNavBar";
import { SiteFooter } from "@/components/legal/SiteFooter";
import { SITE_URL } from "@/lib/site";
import { trackGuideCardOpen } from "@/lib/analytics";

const GuideGlobe = lazy(() => import("@/components/guides/GuideGlobe"));

const TITLE = "Insider Guides — Trips Worth Copying | TravelDoss";
const DESCRIPTION =
  "Ten destination dossiers researched with the world's best publishers, cut to only what counts. Read one, make it yours, and it becomes your trip.";

export const Route = createFileRoute("/guides/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: `${SITE_URL}/guides` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/guides` }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Insider Guides",
          description: DESCRIPTION,
          url: `${SITE_URL}/guides`,
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: PUBLISHED_GUIDES.length,
            itemListElement: PUBLISHED_GUIDES.map((g, i) => ({
              "@type": "ListItem",
              position: i + 1,
              name: g.title,
              url: `${SITE_URL}/guides/${g.slug}`,
            })),
          },
        }),
      },
    ],
  }),
  component: GuidesIndex,
});

function GuidesIndex() {
  const navigate = useNavigate();
  const [enhance, setEnhance] = useState(false);

  // Progressive enhancement: the globe mounts only after first paint, only
  // when motion is welcome and WebGL exists. The card grid never unmounts.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let ok = false;
    try {
      const c = document.createElement("canvas");
      ok = !!(c.getContext("webgl2") || c.getContext("webgl"));
    } catch {
      ok = false;
    }
    if (!ok) return;
    const id = window.setTimeout(() => setEnhance(true), 120);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div className="tdg min-h-dvh">
      <Ribbon />
      <MobileNavBar />

      <main>
        <section className="tdg-stage">
          {enhance && (
            <ClientOnly fallback={null}>
              <Suspense fallback={null}>
                <GuideGlobe
                  guides={PUBLISHED_GUIDES}
                  onCardOpen={(slug, via) => trackGuideCardOpen(slug, via)}
                  onOpenGuide={(slug) => navigate({ to: "/guides/$slug", params: { slug } })}
                />
              </Suspense>
            </ClientOnly>
          )}

          <div className="tdg-hud">
            <span className="tdg-eyebrow">
              <i />
              New · Insider Guides
            </span>
            <h1 className="tdg-display my-5">
              Trips worth <em>copying.</em>
            </h1>
            <p className="tdg-dek">
              Destination dossiers researched with the world's top publishers, then cut to only what
              counts. Read one. Make it yours. It becomes your trip.
            </p>
          </div>

          <p className="tdg-hint" aria-hidden="true">
            Drag the globe · tap a beacon
          </p>
        </section>

        <section className="mx-auto max-w-[1200px] px-5 py-12 md:px-8 md:py-16 md:pl-[7.5rem]">
          <h2 className="tdg-eyebrow">All Insider Guides</h2>
          <div className="mt-6">
            <GuideCardGrid guides={PUBLISHED_GUIDES} />
          </div>
          <p className="mt-8 max-w-2xl text-sm leading-relaxed text-[color-mix(in_oklab,var(--tdg-sub)_92%,var(--tdg-ink))]">
            Every guide is a real dossier: the same layout your own trip gets.{" "}
            <Link to="/templates" className="underline">
              Browse the templates
            </Link>{" "}
            to start one from scratch.
          </p>
        </section>
      </main>

      <SiteFooter mobileNavClearance />
    </div>
  );
}
