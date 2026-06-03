import { makeSkin } from "./shared/makeSkin";

/** Vesper — Tokyo, Dark Noir. */
export const vesper = makeSkin(
  { id: "vesper", codename: "Vesper", personality: "Books the red-eye on purpose", tags: ["Dark", "Minimal", "Modern"] },
  {
    bg: "#0E0F12",
    ink: "#F2F3F5",
    inkSoft: "#9AA0A8",
    accent: "#E4567B",
    rule: "#2A2E35",
    fontDisplay: "'Shippori Mincho', 'Playfair Display', serif",
    fontBody: "'Inter', ui-sans-serif, system-ui, sans-serif",
    fontUrl:
      "https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@500;700&family=Inter:wght@400;500;600&display=swap",
  },
);
