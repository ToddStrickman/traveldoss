import { createFileRoute, Link } from "@tanstack/react-router";

const URL = "https://traveldoss.lovable.app/guide/google-docs-travel-itinerary-template";
const TITLE = "Google Docs Travel Itinerary Template — A Live Map Guide | TravelDoss";
const DESCRIPTION =
  "Build a travel itinerary in Google Docs with a clean, reusable template — then turn it into a live, day-by-day map. The itinerary template and itinerary maker guide for organized trips.";

export const Route = createFileRoute(
  "/guide/google-docs-travel-itinerary-template",
)({
  component: GuidePage,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "article" },
      { property: "og:url", content: URL },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: "Google Docs Travel Itinerary Template",
          description: DESCRIPTION,
          url: URL,
          author: { "@type": "Organization", name: "TravelDoss" },
        }),
      },
    ],
  }),
});

function GuidePage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="mx-auto max-w-3xl px-6 pt-16 md:pt-24">
        <Link
          to="/"
          className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground hover:text-foreground"
        >
          ← TravelDoss
        </Link>
        <p className="mt-10 text-[10px] uppercase tracking-[0.4em] text-muted-foreground">
          Guide · Travel Itinerary
        </p>
        <h1
          className="mt-4 text-4xl font-normal leading-[1.05] tracking-[-0.02em] md:text-6xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          The Google Docs travel itinerary template — and how to turn it into a
          live map.
        </h1>
        <p className="mt-6 text-base leading-relaxed text-muted-foreground md:text-lg">
          A travel itinerary template should do two things well: keep your day-by-day
          plan organized, and stay flexible enough to change on the road. Google Docs
          is the most underrated itinerary maker for exactly this — it's free, syncs
          everywhere, and you can share it with a single link. Here's the template
          structure we recommend, plus how TravelDoss turns it into a pinned, routed
          map.
        </p>
      </header>

      <main className="mx-auto max-w-3xl space-y-12 px-6 py-16 text-[15px] leading-7 md:text-base md:leading-8">
        <section>
          <h2 className="text-2xl font-medium tracking-tight md:text-3xl">
            1. The itinerary template structure
          </h2>
          <p className="mt-4 text-muted-foreground">
            Open a fresh Google Doc and use Heading 1 for the trip name, Heading 2
            for each day, and Heading 3 for each block within a day (morning,
            afternoon, evening). This is the travel itinerary format that scales
            from a weekend to a three-week trip without breaking.
          </p>
          <pre className="mt-6 overflow-x-auto rounded-md border border-border bg-muted/50 p-4 text-xs leading-6">
{`# Tokyo — 7 Days (April 12 – 19)

## Day 1 — Arrival, Shibuya
### Morning
- Narita Express to Shinjuku
- Hotel: Park Hyatt Tokyo (3-7-1-2 Nishi-Shinjuku)
### Afternoon
- Lunch: Tsuta (1 Chome-14-1 Sugamo)
- Walk: Meiji Jingu
### Evening
- Dinner: Kozasa (Shibuya)

## Day 2 — Asakusa & Ueno
### Morning
- Senso-ji Temple
- Nakamise shopping street
...`}
          </pre>
        </section>

        <section>
          <h2 className="text-2xl font-medium tracking-tight md:text-3xl">
            2. Write places like an address book
          </h2>
          <p className="mt-4 text-muted-foreground">
            For every place — lodging, restaurant, sight, transit — write the name
            followed by the address or neighborhood. This is the single most
            valuable habit in the whole itinerary template. It means you (or any
            itinerary maker tool) can resolve every entry to a real point on a
            map, instead of guessing between five restaurants with the same name.
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-6 text-muted-foreground">
            <li>
              <strong className="text-foreground">Lodging:</strong> name + full address
            </li>
            <li>
              <strong className="text-foreground">Food:</strong> restaurant + neighborhood
            </li>
            <li>
              <strong className="text-foreground">Sights:</strong> official name
            </li>
            <li>
              <strong className="text-foreground">Transit:</strong> "Narita Express to Shinjuku"
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-medium tracking-tight md:text-3xl">
            3. Categorize as you go
          </h2>
          <p className="mt-4 text-muted-foreground">
            A travel itinerary format that mixes lodging, food, sights, and transit
            in one flat list is hard to scan. Use simple inline tags — [LODGING],
            [FOOD], [SIGHT], [TRANSIT] — or rely on the Heading 3 blocks above. Either
            way, you'll be able to filter by category later when a tool reads your
            doc.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-medium tracking-tight md:text-3xl">
            4. Make it a live map
          </h2>
          <p className="mt-4 text-muted-foreground">
            This is where most itinerary templates stop — and where TravelDoss
            picks up. Paste the link to your Google Doc into a TravelDoss dossier,
            and we read every place, pin them on a Google Map, route them
            day-by-day, and host the result at a private URL you can share like a
            wedding site. The doc stays the source of truth; edit it, and the map
            updates.
          </p>
          <div className="mt-8">
            <Link
              to="/templates"
              className="inline-flex items-center gap-3 border-y border-foreground/20 py-4 text-[11px] font-medium uppercase tracking-[0.4em] text-foreground transition-colors hover:border-foreground"
            >
              <span>Pick a skin and try it</span>
              <span>→</span>
            </Link>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-medium tracking-tight md:text-3xl">
            FAQ
          </h2>
          <div className="mt-6 space-y-6">
            <div>
              <h3 className="font-medium">
                Is there a Google Docs travel itinerary template I can copy?
              </h3>
              <p className="mt-2 text-muted-foreground">
                Yes — the structure above (Heading 1 for the trip, Heading 2 per
                day, Heading 3 per block) is the template. Copy it into a fresh
                Google Doc and edit.
              </p>
            </div>
            <div>
              <h3 className="font-medium">
                What's the best itinerary maker for an existing Google Doc?
              </h3>
              <p className="mt-2 text-muted-foreground">
                TravelDoss is purpose-built for this — it reads the doc and turns
                it into a routed, day-by-day map without re-typing anything.
              </p>
            </div>
            <div>
              <h3 className="font-medium">
                What travel itinerary format works best for sharing?
              </h3>
              <p className="mt-2 text-muted-foreground">
                A Google Doc you can share via link is the simplest — and a hosted
                dossier microsite (one URL, mobile-friendly, with a live map) is
                the most useful for travel companions.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}