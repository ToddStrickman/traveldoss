import { makeSkin } from "./shared/makeSkin";

/** Marguerite — Paris, Editorial Magazine. */
export const marguerite = makeSkin(
  { id: "marguerite", codename: "Marguerite", personality: "Brings a journal and a film camera", tags: ["Editorial", "Romantic", "Light"] },
  {
    bg: "#FBFAF7",
    ink: "#16140F",
    inkSoft: "#6B6459",
    accent: "#B7472A",
    rule: "#E2DCCF",
    fontDisplay: "'Playfair Display', Georgia, serif",
    fontBody: "'Inter', ui-sans-serif, system-ui, sans-serif",
    fontUrl:
      "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,700;0,800;1,500&family=Inter:wght@400;500;600&display=swap",
  },
);
