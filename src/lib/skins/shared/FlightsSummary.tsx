import type { Block } from "../types";
import { AirfareIcon } from "./CategoryIcon";

type Flight = Extract<Block, { kind: "flight" }>;

export function collectFlights(blocks: Block[]): Flight[] {
  return blocks.filter((b): b is Flight => b.kind === "flight");
}

function directionLabel(d?: Flight["direction"]) {
  if (d === "outbound") return "Departure";
  if (d === "inbound") return "Return";
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

const PLACEHOLDERS: Record<string, string> = {
  Confirmation:
    "Not provided — check your confirmation email or airline app",
  "Flight #":
    "Not provided — check your confirmation email",
  Airline:
    "Not provided — check your confirmation email",
  Gate:
    "Usually not on confirmation; check airport boards or airline app closer to departure (gates can change)",
  Passenger:
    "Not provided — check your confirmation email",
  Seat:
    "Not assigned yet — check your boarding pass after check-in",
  "Boarding group":
    "Not provided — check your boarding pass after check-in",
  "Boarding time":
    "Not provided — check your boarding pass after check-in",
  "Fare class":
    "Not provided — check your confirmation email",
  Baggage:
    "Not provided — check your confirmation email or airline website",
  Price:
    "Not provided — check your confirmation email",
};

function SmartRow({ label, value, warn }: { label: string; value?: string; warn?: boolean }) {
  const hasValue = typeof value === "string" && value.trim().length > 0;
  return (
    <div className="tds-flight-row">
      <span className="tds-flight-k">{label}</span>
      {hasValue ? (
        <span className="tds-flight-v">{value}</span>
      ) : (
        <span className={`tds-flight-v tds-flight-missing${warn ? " tds-flight-warn" : ""}`}>
          {PLACEHOLDERS[label] ?? "Not provided"}
        </span>
      )}
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
        <SmartRow label="Confirmation" value={f.confirmation} warn />
        <SmartRow label="Flight #" value={f.flightNumber} warn />
        <SmartRow label="Airline" value={f.airline} />
        <SmartRow
          label="Depart"
          value={
            [f.from || f.fromCity, [f.date, f.departTime].filter(Boolean).join(" ")]
              .filter(Boolean)
              .join(" · ") || undefined
          }
        />
        <SmartRow
          label="Arrive"
          value={
            [f.to || f.toCity, [f.arriveDate ?? f.date, f.arriveTime].filter(Boolean).join(" ")]
              .filter(Boolean)
              .join(" · ") || undefined
          }
        />
        <SmartRow label="Date" value={f.date} />
        <SmartRow label="Gate" value={f.gate} />
      </div>

      <div className="tds-flight-section">
        <div className="tds-flight-sec-label">Passenger &amp; seat</div>
        <SmartRow label="Passenger" value={f.passenger} />
        <SmartRow label="Seat" value={f.seat} />
        <SmartRow label="Boarding group" value={f.boardingGroup} />
        <SmartRow label="Boarding time" value={f.boardingTime} />
      </div>

      <div className="tds-flight-section">
        <div className="tds-flight-sec-label">Fare &amp; baggage</div>
        <SmartRow label="Fare class" value={f.fareClass} />
        <SmartRow label="Baggage" value={f.baggage} />
        <SmartRow label="Price" value={f.price} />
      </div>

      {f.note ? <div className="tds-flight-note">{f.note}</div> : null}
    </article>
  );
}
