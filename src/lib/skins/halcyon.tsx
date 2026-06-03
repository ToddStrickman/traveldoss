import { makeSkin } from "./shared/makeSkin";

/** Halcyon — Amalfi, Mediterranean. */
export const halcyon = makeSkin(
  { id: "halcyon", codename: "Halcyon", personality: "Straight chilling on the beach", tags: ["Light", "Relaxed", "Minimal"] },
  {
    bg: "#FDF6EC",
    ink: "#293F4A",
    inkSoft: "#7E8E93",
    accent: "#D2683E",
    rule: "#EBDFCE",
    fontDisplay: "'Fraunces', Georgia, serif",
    fontBody: "'Mulish', ui-sans-serif, system-ui, sans-serif",
    fontUrl:
      "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;1,9..144,500&family=Mulish:wght@400;500;600&display=swap",
  },
);
