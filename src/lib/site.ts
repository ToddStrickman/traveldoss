/**
 * Canonical public origin for SEO surfaces (canonicals, og:url, JSON-LD,
 * sitemap). traveldoss.lovable.app 302s here — never emit it in metadata,
 * or search engines receive a circular canonical signal.
 */
export const SITE_URL = "https://traveldoss.com";

/** Mint price. Change here only — all price copy derives from these. */
export const PRICE_CENTS = 500;
export const PRICE_LABEL = "$5";
export const PRICE_WORDS = "five dollars";
