import { makeSkin } from "./shared/makeSkin";

/** Marcello — New York, Art Deco. */
export const marcello = makeSkin(
  { id: "marcello", codename: "Marcello", personality: "Eats dinner at 10pm, never before" },
  {
    bg: "#0F1622",
    ink: "#F4ECD8",
    inkSoft: "#A8B0BE",
    accent: "#D4AF37",
    rule: "#C9A14A",
    fontDisplay: "'Cinzel', 'Playfair Display', serif",
    fontBody: "'Inter', ui-sans-serif, system-ui, sans-serif",
    fontUrl:
      "https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700&family=Inter:wght@400;500;600&display=swap",
  },
);
