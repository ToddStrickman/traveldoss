import { Link } from "@tanstack/react-router";

/** Pencil-thin wordmark, top-right, that returns to the main page. */
export function GuidesHomeMark() {
  return (
    <Link to="/" className="tdg-homemark tap">
      <span className="tdg-homemark-rule" aria-hidden="true" />
      TravelDoss
    </Link>
  );
}
