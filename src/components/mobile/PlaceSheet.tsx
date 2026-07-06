/**
 * PlaceSheet — tap a place on mobile, get the acting surface.
 *
 * The dossier's place chips (address/phone/website) are dense pills built
 * for desktop hover reading. Mid-trip on a phone the jobs are different:
 * call the restaurant, open the map, check the site, copy the address.
 * This sheet gives each job a full-width, 44px+ tappable row.
 *
 * Read-mode only (editing keeps inline EditableText behavior), rendered
 * on demand from ActivityRow/ActivityCell taps under coarse pointers.
 */
import * as React from "react";
import { MapPin, Phone, Globe, Copy, Check, Clock } from "lucide-react";
import { TdSheet } from "@/components/mobile/TdSheet";
import type { Block } from "@/lib/skins/types";

type ActivityBlock = Extract<Block, { kind: "place" }>;

function mapsUrl(activity: ActivityBlock): string {
  const q = encodeURIComponent(
    [activity.name, activity.address].filter(Boolean).join(", "),
  );
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

/**
 * True in "mobile read" contexts: touch-primary devices OR phone-width
 * windows (mouse users at 375px get tap-rows too — hover chips are cramped
 * there regardless). SSR-safe (false on server).
 */
export function usePointerCoarse(): boolean {
  const [coarse, setCoarse] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse), (max-width: 767px)");
    setCoarse(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setCoarse(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return coarse;
}

export function PlaceSheet({
  activity,
  open,
  onOpenChange,
}: {
  activity: ActivityBlock;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [copied, setCopied] = React.useState(false);

  const copyAddress = async () => {
    if (!activity.address) return;
    try {
      await navigator.clipboard.writeText(activity.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — the row is still readable */
    }
  };

  const subtitle = [activity.time, activity.category]
    .filter(Boolean)
    .join(" · ");

  return (
    <TdSheet
      open={open}
      onOpenChange={onOpenChange}
      title={subtitle || "Place"}
    >
      <h3
        className="text-2xl leading-snug text-ink"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {activity.name}
      </h3>

      {activity.note ? (
        <p className="mt-3 text-[15px] italic leading-relaxed text-ink-soft">
          {activity.note}
        </p>
      ) : null}

      {activity.hours ? (
        <p className="mt-3 flex items-start gap-2 text-sm text-ink-soft">
          <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{activity.hours}</span>
        </p>
      ) : null}

      <div className="mt-6 flex flex-col border-t border-white/5">
        {activity.address ? (
          <ActionRow
            icon={<MapPin className="h-5 w-5" aria-hidden />}
            label="Open in Maps"
            detail={activity.address}
            href={mapsUrl(activity)}
          />
        ) : null}
        {activity.phone ? (
          <ActionRow
            icon={<Phone className="h-5 w-5" aria-hidden />}
            label="Call"
            detail={activity.phone}
            href={`tel:${activity.phone.replace(/[^\d+]/g, "")}`}
          />
        ) : null}
        {activity.website ? (
          <ActionRow
            icon={<Globe className="h-5 w-5" aria-hidden />}
            label="Website"
            detail={activity.website.replace(/^https?:\/\//, "")}
            href={activity.website}
            external
          />
        ) : null}
        {activity.address ? (
          <button
            type="button"
            onClick={copyAddress}
            className="flex min-h-14 w-full items-center gap-4 border-b border-white/5 py-3 text-left text-ink transition-colors last:border-b-0 hover:text-seal focus-visible:text-seal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-seal/60"
          >
            <span className="text-seal">
              {copied ? <Check className="h-5 w-5" aria-hidden /> : <Copy className="h-5 w-5" aria-hidden />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm">{copied ? "Copied" : "Copy address"}</span>
              <span className="block truncate text-xs text-ink-soft">{activity.address}</span>
            </span>
          </button>
        ) : null}
      </div>
    </TdSheet>
  );
}

function ActionRow({
  icon,
  label,
  detail,
  href,
  external,
}: {
  icon: React.ReactNode;
  label: string;
  detail: string;
  href: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      className="flex min-h-14 w-full items-center gap-4 border-b border-white/5 py-3 text-ink transition-colors last:border-b-0 hover:text-seal focus-visible:text-seal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-seal/60"
    >
      <span className="text-seal">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm">{label}</span>
        <span className="block truncate text-xs text-ink-soft">{detail}</span>
      </span>
    </a>
  );
}
