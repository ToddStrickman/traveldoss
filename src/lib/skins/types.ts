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
  | {
      kind: "day";
      n: number;
      label: string;
      notes?: string;
      /** Calendar date for this day if known (free-form: "Oct 14", "10/14/25", ISO). */
      date?: string;
    }
  | {
      kind: "place";
      name: string;
      address?: string;
      note?: string;
      /** Optional clock time, e.g. "08:30" — used by all three views. */
      time?: string;
      /** Operational metadata shared by every category. */
      phone?: string;
      website?: string;
      hours?: string;
      mapsUrl?: string;
      /** Booking / confirmation reference (e.g. "Conf #L-882, party of 2"). */
      reservation?: string;
      /**
       * Standardized trip-component categories. The first six are the canonical
       * set every template/skin renders consistently. The remainder are legacy
       * aliases kept for backward compatibility (auto-mapped to canonical
       * icons + labels).
       */
      category?:
        // ── Canonical six ─────────────────────────────────────────
        | "transit"        // Travel vendors: taxi, ferry, train, transfer
        | "restaurant"     // Restaurants & dining
        | "walk"           // Walks & hikes
        | "event"          // Concerts, theater, sports
        | "accommodation"  // Hotels & rentals
        | "culture"        // Cultural sites & museums
        // ── Legacy aliases (auto-mapped) ──────────────────────────
        | "stay" | "eat" | "see" | "do" | "drink" | "other"
        | "hotel" | "airfare" | "currency" | "walking" | "food";
      // ── Transit (taxi / ferry / transfer) ────────────────────────
      vendor?: string;             // operating company
      pickup?: string;             // pickup / departure location
      dropoff?: string;            // drop-off / arrival location
      // ── Restaurant ───────────────────────────────────────────────
      dressCode?: string;          // e.g. "Smart casual"
      mustOrder?: string;          // editorial: must-order dish
      // ── Walk / hike ──────────────────────────────────────────────
      trailhead?: string;          // trailhead address
      distance?: string;           // e.g. "6.4 km"
      duration?: string;           // e.g. "~2h"
      difficulty?: string;         // "Easy" / "Moderate" / "Hard"
      waypoints?: string;          // notable sights along the way
      prep?: string;               // preparation note (bring water etc.)
      // ── Event (concert / theater / sport) ────────────────────────
      venue?: string;              // venue name (when different from `name`)
      doorOpen?: string;           // doors open time
      ticketLink?: string;         // ticket / wallet URL
      seat?: string;               // section / row / seat
      venueRules?: string;         // bag policy / venue rules
      // ── Accommodation ────────────────────────────────────────────
      checkIn?: string;            // check-in time
      checkOut?: string;           // check-out time
      amenities?: string;          // notable amenities
      // ── Culture / museum ─────────────────────────────────────────
      ticketRequirement?: string;  // "Pre-booked entry" / "Walk-in"
      tourDetails?: string;        // guided tour info
      /**
       * Parser/enricher confidence in the standardized fields for this
       * place, on a 0–1 scale. Used by the review UI to surface a
       * hoverable inspect prompt when below 0.85.
       */
      confidence?: number;
      /** Source of enrichment for transparency in the inspect popover. */
      enrichmentSource?: "model" | "google-places" | "manual";
      /** Fields that were auto-filled by an enricher (not the user). */
      enrichedFields?: string[];
      /**
       * Itinerary tier. "shadow" = a backup / Plan-B alternative rendered in
       * the bottom Shadow Itinerary section. Unset / "primary" = main plan.
       */
      tier?: "primary" | "shadow";
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
  /** Optional dossier-level preferences shown as inline chips. */
  meta?: TripMeta | null;
};

export type TripMeta = {
  travelers?: string;
  pace?: "relaxed" | "balanced" | "packed";
  budget?: "shoestring" | "moderate" | "elevated" | "luxury";
  interests?: string[];
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