import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("A5 print composition", () => {
  it("uses A5 portrait and the same flight/stay cards as screen views", () => {
    const css = readFileSync("src/styles.css", "utf8");
    const print = readFileSync("src/components/studio/PrintDossier.tsx", "utf8");
    expect(css).toContain("@page { size: A5 portrait;");
    expect(print).toContain("<FlightCard");
    expect(print).toContain("<StayCard");
    expect(print).toContain("td-print-markers");
  });

  it("runtime-caches public dossiers only", () => {
    const config = readFileSync("vite.config.ts", "utf8");
    expect(config).toContain('/^\\/t\\/[^/]+\\/?$/.test(url.pathname)');
    expect(config).toContain('cacheName: "td-html"');
    expect(config).toContain('/^\\/app\\//');
    expect(config).toContain('/^\\/invite\\//');
  });
});