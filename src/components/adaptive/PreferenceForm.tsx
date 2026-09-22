import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { TripMonitoringPreference } from "@/lib/adaptive/types";

export function PreferenceForm({
  initial,
  onSave,
  busy,
  onLocation,
  onNotifications,
  pushAvailable,
}: {
  initial: TripMonitoringPreference;
  onSave: (p: TripMonitoringPreference) => Promise<void>;
  busy: boolean;
  onLocation: () => Promise<void>;
  onNotifications: () => Promise<void>;
  pushAvailable: boolean;
}) {
  const [draft, setDraft] = useState(() => structuredClone(initial));
  const [saved, setSaved] = useState(false);
  function edit(fn: (p: TripMonitoringPreference) => void) {
    setDraft((p) => {
      const next = structuredClone(p);
      fn(next);
      return next;
    });
    setSaved(false);
  }
  return (
    <div className="ad-stack">
      <section className="ad-card">
        <h2>When your trip goes live</h2>
        <p className="ad-muted">
          Email sync continues in every phase. Pausing or ending Live Trip stops live monitoring and
          alerts.
        </p>
        <label className="ad-check">
          <input
            type="checkbox"
            checked={draft.autoActivate}
            onChange={(e) =>
              edit((p) => {
                p.autoActivate = e.target.checked;
              })
            }
          />
          Activate automatically
        </label>
        <label className="ad-field">
          Hours before the first active reservation
          <input
            type="number"
            min={1}
            max={168}
            value={draft.activationHours}
            onChange={(e) =>
              edit((p) => {
                p.activationHours = Number(e.target.value);
              })
            }
          />
        </label>
        <label className="ad-check">
          <input
            type="checkbox"
            checked={draft.notifications.criticalBeforeDeparture}
            onChange={(e) =>
              edit((p) => {
                p.notifications.criticalBeforeDeparture = e.target.checked;
              })
            }
          />
          Critical booking changes before departure (optional)
        </label>
      </section>
      <section className="ad-card">
        <h2>Only the updates you want</h2>
        <p className="ad-muted">
          Critical and Important alerts still need a relevant reservation and useful next step.
          Helpful updates stay in your dashboard unless you opt in.
        </p>
        <label className="ad-check">
          <input
            type="checkbox"
            disabled={!pushAvailable}
            checked={draft.notifications.push}
            onChange={(e) =>
              edit((p) => {
                p.notifications.push = e.target.checked;
              })
            }
          />
          Push notifications
        </label>
        <Button
          type="button"
          variant="outline"
          disabled={!pushAvailable || busy}
          onClick={onNotifications}
        >
          Enable notifications on this device
        </Button>
        {!pushAvailable && (
          <p className="ad-muted">
            Push delivery is not configured. In-app updates remain available.
          </p>
        )}
        <div className="ad-form-grid">
          <fieldset>
            <legend>Priority</legend>
            {(["critical", "important", "helpful"] as const).map((key) => (
              <label className="ad-check" key={key}>
                <input
                  type="checkbox"
                  checked={draft.notifications.tiers[key]}
                  onChange={(e) =>
                    edit((p) => {
                      p.notifications.tiers[key] = e.target.checked;
                    })
                  }
                />
                <span className="ad-capitalize">{key}</span>
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Categories for this trip</legend>
            {(
              ["flights", "weather", "transit", "reservations", "preparation", "local"] as const
            ).map((key) => (
              <label className="ad-check" key={key}>
                <input
                  type="checkbox"
                  checked={draft.notifications.categories[key]}
                  onChange={(e) =>
                    edit((p) => {
                      p.notifications.categories[key] = e.target.checked;
                    })
                  }
                />
                <span className="ad-capitalize">{key}</span>
              </label>
            ))}
          </fieldset>
        </div>
        <label className="ad-check">
          <input
            type="checkbox"
            checked={draft.preparation}
            onChange={(e) =>
              edit((p) => {
                p.preparation = e.target.checked;
              })
            }
          />
          Contextual clothing and preparation suggestions
        </label>
      </section>
      <section className="ad-card">
        <h2>Quiet hours</h2>
        <label className="ad-check">
          <input
            type="checkbox"
            checked={draft.notifications.quietHours.enabled}
            onChange={(e) =>
              edit((p) => {
                p.notifications.quietHours.enabled = e.target.checked;
              })
            }
          />
          Keep push notifications quiet during these hours
        </label>
        <div className="ad-form-grid">
          <label className="ad-field">
            Start hour (0–23)
            <input
              type="number"
              min={0}
              max={23}
              value={draft.notifications.quietHours.start}
              onChange={(e) =>
                edit((p) => {
                  p.notifications.quietHours.start = Number(e.target.value);
                })
              }
            />
          </label>
          <label className="ad-field">
            End hour (0–23)
            <input
              type="number"
              min={0}
              max={23}
              value={draft.notifications.quietHours.end}
              onChange={(e) =>
                edit((p) => {
                  p.notifications.quietHours.end = Number(e.target.value);
                })
              }
            />
          </label>
          <label className="ad-field">
            Quiet-hours timezone
            <input
              value={draft.notifications.quietHours.timezone}
              placeholder="America/New_York"
              onChange={(e) =>
                edit((p) => {
                  p.notifications.quietHours.timezone = e.target.value;
                })
              }
            />
          </label>
        </div>
        <label className="ad-check">
          <input
            type="checkbox"
            checked={draft.notifications.quietHours.criticalException}
            onChange={(e) =>
              edit((p) => {
                p.notifications.quietHours.criticalException = e.target.checked;
              })
            }
          />
          Allow Critical alerts during quiet hours
        </label>
      </section>
      <section className="ad-card">
        <h2>Your location is optional</h2>
        <p>
          TravelDoss uses itinerary locations even when location access is off. You can optionally
          show your current position in a maps link. Coordinates stay in this browser session.
        </p>
        <p className="ad-muted">
          Permission: {initial.location}. Email and location data are not used for advertising or
          unrelated purposes.
        </p>
        <div className="ad-actions">
          <Button variant="outline" type="button" onClick={onLocation}>
            Use my location for directions
          </Button>
          <Button
            variant="outline"
            type="button"
            onClick={() => {
              edit((p) => {
                p.location = "disabled";
              });
            }}
          >
            Disable location
          </Button>
        </div>
        <p className="ad-muted">
          To revoke browser permission entirely, use your browser’s site settings.
        </p>
      </section>
      <div className="ad-actions">
        <Button
          disabled={busy}
          onClick={async () => {
            await onSave(draft);
            setSaved(true);
          }}
        >
          Save preferences
        </Button>
        {saved && <span role="status">Preferences saved</span>}
      </div>
    </div>
  );
}
