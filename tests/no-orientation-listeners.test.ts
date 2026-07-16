/**
 * Spec 4 tripwire — after retiring the bubbles + gyroscope feature, no
 * live source file may reference device-orientation APIs. A regression
 * here would re-introduce the iOS motion-permission dialog and the
 * battery cost the spec pack §4 explicitly retired.
 *
 * We grep the source tree (not the built bundle) because bundle output
 * paths differ across environments. Sourcemaps and this test file
 * itself are excluded.
 */
import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";

const FORBIDDEN = [
  "deviceorientation",
  "DeviceMotionEvent",
  "requestPermission",
  "useDeviceTilt",
  "MobileBubbles",
  "GyroWallpaper",
];

describe("no orientation listeners", () => {
  for (const needle of FORBIDDEN) {
    it(`src/ has no reference to '${needle}'`, () => {
      let hits = "";
      try {
        hits = execSync(
          `rg -n --no-heading --glob '!**/*.test.*' ${JSON.stringify(needle)} src`,
          { encoding: "utf8" },
        );
      } catch {
        // rg exit 1 = no matches, which is what we want.
        return;
      }
      throw new Error(
        `Forbidden reference to '${needle}' found in src/:\n${hits}`,
      );
    });
  }
});