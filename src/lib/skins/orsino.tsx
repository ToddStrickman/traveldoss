import { makeSkin } from "./shared/makeSkin";

/** Orsino — Brutalist nightmode, the original dark reference skin. */
export const orsino = makeSkin(
  {
    id: "orsino",
    codename: "Orsino",
    personality: "Books a late flight on purpose",
    tags: ["Brutalist", "Dark", "Bold"],
  },
  {
    bg: "#0a0a0a",
    ink: "#f4f1ea",
    inkSoft: "#8a857c",
    accent: "#ff3b1f",
    rule: "rgba(244,241,234,0.12)",
    fontDisplay: '"Archivo Black", "Inter", sans-serif',
    fontBody: '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace',
    fontUrl:
      "https://fonts.googleapis.com/css2?family=Archivo+Black&family=JetBrains+Mono:wght@300;400;500&display=swap",
  },
);