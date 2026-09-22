import { useEffect, useMemo, useState } from "react";
import type { Block, TripView } from "../types";
import { getTripLogistics } from "./logistics";

export function NowNext({ trip, blocks, placement }: { trip: TripView; blocks: Block[]; placement: "grid" | "vertical" }) {
  const logistics = useMemo(() => getTripLogistics(trip, blocks), [trip, blocks]);
  const today = logistics.days.find((day) => day.today);
  const [visibleDay, setVisibleDay] = useState(today?.index ?? 0);

  useEffect(() => {
    if (placement !== "vertical" || typeof IntersectionObserver === "undefined") return;
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('.tds-vertical section[data-block="day"]'));
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (visible) setVisibleDay(nodes.indexOf(visible.target as HTMLElement));
    }, { rootMargin: "-56px 0px -70% 0px" });
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [placement]);

  if (!today) return null;
  const day = logistics.days[placement === "grid" ? today.index : visibleDay] ?? today;
  const stay = logistics.stays.find((item) => item.fromDay <= day.index && item.toDay > day.index);
  const nextFlight = logistics.flights.find((item) => item.departureDay >= day.index);
  const jumpToday = () => {
    const nodes = document.querySelectorAll<HTMLElement>('section[data-block="day"]');
    nodes[today.index]?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  };
  return (
    <aside className={`tds-now-next tds-now-next--${placement}`} data-print="hide" aria-label="Now and next">
      <div><span>{day.today ? "Today" : `Day ${day.n}`}</span><strong>{stay?.hotel.name ?? "No stay booked"}</strong></div>
      {nextFlight ? <p>Next · {[nextFlight.flight.from, nextFlight.flight.to].filter(Boolean).join(" → ")} {nextFlight.flight.departTime || ""}</p> : <p>No upcoming flight</p>}
      {placement === "vertical" && !day.today ? <button type="button" className="tap" onClick={jumpToday}>Today</button> : null}
    </aside>
  );
}