import { render, screen } from "@testing-library/react";
import MetricCard from "./MetricCard";

describe("MetricCard", () => {
  it("marks the metric value with the no-wrap styling hook", () => {
    render(
      <MetricCard
        label="Portfolio Value"
        value="$10048.28"
        footnote="33 positions"
      />
    );

    expect(screen.getByText("$10048.28")).toHaveClass("metric-card-value");
  });
});
