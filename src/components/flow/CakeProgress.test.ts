import { describe, expect, it } from "bun:test";
import { CAKE_LAYERS, cakeCandleLit, cakeFlameLit, cakeLayersShown } from "./CakeProgress";

describe("cake assembly thresholds", () => {
  it("shows nothing before the work starts", () => {
    expect(cakeLayersShown(0)).toBe(0);
    expect(cakeLayersShown(-5)).toBe(0);
    expect(cakeLayersShown(Number.NaN)).toBe(0);
    expect(cakeCandleLit(0)).toBe(false);
    expect(cakeFlameLit(0)).toBe(false);
  });

  it("adds layers evenly across the first 80%", () => {
    expect(cakeLayersShown(1)).toBe(0);
    expect(cakeLayersShown(20)).toBe(1);
    expect(cakeLayersShown(40)).toBe(2);
    expect(cakeLayersShown(60)).toBe(3);
    expect(cakeLayersShown(80)).toBe(CAKE_LAYERS);
  });

  it("caps the layers and lights the candle, then the flame", () => {
    expect(cakeLayersShown(100)).toBe(CAKE_LAYERS);
    expect(cakeLayersShown(120)).toBe(CAKE_LAYERS);
    expect(cakeCandleLit(89)).toBe(false);
    expect(cakeCandleLit(90)).toBe(true);
    expect(cakeFlameLit(99)).toBe(false);
    expect(cakeFlameLit(100)).toBe(true);
  });
});
