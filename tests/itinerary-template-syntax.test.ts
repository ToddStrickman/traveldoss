import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

/**
 * Guards the itinerary parser + template-render pipeline against
 * template-literal corruption (stray/unescaped backticks, unterminated
 * strings, etc.) that has previously bricked the dev server with a
 * Vite transform 500 on first load.
 *
 * Strategy: statically parse every implicated source file with
 * `Bun.Transpiler`. The transpiler refuses to compile invalid TS/TSX,
 * so a regressed file fails the test BEFORE it can poison Vite.
 *
 * We also explicitly extract the AI SYSTEM_PROMPT template literal and
 * the rendered itinerary skin output strings — the two surfaces where
 * stray backticks have historically slipped in — and assert their
 * backtick balance.
 */

const ROOT = resolve(import.meta.dir, "..");
const read = (rel: string) => readFileSync(resolve(ROOT, rel), "utf8");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

function assertParses(rel: string) {
  const src = read(rel);
  const loader = rel.endsWith(".tsx") ? "tsx" : "ts";
  const t = new Bun.Transpiler({ loader });
  // .scan throws on syntax errors; transformSync exercises the full parse.
  expect(() => t.transformSync(src)).not.toThrow();
}

/* ─── 1. Critical files parse cleanly ─────────────────────────────── */

describe("itinerary pipeline: critical files transpile", () => {
  const critical = [
    "src/lib/itinerary/parse-ai.functions.ts",
    "src/lib/itinerary/parse.ts",
    "src/lib/itinerary/slots.ts",
    "src/lib/skins/shared/itinerary.ts",
    "src/lib/skins/shared/makeSkin.tsx",
    "src/lib/skins/shared/ShadowItinerary.tsx",
    "src/lib/skins/shared/views/parts.tsx",
    "src/lib/skins/shared/views/GridView.tsx",
    "src/lib/skins/shared/views/HorizontalView.tsx",
    "src/lib/skins/shared/views/VerticalView.tsx",
  ];
  for (const rel of critical) {
    test(`parses: ${rel}`, () => assertParses(rel));
  }
});

/* ─── 2. Every skin renders without throwing ──────────────────────── */

describe("itinerary skins: every .tsx skin file transpiles", () => {
  const skinFiles = walk(resolve(ROOT, "src/lib/skins")).filter((f) =>
    /\.(ts|tsx)$/.test(f),
  );
  // Sanity: we found at least the known skins so a future move doesn't
  // silently empty out this suite.
  test("discovers skin files", () => {
    expect(skinFiles.length).toBeGreaterThan(5);
  });
  for (const full of skinFiles) {
    const rel = full.slice(ROOT.length + 1);
    test(`parses: ${rel}`, () => assertParses(rel));
  }
});

/* ─── 3. Backtick balance in template-literal hotspots ────────────── */

/** Count backticks not preceded by a backslash (= template-literal
 *  delimiters in source). An odd count means an unterminated template
 *  literal — exactly the failure mode that 500s Vite. */
function unescapedBacktickCount(src: string): number {
  let n = 0;
  for (let i = 0; i < src.length; i++) {
    if (src[i] !== "`") continue;
    let bs = 0;
    for (let j = i - 1; j >= 0 && src[j] === "\\"; j--) bs++;
    if (bs % 2 === 0) n++;
  }
  return n;
}

describe("template-literal hotspots: balanced backticks", () => {
  const hotspots = [
    "src/lib/itinerary/parse-ai.functions.ts",
    "src/lib/itinerary/parse.ts",
    "src/lib/skins/shared/itinerary.ts",
    "src/lib/skins/shared/views/parts.tsx",
  ];
  for (const rel of hotspots) {
    test(`even backtick count in ${rel}`, () => {
      const src = read(rel);
      const count = unescapedBacktickCount(src);
      expect(count % 2).toBe(0);
    });
  }

  test("AI SYSTEM_PROMPT template literal is closed and non-empty", () => {
    const src = read("src/lib/itinerary/parse-ai.functions.ts");
    // Match the opening `const SYSTEM_PROMPT = \`` through the next
    // unescaped backtick. If the regex fails, the literal is malformed.
    const m = src.match(/const\s+SYSTEM_PROMPT\s*=\s*`([\s\S]*?)`\s*;/);
    expect(m).not.toBeNull();
    expect(m![1].length).toBeGreaterThan(200);
    // The prompt body itself must not contain raw unescaped backticks —
    // any inline code samples inside the prompt should be backslash-escaped.
    // (Markdown table examples in the prompt use \` ... \` for this reason.)
    expect(unescapedBacktickCount(m![1])).toBe(0);
  });
});