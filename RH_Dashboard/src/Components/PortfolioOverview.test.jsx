import { render, screen } from "@testing-library/react";
import PortfolioOverview from "./PortfolioOverview";

const portfolioOverview = {
  total_equity: 10048.28,
  position_count: 33,
  unrealized_gain_loss: 1821.81,
  unrealized_return_percent: 22.15,
  estimated_annual_dividend_income: 2548.21,
  estimated_dividend_yield_percent: 3.84,
  largest_position: { ticker: "MSFT" },
  largest_position_weight_percent: 9.62,
  cost_basis_coverage: {
    coverage_percent: 86.3,
  },
  top_holdings: [],
  top_gainers: [
    {
      ticker: "INTC",
      name: "Intel",
      unrealized_gain_loss: 1131.58,
      unrealized_return_percent: 243.77,
    },
  ],
  top_losers: [],
};

describe("PortfolioOverview", () => {
  it("marks portfolio metric values with the no-wrap styling hook", () => {
    render(<PortfolioOverview data={portfolioOverview} />);

    expect(screen.getByText("$10048.28")).toHaveClass(
      "portfolio-metric-value"
    );
    expect(screen.getByText("+$1821.81")).toHaveClass(
      "portfolio-metric-value"
    );
  });

  it("shows top mover percentage as the primary value", () => {
    render(<PortfolioOverview data={portfolioOverview} />);

    expect(screen.getByText("243.77%")).toHaveClass("performance-primary-value");
    expect(screen.getByText("+$1131.58")).toHaveClass(
      "performance-secondary-value"
    );
  });

  it("explains cost basis coverage with an accessible tooltip", () => {
    render(<PortfolioOverview data={portfolioOverview} />);

    expect(
      screen.getByRole("button", { name: "What cost basis coverage means" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Cost basis coverage is the share of positions where purchase cost data is available. It is needed to calculate gain/loss and returns."
      )
    ).toHaveAttribute("role", "tooltip");
  });
});
