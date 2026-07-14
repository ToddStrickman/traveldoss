import { describe, it, expect } from "bun:test";
import { render } from "@testing-library/react";
import { GenerationProgress } from "./IngestionModal";

// Queries come from the render result rather than the `screen` re-export:
// @testing-library/react v16 sources `screen` types from the optional
// @testing-library/dom peer, which this project doesn't install.

describe("GenerationProgress", () => {
  it("renders all steps with correct labels and statuses", () => {
    const { getByText, getAllByText } = render(
      <GenerationProgress
        phase="drafting"
        destination="Kyoto"
        duration="7 days"
        startDate="2025-04-10"
        travelers="2 adults"
        pace="relaxed"
        budget="luxury"
        interests={["temples", "food", "nature"]}
        prompt="A relaxed week in Kyoto with temples and food"
      />
    );

    expect(getByText("Using these values")).toBeDefined();
    expect(getByText("Kyoto")).toBeDefined();
    expect(getByText("7 days")).toBeDefined();
    expect(getByText("2025-04-10")).toBeDefined();
    expect(getByText("2 adults")).toBeDefined();
    expect(getByText("relaxed")).toBeDefined();
    expect(getByText("luxury")).toBeDefined();
    expect(getByText("temples, food, nature")).toBeDefined();

    expect(getByText("Researching & drafting")).toBeDefined();
    expect(getByText("Structuring & enriching")).toBeDefined();
    expect(getByText("Ready")).toBeDefined();

    expect(getByText("Working")).toBeDefined();
    expect(getAllByText("Queued").length).toBe(2);
  });

  it("shows default values when props are empty", () => {
    const { getByText } = render(
      <GenerationProgress
        phase="idle"
        destination=""
        duration=""
        startDate=""
        travelers=""
        pace=""
        budget=""
        interests={[]}
        prompt=""
      />
    );

    expect(getByText("— to infer from brief")).toBeDefined();
    expect(getByText("— flexible")).toBeDefined();
    expect(getByText("5 days (default)")).toBeDefined();
    expect(getByText("2 adults (default)")).toBeDefined();
    expect(getByText("balanced (default)")).toBeDefined();
    expect(getByText("moderate (default)")).toBeDefined();
    expect(getByText("— none specified")).toBeDefined();
  });

  it("marks the active step correctly for each phase", () => {
    const phases = ["drafting", "structuring", "done"] as const;
    for (const phase of phases) {
      const { queryAllByText, unmount } = render(
        <GenerationProgress
          phase={phase}
          destination="Paris"
          duration="5 days"
          startDate="2025-06-01"
          travelers="1 adult"
          pace="balanced"
          budget="moderate"
          interests={["museums"]}
          prompt="Paris museums"
        />
      );

      const working = queryAllByText("Working");
      expect(working.length).toBeLessThanOrEqual(1);
      unmount();
    }
  });
});
