import { makeSkin } from "./shared/makeSkin";

/** Cassian — Lisbon, Boarding Pass. */
export const cassian = makeSkin(
  { id: "cassian", codename: "Cassian", personality: "Never books the return", tags: ["Bold", "Light", "Modern"] },
  {
    bg: "#F6F1E7",
    ink: "#1C2B3A",
    inkSoft: "#6C7A89",
    accent: "#C8472B",
    rule: "#D8CBB6",
    fontDisplay: "'Space Mono', ui-monospace, monospace",
    fontBody: "'Inter', ui-sans-serif, system-ui, sans-serif",
    fontUrl:
      "https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Inter:wght@400;500;600&display=swap",
  },
);
