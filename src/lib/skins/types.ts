import type { ComponentType } from "react";

export type Block =
  | { kind: "hero"; title: string; subtitle?: string; eyebrow?: string }
  | {
      kind: "section";
      title: string;
      /** When set, this section is a part-of-day rail inside the current day. */
      partOfDay?: "morning" | "afternoon" | "evening";
    }
  | { kind: "paragraph"; text: string }
  | { kind: "day"; n: number; label: string; notes?: string }
  | {
      kind: "place";
      name: string;
      address?: string;
      note?: string;
      /** Optional clock time, e.g. "08:30" — used by all three views. */
      time?: string;
      /** Operational metadata for the grid/table view. */
      phone?: string;
      website?: string;
      hours?: string;
      mapsUrl?: string;
      /** Optional reservation hint (e.g. "Confirmation #L-882, party of 2"). */
      reservation?: string;
      category?:
        | "stay"
        | "eat"
        | "see"
        | "do"
        | "drink"
        | "other"
        | "hotel"
        | "airfare"
        | "currency"
        | "walking"
        | "food";
    }
  | {
      kind: "flight";
      direction?: "outbound" | "inbound";
      airline?: string;
      flightNumber?: string;
      confirmation?: string;
      from?: string;        // IATA code, e.g. JFK
      to?: string;          // IATA code, e.g. LIS
      fromCity?: string;
      toCity?: string;
      departTime?: string;  // local, e.g. "14:20"
      arriveTime?: string;
      date?: string;        // ISO or display
      arriveDate?: string;  // if next-day
      passenger?: string;
      seat?: string;
      boardingGroup?: string;
      boardingTime?: string;
      fareClass?: string;
      baggage?: string;
      price?: string;
      gate?: string;
      note?: string;
    }
  | { kind: "quote"; text: string; attribution?: string }
  | { kind: "note"; text: string };

export type TripView = {
  destination: string;
  subtitle?: string | null;
  slug: string;
  start_date?: string | null;
  end_date?: string | null;
  hero_image_url?: string | null;
  days?: number;
};

export type SkinTokens = {
  /** Background / canvas color */
  bg: string;
  /** Primary text color */
  ink: string;
  /** Secondary / muted text */
  inkSoft: string;
  /** Accent / seal color */
  accent: string;
  /** Hairline / border color */
  rule: string;
  /** CSS font-family for display headings */
  fontDisplay: string;
  /** CSS font-family for body */
  fontBody: string;
  /** Optional Google Fonts CSS url to inject */
  fontUrl?: string;
};

export type SkinMeta = {
  id: string;
  codename: string;
  /** One-line personality hook describing the type of person */
  personality: string;
  /** Searchable style tags for filtering templates */
  tags: string[];
};

/** The three interchangeable layouts a skin can render the same content in. */
export type SkinView = "vertical" | "horizontal" | "grid";

export type SkinRenderProps = {
  trip: TripView;
  blocks: Block[];
  /** Optional layout mode. Token-driven skins honor it; hand-built skins
   *  (epictetus, orsino) ignore it and stay single-layout. Defaults to vertical. */
  view?: SkinView;
};

export type SkinModule = {
  meta: SkinMeta;
  tokens: SkinTokens;
  Render: ComponentType<SkinRenderProps>;
  /** Used by the gallery tile so users compare design, not content */
  previewFixture: { trip: TripView; blocks: Block[] };
};