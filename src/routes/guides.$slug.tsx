import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Compass, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getGuide, siblingGuides, type GuideDef } from "@/content/guides";
import { getSkin, FALLBACK_SKIN } from "@/lib/skins/registry";
import type { TripView } from "@/lib/skins/types";
import { cloneGuide } from "@/lib/guides.functions";
import { savePendingGuideClone, takePendingGuideClone } from "@/lib/guide-pending";
import { supabase } from "@/integrations/supabase/client";
import { Ribbon } from "@/components/landing/Ribbon";
import { MobileNavBar } from "@/components/mobile/MobileNavBar";
import { SiteFooter } from "@/components/legal/SiteFooter";
import { GuideCardGrid } from "@/components/guides/GuideCardGrid";
import "@/components/guides/guides.css";
import { SITE_URL } from "@/lib/site";
import { trackGuideClone, trackGuideCta, trackGuideFaqOpen, trackGuideView } from "@/lib/analytics";

export const Route = createFileRoute("/guides/$slug")({
  loader: ({ params }) => {
    const guide = getGuide(params.slug);
    if (!guide) throw notFound();
    return { slug: guide.slug };
  },
  head: ({ loaderData }) => {
    const guide = loaderData ? getGuide(loaderData.slug) : undefined;
    if (!guide) {
      return {
        meta: [{ title: "Guide unavailable — TravelDoss" }, { name: "robots", content: "noindex" }],
      };
    }
    const url = `${SITE_URL}/guides/${guide.slug}`;
    const image = `${SITE_URL}/og/guides/${guide.slug}.png`;
    return {
      meta: [
        { title: guide.seoTitle },
        { name: "description", content: guide.metaDescription },
        { property: "og:type", content: "article" },
        { property: "og:title", content: guide.seoTitle },
        { property: "og:description", content: guide.metaDescription },
        { property: "og:url", content: url },
        { property: "og:image", content: image },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: guide.seoTitle },
        { name: "twitter:description", content: guide.metaDescription },
        { name: "twitter:image", content: image },
        ...(guide.published ? [] : [{ name: "robots", content: "noindex,follow" }]),
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: guide.published ? [{ type: "application/ld+json", children: jsonLd(guide) }] : [],
    };
  },
  component: GuidePage,
  notFoundComponent: GuideNotFound,
});

/** Article + FAQPage + BreadcrumbList + TouristTrip, one @graph document. */
function jsonLd(guide: GuideDef): string {
  const url = `${SITE_URL}/guides/${guide.slug}`;
  const publisher = { "@type": "Organization", name: "TravelDoss", url: SITE_URL };
  const dayBlocks = guide.blocks.filter((b) => b.kind === "day");
  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: guide.title,
        description: guide.metaDescription,
        datePublished: guide.publishedAt,
        dateModified: guide.updatedAt,
        author: publisher,
        publisher,
        image: `${SITE_URL}/og/guides/${guide.slug}.png`,
        mainEntityOfPage: { "@type": "WebPage", "@id": url },
      },
      {
        "@type": "FAQPage",
        mainEntity: guide.faq.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Insider Guides", item: `${SITE_URL}/guides` },
          { "@type": "ListItem", position: 3, name: guide.destination, item: url },
        ],
      },
      {
        "@type": "TouristTrip",
        name: guide.title,
        description: guide.metaDescription,
        touristType: "leisure",
        itinerary: {
          "@type": "ItemList",
          numberOfItems: dayBlocks.length,
          itemListElement: dayBlocks.map((b, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: b.kind === "day" ? b.label : "",
          })),
        },
      },
    ],
  });
}

function GuideNotFound() {
  return (
    <div className="tdg grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <h1 className="tdg-display mx-auto">Guide not found.</h1>
        <p className="tdg-dek mx-auto mt-4">That dossier isn't on the shelf.</p>
        <Link to="/guides" className="tdg-eyebrow mt-8 inline-flex">
          All Insider Guides
        </Link>
      </div>
    </div>
  );
}

function GuidePage() {
  const { slug } = Route.useLoaderData();
  const guide = getGuide(slug)!;
  const navigate = useNavigate();
  const runClone = useServerFn(cloneGuide);
  const [cloning, setCloning] = useState(false);

  useEffect(() => {
    trackGuideView(guide.slug, guide.published);
  }, [guide.slug, guide.published]);

  async function makeThisYours() {
    trackGuideCta(guide.slug, "make_this_yours");
    if (cloning) return;
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      savePendingGuideClone(guide.slug);
      trackGuideClone(guide.slug, "login_required");
      navigate({ to: "/login", search: { redirect: `/guides/${guide.slug}` } });
      return;
    }
    setCloning(true);
    trackGuideClone(guide.slug, "started");
    try {
      const res = await runClone({ data: { slug: guide.slug } });
      trackGuideClone(guide.slug, "completed");
      navigate({ to: "/t/$slug", params: { slug: res.slug } });
    } catch (err) {
      console.error("[guide] clone failed", err);
      trackGuideClone(guide.slug, "failed");
      toast.error("Couldn't copy this guide", { description: "Please try again in a moment." });
      setCloning(false);
    }
  }

  // Replay a clone that was interrupted by the login wall.
  useEffect(() => {
    const pending = takePendingGuideClone();
    if (pending !== guide.slug) return;
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) void makeThisYours();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guide.slug]);

  const skin = getSkin(guide.skinId) ?? FALLBACK_SKIN;
  const trip: TripView = {
    destination: guide.destination,
    subtitle: guide.dek,
    slug: `guides/${guide.slug}`,
    days: guide.blocks.filter((b) => b.kind === "day").length || undefined,
  };
  const siblings = siblingGuides(guide.slug, 3);

  return (
    <div className="tdg min-h-dvh">
      <Ribbon />
      <MobileNavBar />

      <main>
        {/* Above the fold on mobile: identity, H1, and the primary CTA. */}
        <header className="mx-auto max-w-[1100px] px-5 pb-8 pt-8 md:px-8 md:pl-[7.5rem] md:pt-14">
          <nav aria-label="Breadcrumb" className="mb-5">
            <Link to="/guides" className="tdg-eyebrow">
              <Compass className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
              All Insider Guides
            </Link>
          </nav>
          <p className="tdg-eyebrow">
            <i style={{ background: guide.accent }} />
            Insider Guide {guide.no}
          </p>
          <h1 className="tdg-display mt-4">{guide.title}</h1>
          <p className="tdg-dek mt-4">{guide.dek}</p>
          <p className="mt-5 flex flex-wrap gap-2">
            <span className="tdg-chip">{guide.days}</span>
            <span className="tdg-chip">{guide.season}</span>
          </p>

          {guide.published ? (
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => void makeThisYours()}
                disabled={cloning}
                className="tdg-btn max-w-xs justify-center disabled:opacity-70"
              >
                {cloning ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Copying…
                  </>
                ) : (
                  <>Make this yours ↗</>
                )}
              </button>
              <Link
                to="/templates"
                onClick={() => trackGuideCta(guide.slug, "start_from_scratch")}
                className="tdg-chip inline-flex min-h-[44px] items-center justify-center px-5"
              >
                Start from scratch
              </Link>
            </div>
          ) : (
            <p className="tdg-dek mt-7">
              This dossier is being written. The published guides are on the{" "}
              <Link to="/guides" className="underline">
                Insider Guides index
              </Link>
              .
            </p>
          )}
        </header>

        {guide.published && (
          <div className="bg-paper text-ink">
            <skin.Render trip={trip} blocks={guide.blocks} view="vertical" />
          </div>
        )}

        {guide.published && (
          <section
            aria-labelledby="guide-faq"
            className="mx-auto max-w-[1100px] px-5 py-14 md:px-8 md:pl-[7.5rem]"
          >
            <h2 id="guide-faq" className="tdg-display !text-3xl">
              Questions, answered
            </h2>
            <div className="mt-6 divide-y divide-[var(--tdg-line)] border-y border-[var(--tdg-line)]">
              {guide.faq.map((f) => (
                <details
                  key={f.q}
                  className="group py-4"
                  onToggle={(e) => {
                    if ((e.currentTarget as HTMLDetailsElement).open)
                      trackGuideFaqOpen(guide.slug, f.q);
                  }}
                >
                  <summary className="tap flex min-h-[44px] cursor-pointer items-center text-base font-semibold">
                    <h3 className="text-base font-semibold">{f.q}</h3>
                  </summary>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[color-mix(in_oklab,var(--tdg-sub)_92%,var(--tdg-ink))]">
                    {f.a}
                  </p>
                </details>
              ))}
            </div>
          </section>
        )}

        <section
          aria-labelledby="more-guides"
          className="mx-auto max-w-[1100px] px-5 pb-14 md:px-8 md:pl-[7.5rem]"
        >
          <h2 id="more-guides" className="tdg-display !text-3xl">
            More Insider Guides
          </h2>
          <div className="mt-6">
            <GuideCardGrid guides={siblings} />
          </div>
        </section>

        {guide.sources && (
          <section
            aria-labelledby="guide-sources"
            className="mx-auto max-w-[1100px] px-5 pb-16 md:px-8 md:pl-[7.5rem]"
          >
            <h2 id="guide-sources" className="tdg-eyebrow">
              Sources
            </h2>
            <p className="mt-3 max-w-3xl text-xs leading-relaxed text-[color-mix(in_oklab,var(--tdg-sub)_92%,var(--tdg-ink))]">
              {guide.sources}
            </p>
          </section>
        )}
      </main>

      <SiteFooter mobileNavClearance />
    </div>
  );
}
