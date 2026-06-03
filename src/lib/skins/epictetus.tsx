import { makeSkin } from "./shared/makeSkin";

/** Epictetus — Stoic editorial, the original reference skin. */
export const epictetus = makeSkin(
  {
    id: "epictetus",
    codename: "Epictetus",
    personality: "Reads philosophy on the train",
    tags: ["Editorial", "Classic", "Light"],
  },
  {
    bg: "#f3efe7",
    ink: "#1a1813",
    inkSoft: "#6b6557",
    accent: "#7a2e1f",
    rule: "rgba(26,24,19,0.12)",
    fontDisplay: '"Cormorant Garamond", "EB Garamond", Georgia, serif',
    fontBody: '"Inter", ui-sans-serif, system-ui, sans-serif',
    fontUrl:
      "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400;1,500&family=Inter:wght@300;400;500&display=swap",
  },
);