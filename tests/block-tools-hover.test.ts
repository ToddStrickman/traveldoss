import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Regression test for the TravelDoss block tools hover region.
 *
 * Bug history: when the editor's per-block tool column (drag handle, +, trash)
 * lived only inside `.tds-block-tools` at `left: -44px`, moving the cursor
 * from the editable text into the gutter to click a tool would leave the
 * `.tds-block-shell` hover state, fade the tools out, and make them
 * impossible to click.
 *
 * The fix extends the shell's hover hit-area into the gutter via a
 * `::before` pseudo-element with `pointer-events: auto`. This test asserts
 * the CSS still encodes that invariant so a future refactor of skin.css
 * cannot silently re-introduce the regression.
 */

const css = readFileSync(
  resolve(import.meta.dir, "../src/lib/skins/shared/skin.css"),
  "utf8",
);

// Strip CSS comments so block-matching regexes don't trip on /* … */ text.
const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");

function ruleBody(selectorPattern: RegExp): string {
  const match = stripped.match(
    new RegExp(selectorPattern.source + "\\s*\\{([^}]*)\\}", "m"),
  );
  if (!match) throw new Error(`Rule not found: ${selectorPattern}`);
  return match[1];
}

describe("block tools gutter hover invariants", () => {
  test("editing mode extends the shell hit-area into the left gutter", () => {
    const body = ruleBody(
      /\.tds\[data-editing="true"\]\s+\.tds-block-shell::before/,
    );
    expect(body).toMatch(/content:\s*""/);
    expect(body).toMatch(/position:\s*absolute/);
    expect(body).toMatch(/pointer-events:\s*auto/);

    const leftMatch = body.match(/left:\s*(-?\d+)px/);
    const widthMatch = body.match(/width:\s*(\d+)px/);
    expect(leftMatch).not.toBeNull();
    expect(widthMatch).not.toBeNull();
    const left = Number(leftMatch![1]);
    const width = Number(widthMatch![1]);

    // Must extend leftward into the gutter and be wide enough to cover the
    // floating tool column (which sits at left: -44px and is ~22px wide).
    expect(left).toBeLessThanOrEqual(-44);
    expect(left + width).toBeGreaterThanOrEqual(0);
  });

  test("tool column sits inside the extended hit-area", () => {
    const body = ruleBody(/\.tds-block-tools(?!:)/);
    const leftMatch = body.match(/left:\s*(-?\d+)px/);
    expect(leftMatch).not.toBeNull();
    const toolsLeft = Number(leftMatch![1]);

    const shellBefore = ruleBody(
      /\.tds\[data-editing="true"\]\s+\.tds-block-shell::before/,
    );
    const shellLeft = Number(shellBefore.match(/left:\s*(-?\d+)px/)![1]);

    // The gutter extension must start at or beyond where the tools sit,
    // otherwise the cursor crosses an uncovered band and hover drops.
    expect(shellLeft).toBeLessThanOrEqual(toolsLeft);
  });

  test("hover and focus-within reveal and enable the tool column", () => {
    // Combined selector keeps both triggers in a single rule so we can't
    // accidentally drop one half during a refactor.
    const match = stripped.match(
      /\.tds-block-shell:hover\s+\.tds-block-tools\s*,\s*\.tds-block-shell:focus-within\s+\.tds-block-tools\s*\{([^}]*)\}/,
    );
    expect(match).not.toBeNull();
    const body = match![1];
    expect(body).toMatch(/opacity:\s*1\b/);
    expect(body).toMatch(/pointer-events:\s*auto/);
  });

  test("tool column defaults to non-interactive until the shell is hovered", () => {
    const body = ruleBody(/\.tds-block-tools(?!:)/);
    expect(body).toMatch(/opacity:\s*0\b/);
    expect(body).toMatch(/pointer-events:\s*none/);
  });
});