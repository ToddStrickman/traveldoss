import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getDossierBySlug } from "@/lib/templates.functions";
import { FALLBACK_SKIN, getSkin } from "@/lib/skins/registry";
import type { Block, TripView } from "@/lib/skins/types";

type DossierContent = {
  blocks?: Block[];
  skin?: string;
};

export const Route = createFileRoute("/t/$slug")({
  loader: async ({ params }) => {
    const { trip, expired } = await getDossierBySlug({ data: { slug: params.slug } });
    if (!trip) throw notFound();
    return { trip, expired: !!expired };
  },
  head: ({ loaderData }) => {
    const trip = loaderData?.trip;
    if (!trip) return { meta: [{ title: "Dossier — TravelDoss" }] };
    const title = `${trip.destination} — A TravelDoss Dossier`;
    const description =
      trip.subtitle ?? `A travel dossier for ${trip.destination}.`;
    const url = `https://traveldoss.lovable.app/t/${trip.slug}`;
    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "article" },
      { property: "og:url", content: url },
      { name: "twitter:card", content: "summary_large_image" },
    ];
    if (trip.hero_image_url) {
      meta.push({ property: "og:image", content: trip.hero_image_url });
      meta.push({ name: "twitter:image", content: trip.hero_image_url });
    }
    const ldImage = trip.hero_image_url ? { image: trip.hero_image_url } : {};
    return {
      meta,
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: trip.destination,
            description,
            url,
            ...ldImage,
          }),
        },
      ],
    };
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
  errorComponent: () => (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
      <div>
        <h1 className="text-2xl text-ink">Couldn't load this dossier</h1>
        <p className="mt-2 text-sm text-ink-soft">Please try again later.</p>
      </div>
    </div>
  ),
});

function DossierPage() {
  const { trip, expired } = Route.useLoaderData();

  if (expired) return <ExpiredDossier slug={trip.slug} destination={trip.destination} />;

  const content = (trip.content ?? {}) as DossierContent;
  const blocks: Block[] = content.blocks ?? [];
  const skin = getSkin(trip.template_id ?? "") ?? FALLBACK_SKIN;

  const view: TripView = {
    destination: trip.destination,
    subtitle: trip.subtitle,
    slug: trip.slug,
    start_date: trip.start_date,
    end_date: trip.end_date,
    hero_image_url: trip.hero_image_url,
  };

  return (
    <>
      {skin.tokens.fontUrl && <link rel="stylesheet" href={skin.tokens.fontUrl} />}
      <skin.Render trip={view} blocks={blocks} />
      <Link
        to="/"
        className="fixed left-4 top-4 z-50 inline-flex items-center gap-2 border border-black/15 bg-white/85 px-3 py-2 text-[10px] font-medium uppercase tracking-[0.3em] text-black backdrop-blur-sm transition-colors hover:border-black hover:bg-white"
        aria-label="Back to TravelDoss"
      >
        ← TravelDoss
      </Link>
    </>
  );
}

function ExpiredDossier({ slug, destination }: { slug: string; destination: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
      <div className="max-w-md">
        <p className="text-[10px] uppercase tracking-[0.4em] text-ink/45">Expired</p>
        <h1
          className="mt-4 text-4xl text-ink md:text-5xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {destination} has come and gone<span className="text-seal">.</span>
        </h1>
        <p className="mt-4 text-sm text-ink-soft">
          This dossier's month is up. The owner can re-publish it for another $1.
        </p>
        <p className="mt-6 text-[10px] uppercase tracking-[0.4em] text-ink/35">
          /t/{slug}
        </p>
        <Link
          to="/"
          className="mt-10 inline-block border-y border-ink/20 py-3 text-[10px] uppercase tracking-[0.4em] text-ink hover:border-seal hover:text-seal"
        >
          ← TravelDoss
        </Link>
      </div>
    </div>
  );
}