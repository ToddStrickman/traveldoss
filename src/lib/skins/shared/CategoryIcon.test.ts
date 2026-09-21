import { describe, expect, it } from "bun:test";
import {
  resolveCategoryIcon,
  PlaneIcon,
  TrainIcon,
  BoatIcon,
  TramIcon,
  BusIcon,
  TransitIcon,
  CocktailIcon,
  RestaurantIcon,
  BeachIcon,
  ShoppingIcon,
  LandmarkIcon,
  CultureIcon,
  WalkingIcon,
} from "./CategoryIcon";

describe("resolveCategoryIcon", () => {
  it("shows a plane for airport runs, not a car", () => {
    expect(resolveCategoryIcon("transit", "Arrival at JFK Terminal 4")).toBe(PlaneIcon);
    expect(resolveCategoryIcon("transit", "Transfer to the airport")).toBe(PlaneIcon);
  });

  it("picks train / boat / tram / bus from the stop text", () => {
    expect(resolveCategoryIcon("transit", "Eurostar to Paris")).toBe(TrainIcon);
    expect(resolveCategoryIcon("transit", "Ferry to Capri")).toBe(BoatIcon);
    expect(resolveCategoryIcon("transit", "Vaporetto along the Grand Canal")).toBe(BoatIcon);
    expect(resolveCategoryIcon("transit", "Metro to Trastevere")).toBe(TramIcon);
    expect(resolveCategoryIcon("transit", "Shuttle bus to the hotel")).toBe(BusIcon);
  });

  it("keeps the car for taxis, transfers, and unrecognised transit", () => {
    expect(resolveCategoryIcon("transit", "Taxi to the hotel")).toBe(TransitIcon);
    expect(resolveCategoryIcon("transit", "Private transfer")).toBe(TransitIcon);
  });

  it("refines dining and sightseeing stops", () => {
    expect(resolveCategoryIcon("restaurant", "Aperitivo at Bar del Fico")).toBe(CocktailIcon);
    expect(resolveCategoryIcon("restaurant", "Dinner at Roscioli")).toBe(RestaurantIcon);
    expect(resolveCategoryIcon("culture", "Afternoon at the beach")).toBe(BeachIcon);
    expect(resolveCategoryIcon("see", "Sunset viewpoint over the city")).toBe(LandmarkIcon);
    expect(resolveCategoryIcon("do", "Souvenir shopping at the market")).toBe(ShoppingIcon);
  });

  it("walking directions get the walking figure", () => {
    expect(resolveCategoryIcon("transit", "Walk to the pantheon")).toBe(WalkingIcon);
  });

  it("falls back to the broad category icon and never invents one", () => {
    expect(resolveCategoryIcon("culture", "Vatican Museums")).toBe(CultureIcon);
    expect(resolveCategoryIcon("transit")).toBe(TransitIcon);
    expect(resolveCategoryIcon("nonsense" as never, "anything")).toBeNull();
    expect(resolveCategoryIcon(undefined, "airport")).toBeNull();
  });
});
