export type LegalDocSlug = "terms" | "privacy" | "disclaimer";

export interface LegalDocMeta {
  slug: LegalDocSlug;
  title: string;
  /** Dotted numeric version of the currently published revision. */
  version: string;
  /** ISO date the revision was published on the site. */
  publishedAt: string;
  /** ISO date the revision takes legal effect. */
  effectiveAt: string;
  /**
   * FNV-1a fingerprint of the markdown. Pinned here (not computed at
   * runtime) so `registry.test.ts` fails when a published document's text
   * is edited without a version bump. Acceptance records store this hash,
   * binding each acceptance to the exact text that was agreed to.
   */
  contentHash: string;
}

/**
 * Metadata-only registry. Deliberately free of Vite `?raw` imports so it is
 * importable from server functions and bun tests; the rendered markdown
 * lives in `content.ts` (Vite-bundled code only).
 */
export const LEGAL_DOCS: Record<LegalDocSlug, LegalDocMeta> = {
  terms: {
    slug: "terms",
    title: "Terms of Service",
    version: "1.2",
    publishedAt: "2026-08-13",
    effectiveAt: "2026-08-13",
    contentHash: "fnv1a64-c2e3579958f00dee",
  },
  privacy: {
    slug: "privacy",
    title: "Privacy Policy",
    version: "1.0",
    publishedAt: "2026-07-27",
    effectiveAt: "2026-07-27",
    contentHash: "fnv1a64-f9ba5594103e6596",
  },
  disclaimer: {
    slug: "disclaimer",
    title: "Disclaimer",
    version: "1.0",
    publishedAt: "2026-07-27",
    effectiveAt: "2026-07-27",
    contentHash: "fnv1a64-2f6e8a268287ad7c",
  },
};

export const CURRENT_TERMS_VERSION = LEGAL_DOCS.terms.version;
