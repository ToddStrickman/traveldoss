import type { Block } from "@/lib/skins/types";

/** One FAQ pair. Answers stay ≤50 words, declarative and self-contained:
 *  they are the answer-engine snippet candidates and must match the visible
 *  page text exactly (the FAQPage JSON-LD is generated from these). */
export type GuideFaq = { q: string; a: string };

/**
 * An Insider Guide: editorial content shaped as a dossier. Guides render
 * through the same SkinFrame pipeline as user trips — that is the product
 * demo — and are immutable; "Make this yours" clones the blocks.
 */
export type GuideDef = {
  slug: string;
  /** "Albania" — used in breadcrumbs, titles and JSON-LD. */
  destination: string;
  /** H1 on the guide page. */
  title: string;
  /** <title> per spec §4. */
  seoTitle: string;
  /** Italic hook line under the H1 and on the globe card. */
  dek: string;
  /** ≤155 chars. */
  metaDescription: string;
  /** "7 days" */
  days: string;
  /** "Late May–June · September" */
  season: string;
  /** Guide number as displayed: "№ 01". */
  no: string;
  /** Short chips shown on the globe card. */
  chips: string[];
  /** Best-matching skin id from the skin registry. */
  skinId: string;
  /** Pin/accent hex from the approved design spec. */
  accent: string;
  lat: number;
  lon: number;
  /** Trip content in the existing Block union. Empty while stubbed. */
  blocks: Block[];
  /** Three per published guide. Empty while stubbed. */
  faq: GuideFaq[];
  /** The italic sources paragraph, verification notes removed. */
  sources: string;
  publishedAt: string;
  updatedAt: string;
  /** False while the guide is a registry stub: no content, noindex. */
  published: boolean;
};
