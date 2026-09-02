import { beforeEach, describe, expect, test } from "bun:test";

import {
  GA_MEASUREMENT_ID,
  bootstrapSnippet,
  gtagEvent,
  isMeasurableHost,
  resetPageviewDedupe,
  trackPageview,
} from "../src/lib/analytics/gtag";

/**
 * Guards what Google Analytics is allowed to receive.
 *
 * Why this matters: `/t/<slug>` is a capability URL — the slug is the only thing
 * gating read access to a dossier (see src/lib/analytics/scrub.ts). A slug that
 * reaches GA hands trip access to everyone who can read the Analytics property,
 * and Google retains it independently of us.
 *
 * These are security assertions, not formatting preferences — do not relax them
 * to make an unrelated change pass.
 */

const SECRET_SLUG = "cassian-k7m2xq";

type Hit = [string, string, Record<string, unknown>];

function captureHits(): Hit[] {
  const hits: Hit[] = [];
  window.gtag = ((...args: unknown[]) => {
    hits.push(args as Hit);
  }) as typeof window.gtag;
  return hits;
}

beforeEach(() => {
  resetPageviewDedupe();
  delete window.gtag;
});

describe("GA_MEASUREMENT_ID", () => {
  test("is a well-formed GA4 measurement id, never a connector key", () => {
    expect(GA_MEASUREMENT_ID).toMatch(/^G-[A-Z0-9]{6,}$/);
  });
});

describe("isMeasurableHost", () => {
  test("accepts the canonical production host", () => {
    expect(isMeasurableHost("traveldoss.com")).toBe(true);
    expect(isMeasurableHost("www.traveldoss.com")).toBe(true);
  });

  test("rejects local development", () => {
    expect(isMeasurableHost("localhost")).toBe(false);
    expect(isMeasurableHost("127.0.0.1")).toBe(false);
  });

  test("rejects Lovable preview hosts, which would inflate production sessions", () => {
    expect(isMeasurableHost("id-preview--abc123.lovable.app")).toBe(false);
    // traveldoss.lovable.app 302s to traveldoss.com; counting it double-counts.
    expect(isMeasurableHost("traveldoss.lovable.app")).toBe(false);
  });
});

describe("bootstrapSnippet", () => {
  /**
   * The single most important assertion in this file. With GA4's default
   * `send_page_view: true`, `config` fires a page_view built from
   * `document.location` before any of our code runs — so a visitor landing
   * directly on a share link hands Google the raw slug, and scrubbing later
   * navigations cannot undo it.
   */
  test("disables the automatic page_view so every hit passes through the scrubber", () => {
    expect(bootstrapSnippet()).toContain("send_page_view:false");
  });

  test("configures the TravelDoss property", () => {
    expect(bootstrapSnippet()).toContain(GA_MEASUREMENT_ID);
  });

  test("guards the config call behind the host check", () => {
    const snippet = bootstrapSnippet();
    expect(snippet).toContain("location.hostname");
    expect(snippet).toContain("id-preview");
    expect(snippet).toContain(".lovable.app");
    // The config call must be inside the guard, never unconditional.
    expect(snippet).toContain("if(!skip){window.gtag('config'");
  });

  /**
   * TanStack Router re-appends route-managed inline head scripts on client-side
   * navigation, which re-executes them. The snippet must therefore be a no-op
   * the second time it runs, or every navigation pushes another `config`.
   */
  test("is idempotent when re-executed by the router on navigation", () => {
    const snippet = bootstrapSnippet();
    expect(snippet.startsWith("if(!window.__tdGtagBooted){")).toBe(true);
    expect(snippet).toContain("window.__tdGtagBooted=true;");
    expect(snippet.endsWith("}")).toBe(true);
  });
});

describe("trackPageview", () => {
  test("replaces a dossier slug in page_path", () => {
    const hits = captureHits();
    trackPageview(`/t/${SECRET_SLUG}`);

    expect(hits).toHaveLength(1);
    expect(hits[0]![2].page_path).toBe("/t/:slug");
    expect(JSON.stringify(hits[0])).not.toContain(SECRET_SLUG);
  });

  /**
   * GA4 treats `page_location` as the canonical URL and falls back to
   * `document.location` when it is absent. Setting only `page_path` would leave
   * the unscrubbed slug in the hit.
   */
  test("replaces the slug in page_location too", () => {
    const hits = captureHits();
    trackPageview(`/t/${SECRET_SLUG}`);

    expect(hits[0]![2].page_location).toBe(`${window.location.origin}/t/:slug`);
  });

  test("scrubs a referrer carrying a slug", () => {
    const hits = captureHits();
    trackPageview("/plan", `https://traveldoss.com/t/${SECRET_SLUG}`);

    expect(hits[0]![2].page_referrer).not.toContain(SECRET_SLUG);
    expect(hits[0]![2].page_referrer).toContain("/t/:slug");
  });

  test("scrubs auth material a referrer may carry", () => {
    const hits = captureHits();
    trackPageview("/plan", "https://traveldoss.com/login?code=abc123secret#access_token=xyz");

    expect(JSON.stringify(hits[0])).not.toContain("abc123secret");
    expect(JSON.stringify(hits[0])).not.toContain("xyz");
  });

  test("sends ordinary paths unchanged", () => {
    const hits = captureHits();
    trackPageview("/templates");

    expect(hits[0]![2].page_path).toBe("/templates");
    expect(hits[0]![0]).toBe("event");
    expect(hits[0]![1]).toBe("page_view");
  });

  test("does not double-count the same path twice in a row", () => {
    const hits = captureHits();
    trackPageview("/templates");
    trackPageview("/templates");

    expect(hits).toHaveLength(1);
  });

  test("reports a genuine navigation after a repeat", () => {
    const hits = captureHits();
    trackPageview("/templates");
    trackPageview("/templates");
    trackPageview("/plan");

    expect(hits).toHaveLength(2);
    expect(hits[1]![2].page_path).toBe("/plan");
  });

  test("is inert when gtag never loaded", () => {
    // No captureHits(): window.gtag is undefined, as it would be if the request
    // to googletagmanager.com were blocked by an ad blocker.
    expect(() => trackPageview("/templates")).not.toThrow();
  });
});

describe("gtagEvent", () => {
  test("mirrors a product event with the same name and props as PostHog", () => {
    const hits = captureHits();
    gtagEvent("guide_view", { slug: "albania-slow-roads", published: true });

    expect(hits).toHaveLength(1);
    expect(hits[0]![0]).toBe("event");
    expect(hits[0]![1]).toBe("guide_view");
    expect(hits[0]![2]).toEqual({ slug: "albania-slow-roads", published: true });
  });

  test("is inert when gtag never loaded", () => {
    expect(() => gtagEvent("guide_view", { slug: "x" })).not.toThrow();
  });

  test("never throws even if gtag itself throws", () => {
    window.gtag = (() => {
      throw new Error("boom");
    }) as typeof window.gtag;
    expect(() => gtagEvent("guide_view")).not.toThrow();
  });
});
