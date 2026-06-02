/**
 * The adaptation engine. Turns a TripBrief into the app's Block[] — neutral
 * when no destination is given, destination-tailored when one is. Deterministic
 * (no AI). Emits the flat shape: a `day` block followed by its `place` blocks.
 */
import type { Block } from "@/lib/skins/types";
import {
  type TripBrief, type DestinationType,
  FRAMEWORK_SECTIONS, SLOTS_PER_PACE, BUDGET_DAILY_BAND, BUDGET_SPLIT, packingList,
} from "./framework";

const TYPE_TRANSPORT: Record<DestinationType, string> = {
  city: "Lean on public transit and your own two feet; a transit day-pass usually beats single fares.",
  beach: "Short hops only — a bike, scooter, or one taxi a day keeps you in flip-flops.",
  island: "Build the day around ferry and boat times; they set the schedule, not you.",
  mountain: "Cable cars and shuttles save your legs for the trails; check first/last departures.",
  countryside: "A car earns its keep here; plan fuel stops and parking before you arrive.",
  "road-trip": "The drive is the trip — cap daily driving, bank rest stops, book fuel-route stays.",
  cruise: "Port time is short; pre-plan each stop and stay close enough to never miss the ship.",
  cultural: "Stay walkable to the old core; most of what you came for clusters tightly.",
  adventure: "Match transport to the activity and weather; keep a buffer for guided pickups.",
  mixed: "Pick one default mode per leg and don't overthink the rest.",
};
const TYPE_STAY: Record<DestinationType, string> = {
  city: "Base in a residential-but-central neighborhood — near transit, one step off the tourist strip.",
  beach: "Stay close enough to walk back wet; a sea view beats a pool.",
  island: "One base is plenty unless the island is large; hopping eats half-days.",
  mountain: "Pick a village with a grocer and a good dinner; access matters more than stars.",
  countryside: "A characterful stay with parking and breakfast beats a chain.",
  "road-trip": "Book stays on the route, not detours; one-nighters should be effortless to reach.",
  cruise: "The ship is your hotel — pick the cabin for the itinerary's sea days.",
  cultural: "Walkable to the historic center; drop bags and be out in minutes.",
  adventure: "Near the trailhead or operator; an early start beats a scenic-but-distant room.",
  mixed: "Split your nights to match the chapters of the trip.",
};
const TYPE_BOOK: Record<DestinationType, string> = {
  city: "Timed entry for the headline museum, one signature dinner, any skip-the-line pass.",
  beach: "A club/lounger for the peak day plus one boat trip; decide the rest on the sand.",
  island: "Ferries and the one excursion everyone does — both sell out in season.",
  mountain: "Cable-car windows, a hut if you're staying out, and any guided climb.",
  countryside: "A tasting or farm visit, and dinner anywhere with only a few tables.",
  "road-trip": "The car, the first and last night, and any ferry or permit on the route.",
  cruise: "Shore excursions for the ports you care about — they cap numbers fast.",
  cultural: "Timed tickets for the major sites and one performance or ceremony.",
  adventure: "Guides, permits, and gear rental — the bookings that gate everything.",
  mixed: "Whatever sells out: tickets, signature meals, gated transport.",
};
const TRAVELER_SAFETY: Record<string, string> = {
  solo: "Share your day's plan with someone, favor well-lit routes after dark, trust the exit instinct.",
  couple: "Agree a daily 'one thing each' so neither of you is just along for the ride.",
  family: "Build in downtime and snacks; one big thing a day beats three rushed ones.",
  group: "Assign a daily lead to kill decision paralysis; set a nightly meet time.",
  business: "Protect the meeting blocks first, then slot the city around them; keep transfers generous.",
  luxury: "Pre-arrange transfers and a local contact; let someone else hold the logistics.",
  nomad: "Scout reliable wifi and a quiet work window first; mornings work, afternoons explore.",
};

function interestPhrase(i: string[]): string {
  if (!i.length) return "a balanced mix of sights, food, and downtime";
  if (i.length === 1) return i[0];
  return i.slice(0, -1).join(", ") + " and " + i[i.length - 1];
}
function slotName(idx: number, total: number, interests: string[], here: string, hasDest: boolean): string {
  if (idx === 0) return hasDest ? `Morning — get your bearings in ${here}` : "Morning — get your bearings";
  if (idx === total - 1) return "Evening — dinner, unhurried";
  return `Afternoon — ${interests[(idx - 1) % Math.max(1, interests.length)] || "explore"}`;
}
function slotCategory(idx: number, total: number): "see" | "eat" {
  return idx === total - 1 ? "eat" : "see";
}

function sectionBody(key: string, b: TripBrief, here: string): string {
  const t = b.destinationType;
  switch (key) {
    case "getting-around": {
      let s = TYPE_TRANSPORT[t];
      if (b.mobility !== "full")
        s += " " + (b.mobility === "step-free"
          ? "Prioritize step-free routes and lifts; confirm access before committing to a stop."
          : "Build in extra time between stops and keep walking distances short.");
      return s;
    }
    case "where-to-stay": return TYPE_STAY[t];
    case "eat-and-drink":
      return (b.interests.includes("food")
        ? "Food is a headline here — anchor each day around one deliberate meal and graze the gaps. "
        : "Keep dining simple: one good sit-down a day, the rest on the move. ") +
        (b.budget === "shoestring" ? "Markets and counters give the best value and the best stories."
          : b.budget === "luxury" ? "Reserve the signature tables well ahead." : "Mix one splurge with honest local spots.");
    case "budget": {
      const [lo, hi] = BUDGET_DAILY_BAND[b.budget];
      const mid = Math.round((lo + hi) / 2);
      const split = Object.entries(BUDGET_SPLIT).map(([k, v]) => `${k} ${Math.round(mid * v)}`).join(" · ");
      return `Plan around ${b.currency} ${lo}–${hi} per person/day (≈ ${b.currency} ${mid * b.durationDays} for ${b.durationDays} days). A typical day: ${split}. Hold back 10–15%.`;
    }
    case "packing": return packingList(b.season, t).join(" · ");
    case "customs-safety": return (TRAVELER_SAFETY[b.travelers] ?? "") + " Learn the local greeting and tipping norm before you land.";
    case "book-ahead": return TYPE_BOOK[t];
    default: return "";
  }
}

export function adaptItinerary(b: TripBrief): Block[] {
  const dest = b.destination?.trim();
  const here = dest || "your destination";
  const blocks: Block[] = [];

  blocks.push({
    kind: "hero",
    title: dest || "Your trip",
    subtitle: dest
      ? `${b.durationDays} ${b.durationDays === 1 ? "day" : "days"} · ${b.season} · ${b.pace} pace`
      : "Add a destination to tailor every section",
    eyebrow: dest ? b.destinationType.replace("-", " ") : "A universal framework",
  });

  blocks.push({
    kind: "paragraph",
    text: dest
      ? `A ${b.pace}-paced, ${b.budget} ${b.destinationType} trip in ${here}, shaped around ${interestPhrase(b.interests)}. The plan front-loads what must be booked and leaves room to wander.`
      : "This is a destination-agnostic plan. Every section is a reusable slot. Add a destination and it rewrites itself — pacing, budget, packing, transport, dining, customs, and what to book first.",
  });

  const slots = SLOTS_PER_PACE[b.pace];
  for (let d = 0; d < b.durationDays; d++) {
    blocks.push({ kind: "day", n: d + 1, label: dest ? `Day ${d + 1} in ${here}` : `Day ${d + 1}` });
    for (let s = 0; s < slots; s++) {
      blocks.push({ kind: "place", name: slotName(s, slots, b.interests, here, !!dest), category: slotCategory(s, slots) });
    }
  }

  for (const sec of FRAMEWORK_SECTIONS) {
    blocks.push({ kind: "section", title: dest ? `${sec.title} · ${here}` : sec.title });
    blocks.push({ kind: "note", text: sectionBody(sec.key, b, here) });
  }

  return blocks;
}
