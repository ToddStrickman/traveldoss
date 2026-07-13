import { makeSkin } from "./shared/makeSkin";

/**
 * Aurelia — Roma & Sicilia; majolica on warm paper. Token-for-token from
 * the owner's reference dossier (Italy-Itinerary-Nov-2026): Marcellus
 * display (Roman inscription lettering), Figtree body, deep-navy ink and
 * cream paper. The reference's lemon (#E8B62A) fails AA as text on cream,
 * so the accent token is its cobalt (#2447A8) — the eyebrow color in the
 * original — keeping the seal/kicker roles readable.
 */
export const aurelia = makeSkin(
  {
    id: "aurelia",
    codename: "Aurelia",
    personality: "Files every confirmation number",
    tags: ["Light", "Classic", "Editorial"],
  },
  {
    bg: "#FBF9F4",
    ink: "#14213D",
    inkSoft: "#6B6F7B",
    accent: "#2447A8",
    rule: "#E3DFD4",
    fontDisplay: "'Marcellus', Georgia, serif",
    fontBody: "'Figtree', ui-sans-serif, system-ui, sans-serif",
    fontUrl:
      "https://fonts.googleapis.com/css2?family=Marcellus&family=Figtree:wght@400;500;600;700&display=swap",
  },
);
