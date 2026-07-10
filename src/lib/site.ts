/**
 * Canonical public origin for SEO surfaces (canonicals, og:url, JSON-LD,
 * sitemap). traveldoss.lovable.app 302s here — never emit it in metadata,
 * or search engines receive a circular canonical signal.
 */
export const SITE_URL = "https://traveldoss.com";
