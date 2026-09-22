import type { CSSProperties } from "react";
import type { Block, SkinTokens, TripView } from "@/lib/skins/types";
import { buildItinerary, PART_LABEL, type PartOfDay } from "@/lib/skins/shared/itinerary";
import { getTripLogistics, type LogisticsStay } from "@/lib/skins/shared/logistics";
import { FlightCard } from "@/lib/skins/shared/FlightsSummary";
import { StayCard, type HotelStay } from "@/lib/skins/shared/HotelsQuickRef";

const parts: PartOfDay[] = ["morning", "afternoon", "evening"];
const stayCategories = new Set(["accommodation", "stay", "hotel"]);

function asHotelStay(stay: LogisticsStay): HotelStay {
  return {
    hotel: stay.hotel,
    index: stay.blockIndex,
    fromDay: stay.fromDay + 1,
    toDay: stay.toDay + 1,
    checkInDate: stay.checkInDate,
    checkOutDate: stay.checkOutDate,
    nights: stay.nights,
  };
}

export function PrintDossier({
  trip,
  blocks,
  tokens,
}: {
  trip: TripView;
  blocks: Block[];
  tokens: SkinTokens;
}) {
  const itinerary = buildItinerary(blocks);
  const logistics = getTripLogistics(trip, blocks);
  const vars = {
    "--tds-bg": tokens.bg,
    "--tds-ink": tokens.ink,
    "--tds-soft": tokens.inkSoft,
    "--tds-accent": tokens.accent,
    "--tds-rule": tokens.rule,
    "--tds-fontDisplay": tokens.fontDisplay,
    "--tds-fontBody": tokens.fontBody,
  } as CSSProperties;

  return (
    <article className="td-print-dossier tds" data-print="only" style={vars} aria-label="Printable trip dossier">
      <header className="td-print-cover">
        {trip.hero_image_url ? <img src={trip.hero_image_url} alt="" /> : null}
        <div className="td-print-cover-copy">
          <p>TravelDoss</p>
          <h1>{trip.destination}</h1>
          {trip.subtitle ? <div>{trip.subtitle}</div> : null}
          <small>{[trip.start_date, trip.end_date].filter(Boolean).join(" — ")}</small>
        </div>
      </header>

      {itinerary.days.map((day, dayPosition) => {
        const dayLogistics = logistics.days[dayPosition];
        const flights = logistics.flights.filter((flight) => flight.departureDay === dayPosition);
        const stays = logistics.stays.filter((stay) => stay.fromDay === dayPosition);
        const checkout = logistics.stays.filter((stay) => stay.toDay === dayPosition);
        const gap = logistics.gaps.some((item) => item.night === dayPosition);
        return (
          <section className="td-print-day" key={day.dayIndex} data-block="day">
            <header className="td-print-day-head">
              <span>Day {String(day.day.n).padStart(2, "0")}</span>
              <h2>{day.day.label}</h2>
              <p>{[day.day.date, dayLogistics?.city].filter(Boolean).join(" · ")}</p>
            </header>

            {(flights.length || stays.length || checkout.length || gap) ? (
              <div className="td-print-markers" aria-label="Day logistics">
                {checkout.map((stay) => <span key={`out-${stay.id}`}>Check out · {stay.hotel.name}</span>)}
                {stays.map((stay) => <span key={`in-${stay.id}`}>Check in · {stay.hotel.name}</span>)}
                {flights.map((flight) => <span key={flight.id}>Flight · {[flight.flight.from, flight.flight.to].filter(Boolean).join(" → ")}</span>)}
                {gap ? <span>No stay booked</span> : null}
              </div>
            ) : null}

            {flights.map((flight) => <FlightCard key={flight.id} flight={flight.flight} />)}
            {stays.map((stay) => <StayCard key={stay.id} stay={asHotelStay(stay)} />)}

            <div className="td-print-schedule">
              {parts.map((part) => {
                const entries = day[part].filter(({ activity }) => !activity.category || !stayCategories.has(activity.category));
                if (!entries.length) return null;
                return (
                  <section key={part} className="td-print-part">
                    <h3>{PART_LABEL[part]}</h3>
                    {entries.map(({ activity, index }) => (
                      <div className="td-print-stop" key={index}>
                        <time>{activity.time || "—"}</time>
                        <div>
                          <strong>{activity.name}</strong>
                          {activity.address ? <span>{activity.address}</span> : null}
                          {activity.note ? <p>{activity.note}</p> : null}
                        </div>
                      </div>
                    ))}
                  </section>
                );
              })}
            </div>
          </section>
        );
      })}
    </article>
  );
}