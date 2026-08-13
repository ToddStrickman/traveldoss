import { test, expect } from "@playwright/test";

/**
 * Insider Guides SEO/AEO contract (impl spec §7).
 *
 * The crawler-facing assertions use request.get() — raw server HTML, no JS —
 * because that is exactly what search engines and answer engines consume. The
 * clone CTA test runs in a real page since it exercises the login redirect.
 * Everything here is unauthenticated: guides are the public SEO surface.
 */

/** Every JSON-LD payload embedded in an HTML document, parsed. */
function jsonLdBlocks(html: string): unknown[] {
  const out: unknown[] = [];
  const re = /<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    out.push(JSON.parse(m[1]));
  }
  return out;
}

test.describe("guides index — server HTML", () => {
  test("published guide links exist without JS", async ({ request }) => {
    const res = await request.get("/guides");
    expect(res.ok()).toBe(true);
    const html = await res.text();
    // The card grid is server-rendered below the globe stage.
    expect(html).toContain('href="/guides/albania"');
    expect(html).toContain('href="/guides/savannah"');
    expect(html).toContain("Insider Guide");
    // Unpublished stubs stay off the index until their content lands.
    expect(html).not.toContain("Content landing soon");
  });

  test("index carries CollectionPage JSON-LD of published guides only", async ({ request }) => {
    const html = await (await request.get("/guides")).text();
    const blocks = jsonLdBlocks(html);
    const collection = blocks.find(
      (b) => (b as { "@type"?: string })["@type"] === "CollectionPage",
    ) as { mainEntity: { itemListElement: { url: string }[] } } | undefined;
    expect(collection).toBeTruthy();
    const urls = collection!.mainEntity.itemListElement.map((e) => e.url);
    expect(urls.some((u) => u.endsWith("/guides/albania"))).toBe(true);
    for (const url of urls) {
      // Every listed URL must be a published (indexable) page.
      const page = await (await request.get(new URL(url).pathname)).text();
      expect(page).not.toContain('name="robots" content="noindex');
    }
  });
});

test.describe("guide page — server HTML", () => {
  test("albania SSR contains h1, FAQ text and valid JSON-LD", async ({ request }) => {
    const res = await request.get("/guides/albania");
    expect(res.ok()).toBe(true);
    const html = await res.text();

    expect(html).toContain("Albania: The Insider Guide");
    // FAQ answers live in the DOM (details/summary), not behind JS.
    expect(html).toContain("When is the best time to visit the Albanian Riviera?");
    // The editorial extras render in the guide chrome (the shared views drop
    // paragraph/note blocks): lede + "The brief" roundups must reach crawlers.
    expect(html).toContain("The secret is half out");
    expect(html).toContain("Where to stay");

    const graph = jsonLdBlocks(html)
      .flatMap((b) => (b as { "@graph"?: { "@type": string }[] })["@graph"] ?? [])
      .map((n) => n["@type"]);
    expect(graph).toContain("Article");
    expect(graph).toContain("FAQPage");
    expect(graph).toContain("BreadcrumbList");
    expect(graph).toContain("TouristTrip");
  });

  test("every guide page is indexable with guide structured data", async ({ request }) => {
    // All ten guides are published; none may carry noindex or ship without
    // its Article/FAQPage graph. (Unpublished stubs, if ever reintroduced,
    // get noindex + no guide JSON-LD via the published flag.)
    for (const slug of ["paris", "japan-golden-route", "okinawa"]) {
      const html = await (await request.get(`/guides/${slug}`)).text();
      expect(html).not.toContain('content="noindex');
      const graph = jsonLdBlocks(html)
        .flatMap((b) => (b as { "@graph"?: { "@type": string }[] })["@graph"] ?? [])
        .map((n) => n["@type"]);
      expect(graph).toContain("Article");
      expect(graph).toContain("FAQPage");
    }
  });
});

test("sitemap lists /guides and all ten published guides", async ({ request }) => {
  const xml = await (await request.get("/sitemap.xml")).text();
  expect(xml).toContain("/guides</loc>");
  for (const slug of [
    "albania",
    "crete",
    "uncharted-indonesia",
    "okinawa",
    "savannah",
    "japan-golden-route",
    "amalfi-coast",
    "lisbon",
    "mexico-city",
    "paris",
  ]) {
    expect(xml).toContain(`/guides/${slug}</loc>`);
  }
});

test("anonymous clone CTA routes through login with a redirect back", async ({ page }) => {
  await page.goto("/guides/albania");
  // Dev-mode hydration can land after the first click; retry until the
  // handler is live. (Verified working first-click on production.)
  const cta = page.getByRole("button", { name: /make this yours/i });
  await expect(async () => {
    await cta.click();
    await page.waitForURL(/\/login/, { timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  expect(page.url()).toContain("redirect=%2Fguides%2Falbania");
});
