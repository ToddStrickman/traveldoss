/**
 * Hotels quick reference — the accommodation dashboard.
 *
 * Travelers ask "where am I sleeping tonight, and what's the address" far
 * more often than they re-read a day. That answer was buried inside the
 * day-by-day rails, so this surfaces it once, before Day 01: a single button
 * that opens every stay in chronological order with the details a traveler
 * needs at a door or in a taxi.
 *
 * The day-by-day itinerary is unchanged — the stay still lives in its day.
 * This is a read-only mirror derived from the same blocks.
 */
import { useMemo, useState } from "react";
import { ExternalLink, MapPin, Phone } from "lucide-react";
import type { Block, GalleryImage } from "../types";
import { HotelIcon } from "./CategoryIcon";
import { TdSheet } from "@/components/mobile/TdSheet";
import { dayDateLabel, LinkifiedText, useInertRender } from "./views/parts";
import { useFallbackImages } from "./fallback-images";
import { useTrustedViewer } from "./trusted-viewer";
import { trackHotelsQuickRefOpened } from "@/lib/analytics";

type PlaceBlock = Extract<Block, { kind: "place" }>;

/** Every category alias that means "a bed for the night". */
const STAY_CATEGORIES = new Set(["accommodation", "stay", "hotel"]);

export type HotelStay = {
  hotel: PlaceBlock;
  /** Index of the block, so the card can key stably. */
  index: number;
  /** Day number the stay begins on (1-based as authored). */
  fromDay?: number;
  /** Day number the stay ends on — the next stay's start, or the last day. */
  toDay?: number;
  /** Raw day-date strings; rendered through dayDateLabel. */
  checkInDate?: string;
  checkOutDate?: string;
  nights?: number;
};

function isStay(b: Block): b is PlaceBlock {
  return b.kind === "place" && !!b.category && STAY_CATEGORIES.has(b.category);
}

/** Nights between two ISO dates, when both are ISO and ordered. */
function isoNights(from?: string, to?: string): number | undefined {
  const re = /^(\d{4})-(\d{2})-(\d{2})$/;
  const a = from && re.exec(from.trim());
  const b = to && re.exec(to.trim());
  if (!a || !b) return undefined;
  const ms = Date.UTC(+b[1], +b[2] - 1, +b[3]) - Date.UTC(+a[1], +a[2] - 1, +a[3]);
  const nights = Math.round(ms / 86_400_000);
  return nights > 0 ? nights : undefined;
}

/**
 * Collect the trip's stays in chronological order and infer each stay's
 * window from the surrounding day blocks: a stay runs until the next
 * different hotel begins, otherwise to the last day of the trip. Repeating
 * the same hotel on consecutive days is a listing convention, not a second
 * booking, so those collapse into one stay.
 */
export function collectHotelStays(blocks: Block[]): HotelStay[] {
  type Raw = { hotel: PlaceBlock; index: number; day?: number; date?: string };
  const raw: Raw[] = [];
  let currentDay: number | undefined;
  let currentDate: string | undefined;
  let lastDay: number | undefined;
  let lastDate: string | undefined;
  const dayDates = new Map<number, string | undefined>();

  blocks.forEach((b, index) => {
    if (b.kind === "day") {
      currentDay = b.n;
      currentDate = b.date;
      lastDay = b.n;
      lastDate = b.date;
      dayDates.set(b.n, b.date);
      return;
    }
    if (!isStay(b)) return;
    const name = (b.name ?? "").trim().toLowerCase();
    const prev = raw[raw.length - 1];
    // Same hotel again (next night) — one stay, not two.
    if (prev && (prev.hotel.name ?? "").trim().toLowerCase() === name && name) return;
    raw.push({ hotel: b, index, day: currentDay, date: currentDate });
  });

  return raw.map((entry, i) => {
    const next = raw[i + 1];
    const toDay = next?.day ?? lastDay;
    const checkOutDate = next ? next.date : lastDate;
    const nights =
      isoNights(entry.date, checkOutDate) ??
      (entry.day != null && toDay != null && toDay > entry.day ? toDay - entry.day : undefined);
    return {
      hotel: entry.hotel,
      index: entry.index,
      fromDay: entry.day,
      toDay,
      checkInDate: entry.date,
      checkOutDate,
      nights,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Button + panel                                                      */
/* ------------------------------------------------------------------ */

/** Quick-reference entry point. Renders nothing when the trip has no stays. */
export function HotelsQuickRef({ blocks }: { blocks: Block[] }) {
  const inert = useInertRender();
  const stays = useMemo(() => collectHotelStays(blocks), [blocks]);
  const [open, setOpen] = useState(false);
  if (inert || stays.length === 0) return null;

  return (
    <div className="tds-hotelsref" data-print="hide">
      <button
        type="button"
        className="tds-hotelsref-btn tap"
        onClick={() => {
          setOpen(true);
          trackHotelsQuickRefOpened({ hotel_count: stays.length });
        }}
      >
        <span className="tds-hotelsref-icon" aria-hidden>
          <HotelIcon />
        </span>
        <span>Hotels</span>
        <span className="tds-hotelsref-count">{stays.length}</span>
      </button>

      <TdSheet
        open={open}
        onOpenChange={setOpen}
        title="Hotels"
        description="Every stay on this trip, in order."
        snapHeight="full"
      >
        <div className="tds-hotelcards">
          {stays.map((stay) => (
            <HotelCard key={stay.index} stay={stay} />
          ))}
        </div>
      </TdSheet>
    </div>
  );
}

function StayWindow({ stay }: { stay: HotelStay }) {
  const inLabel = dayDateLabel(stay.checkInDate);
  const outLabel = dayDateLabel(stay.checkOutDate);
  return (
    <dl className="tds-hotelcard-window">
      <div>
        <dt>Check in</dt>
        <dd>
          {inLabel}
          {stay.hotel.checkIn ? ` · ${stay.hotel.checkIn}` : ""}
        </dd>
      </div>
      <div>
        <dt>Check out</dt>
        <dd>
          {outLabel}
          {stay.hotel.checkOut ? ` · ${stay.hotel.checkOut}` : ""}
        </dd>
      </div>
      {/* Reserved line: nights resolve from dates, so the row must not
          appear and shift the card once they do. */}
      <div>
        <dt>Nights</dt>
        <dd>{stay.nights != null ? `${stay.nights} ${stay.nights === 1 ? "night" : "nights"}` : "—"}</dd>
      </div>
    </dl>
  );
}

/** One stay. Image on top (or a refined plate), then the reference rows. */
function HotelCard({ stay }: { stay: HotelStay }) {
  const h = stay.hotel;
  const trusted = useTrustedViewer();
  const [failed, setFailed] = useState(false);
  const own: GalleryImage | undefined = (h.images ?? []).find((im) => im.src);
  const queries = useMemo(
    () => (own || !h.name ? [] : [`${h.name} hotel exterior`]),
    [own, h.name],
  );
  const { images: fb } = useFallbackImages({
    queries,
    want: 1,
    enabled: queries.length > 0,
  });
  const image = own ?? fb[0];
  const showImage = !!image?.src && !failed;

  const detail: Array<{ label: string; value: string }> = [];
  if (h.amenities) detail.push({ label: "Amenities", value: h.amenities });
  if (h.vendor) detail.push({ label: "Booked via", value: h.vendor });
  if (trusted && h.reservation) detail.push({ label: "Reservation", value: h.reservation });

  return (
    <article className="tds-hotelcard">
      {/* Fixed-ratio plate: the photo arrives asynchronously, so its box is
          reserved from the first paint (CLS stays 0). */}
      <div className="tds-hotelcard-plate">
        {showImage ? (
          <img
            src={image.src}
            alt={image.alt || h.name || "Hotel"}
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
          />
        ) : (
          <span className="tds-hotelcard-plateglyph" aria-hidden>
            <HotelIcon />
          </span>
        )}
      </div>

      <div className="tds-hotelcard-body">
        <h3 className="tds-hotelcard-name">
          {h.website ? (
            <a href={h.website} target="_blank" rel="noopener noreferrer">
              {h.name}
              <ExternalLink size={12} aria-hidden />
            </a>
          ) : (
            h.name
          )}
        </h3>

        <StayWindow stay={stay} />

        {h.address ? (
          <p className="tds-hotelcard-addr">
            <MapPin size={13} aria-hidden />
            <span>{h.address}</span>
          </p>
        ) : null}

        <div className="tds-hotelcard-actions">
          {h.phone ? (
            <a className="tds-hotelcard-action tap" href={`tel:${h.phone.replace(/[^\d+]/g, "")}`}>
              <Phone size={13} aria-hidden />
              <span>{h.phone}</span>
            </a>
          ) : null}
          {h.website ? (
            <a
              className="tds-hotelcard-action tap"
              href={h.website}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink size={13} aria-hidden />
              <span>{h.websiteTitle || "Hotel website"}</span>
            </a>
          ) : null}
        </div>

        {detail.length > 0 ? (
          <dl className="tds-hotelcard-detail">
            {detail.map((d) => (
              <div key={d.label}>
                <dt>{d.label}</dt>
                <dd>{d.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        {h.note ? (
          <p className="tds-hotelcard-note">
            <LinkifiedText text={h.note} linkTitles={h.linkTitles} />
          </p>
        ) : null}
      </div>
    </article>
  );
}
