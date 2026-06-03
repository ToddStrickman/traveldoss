import { makeSkin } from "./shared/makeSkin";

/** Shishu — Kyoto, Japandi Minimal. */
export const shishu = makeSkin(
  { id: "shishu", codename: "Shishu", personality: "Plans the trip in a single Notes file", tags: ["Minimal", "Light", "Classic"] },
  {
    bg: "#F3EEE6",
    ink: "#2B2722",
    inkSoft: "#8A8175",
    accent: "#B06A4B",
    rule: "#DDD3C5",
    fontDisplay: "'Cormorant Garamond', Georgia, serif",
    fontBody: "'Inter', ui-sans-serif, system-ui, sans-serif",
    fontUrl:
      "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Inter:wght@400;500;600&display=swap",
  },
);
