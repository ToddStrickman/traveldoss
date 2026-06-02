import type { Block } from "../types";
import { AirfareIcon } from "./CategoryIcon";

type Flight = Extract<Block, { kind: "flight" }>;

export function collectFlights(blocks: Block[]): Flight[] {
  return blocks.filter((b): b is Flight => b.kind === "flight");
}

function directionLabel(d?: Flight["direction"]) {
  if (d === "outbound") return "Outbound";
  if (d === "inbound") return "Inbound / Return";
  return "Flight";
}

/** Inline (in-itinerary) compact flight card. Themed via .tds-* tokens. */
export function FlightInline({ flight }: { flight: Flight }) {
  const route =
    [flight.from, flight.to].filter(Boolean).join(" → ") ||
    flight.flightNumber ||
    "Flight";
  return (
    <div className="tds-place" data-block="flight">
      <div className="tds-cat">
        <AirfareIcon className="tds-cat-icon" />
        <span>{directionLabel(flight.direction)}</span>
      </div>
      <div className="tds-place-name">
        {[flight.airline, flight.flightNumber].filter(Boolean).join(" ") || route}
      </div>
      <div className="tds-place-addr">
        {route}
        {flight.departTime ? ` · dep ${flight.departTime}` : ""}
        {flight.arriveTime ? ` · arr ${flight.arriveTime}` : ""}
      </div>
      {flight.note ? <div className="tds-place-note">{flight.note}</div> : null}
    </div>
  );
}

/** End-of-dossier flights summary. One card per flight with every detail. */
export function FlightsSummary({ flights }: { flights: Flight[] }) {
  if (flights.length === 0) return null;
  return (
    <section className="tds-flights" data-block="flights-summary">
      <div className="tds-section">
        <h2>Flights</h2>
      </div>
      <div className="tds-flights-grid">
        {flights.map((f, i) => (
          <FlightCard key={i} flight={f} />
        ))}
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="tds-flight-row">
      <span className="tds-flight-k">{label}</span>
      <span className="tds-flight-v">{value}</span>
    </div>
  );
}

function FlightCard({ flight: f }: { flight: Flight }) {
  const route = [f.from, f.to].filter(Boolean).join(" → ");
  return (
    <article className="tds-flight-card">
      <header className="tds-flight-head">
        <div className="tds-cat">
          <AirfareIcon className="tds-cat-icon" />
          <span>{directionLabel(f.direction)}</span>
        </div>
        <div className="tds-flight-title">
          {[f.airline, f.flightNumber].filter(Boolean).join(" ") || route || "Flight"}
        </div>
        {route ? <div className="tds-flight-route">{route}</div> : null}
      </header>

      <div className="tds-flight-section">
        <div className="tds-flight-sec-label">Core</div>
        <Row label="Confirmation" value={f.confirmation} />
        <Row label="Flight #" value={f.flightNumber} />
        <Row label="Airline" value={f.airline} />
        <Row
          label="Depart"
          value={[f.from || f.fromCity, [f.date, f.departTime].filter(Boolean).join(" ")]
            .filter(Boolean)
            .join(" · ")}
        />
        <Row
          label="Arrive"
          value={[f.to || f.toCity, [f.arriveDate ?? f.date, f.arriveTime].filter(Boolean).join(" ")]
            .filter(Boolean)
            .join(" · ")}
        />
        <Row label="Date" value={f.date} />
      </div>

      <div className="tds-flight-section">
        <div className="tds-flight-sec-label">Passenger & seat</div>
        <Row label="Passenger" value={f.passenger} />
        <Row label="Seat" value={f.seat} />
        <Row label="Boarding group" value={f.boardingGroup} />
        <Row label="Boarding time" value={f.boardingTime} />
      </div>

      <div className="tds-flight-section">
        <div className="tds-flight-sec-label">Fare & baggage</div>
        <Row label="Fare class" value={f.fareClass} />
        <Row label="Baggage" value={f.baggage} />
        <Row label="Price" value={f.price} />
      </div>

      {f.note ? <div className="tds-flight-note">{f.note}</div> : null}
    </article>
  );
}
