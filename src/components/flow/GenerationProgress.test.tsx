/// <reference types="bun" />
import { render, screen } from "@testing-library/react";
import { GenerationProgress } from "./IngestionModal";

describe("GenerationProgress", () => {
  it("renders all steps with correct labels and statuses", () => {
    render(
      <GenerationProgress
        phase="draft"
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

    expect(screen.getByText("Using these values")).toBeDefined();
    expect(screen.getByText("Kyoto")).toBeDefined();
    expect(screen.getByText("7 days")).toBeDefined();
    expect(screen.getByText("2025-04-10")).toBeDefined();
    expect(screen.getByText("2 adults")).toBeDefined();
    expect(screen.getByText("relaxed")).toBeDefined();
    expect(screen.getByText("luxury")).toBeDefined();
    expect(screen.getByText("temples, food, nature")).toBeDefined();

    expect(screen.getByText("Researching the destination")).toBeDefined();
    expect(screen.getByText("Drafting your itinerary")).toBeDefined();
    expect(screen.getByText("Verifying venues")).toBeDefined();
    expect(screen.getByText("Ready to review")).toBeDefined();

    expect(screen.getByText("Done")).toBeDefined();
    expect(screen.getByText("Working")).toBeDefined();
    expect(screen.getAllByText("Queued").length).toBe(2);
  });

  it("shows default values when props are empty", () => {
    render(
      <GenerationProgress
        phase="research"
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

    expect(screen.getByText("— to infer from brief")).toBeDefined();
    expect(screen.getByText("— flexible")).toBeDefined();
    expect(screen.getByText("5 days (default)")).toBeDefined();
    expect(screen.getByText("2 adults (default)")).toBeDefined();
    expect(screen.getByText("balanced (default)")).toBeDefined();
    expect(screen.getByText("moderate (default)")).toBeDefined();
    expect(screen.getByText("— none specified")).toBeDefined();
  });

  it("marks the active step correctly for each phase", () => {
    const phases = ["research", "draft", "enrich", "done"] as const;
    for (const phase of phases) {
      const { unmount } = render(
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

      const working = screen.queryAllByText("Working");
      expect(working.length).toBe(1);
      unmount();
    }
  });
});
