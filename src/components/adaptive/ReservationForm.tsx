import { useState } from "react";
import { ItemType, ReservationSchema, type Reservation } from "@/lib/adaptive/types";
import { Button } from "@/components/ui/button";

export function ReservationForm({
  initial,
  label = "Save reservation",
  onSave,
  onCancel,
  busy,
}: {
  initial?: Partial<Reservation>;
  label?: string;
  onSave: (r: Reservation) => Promise<void>;
  onCancel: () => void;
  busy: boolean;
}) {
  const [value, setValue] = useState<Partial<Reservation>>({
    type: "activity",
    title: "",
    provider: "",
    status: "confirmed",
    timezone: "UTC",
    details: {},
    ...initial,
  });
  const [error, setError] = useState("");
  const field = (key: keyof Reservation, label: string, placeholder?: string) => (
    <label className="ad-field">
      {label}
      <input
        value={String(value[key] ?? "")}
        placeholder={placeholder}
        onChange={(e) => setValue((v) => ({ ...v, [key]: e.target.value || undefined }))}
      />
    </label>
  );
  return (
    <form
      className="ad-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        const parsed = ReservationSchema.safeParse(value);
        if (!parsed.success) {
          setError(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(" · "));
          return;
        }
        try {
          await onSave(parsed.data);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not save.");
        }
      }}
    >
      <p className="ad-muted">
        Confirm the details below. Times need an explicit UTC offset, for example{" "}
        <code>2030-06-18T15:10:00-04:00</code>. We preserve your original values and protect your
        edits.
      </p>
      {initial?.details?.originalDate && (
        <p>
          Original itinerary: {initial.details.originalDate} {initial.details.originalTime}
        </p>
      )}
      <div className="ad-form-grid">
        {field("title", "Reservation name")}
        {field("provider", "Provider")}
        <label className="ad-field">
          Type
          <select
            value={value.type}
            onChange={(e) =>
              setValue((v) => ({ ...v, type: e.target.value as Reservation["type"] }))
            }
          >
            {ItemType.options.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </label>
        {field("confirmation", "Confirmation / booking ID")}
        {field("traveler", "Traveler / guest")}
        {field("timezone", "IANA timezone", "Europe/Paris")}
        {field("startAt", "Start (with UTC offset)", "2030-06-18T15:10:00-04:00")}
        {field("endAt", "End (with UTC offset)")}
        {field("origin", "Origin / airport")}
        {field("destination", "Destination / airport")}
        {field("location", "City / location")}
        {field("address", "Address")}
        <label className="ad-field">
          Status
          <select
            value={value.status}
            onChange={(e) =>
              setValue((v) => ({ ...v, status: e.target.value as Reservation["status"] }))
            }
          >
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
        <label className="ad-check">
          <input
            type="checkbox"
            checked={value.outdoor === true}
            onChange={(e) => setValue((v) => ({ ...v, outdoor: e.target.checked }))}
          />
          Outdoor activity
        </label>
        {(["lat", "lng"] as const).map((key) => (
          <label className="ad-field" key={key}>
            {key === "lat" ? "Latitude (optional)" : "Longitude (optional)"}
            <input
              type="number"
              step="any"
              value={value[key] ?? ""}
              onChange={(e) =>
                setValue((v) => ({
                  ...v,
                  [key]: e.target.value ? Number(e.target.value) : undefined,
                }))
              }
            />
          </label>
        ))}
      </div>
      {error && (
        <p role="alert" className="ad-error">
          {error}
        </p>
      )}
      <div className="ad-actions">
        <Button disabled={busy} type="submit">
          {busy ? "Saving…" : label}
        </Button>
        <Button variant="outline" type="button" onClick={onCancel}>
          Back
        </Button>
      </div>
    </form>
  );
}
