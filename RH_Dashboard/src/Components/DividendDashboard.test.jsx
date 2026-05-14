import { render, screen } from "@testing-library/react";
import DividendDashboard from "./DividendDashboard";

const dividendDashboardData = {
  headline: {
    estimated_annual_income: 240,
    projected_annual_income: 260,
    estimated_monthly_income: 20,
    year_to_date_income: 120,
    portfolio_yield_percent: 12,
    yield_on_cost_percent: 16,
  },
  growth: {
    current_year: 2026,
    current_year_total: 120,
    previous_year: 2025,
    previous_year_total: 100,
    year_over_year_change: 20,
    year_over_year_change_percent: 20,
    trend: "up",
  },
  income_quality: {
    payer_count: 3,
    modeled_position_count: 3,
    unmodeled_position_count: 1,
    modeled_position_coverage_percent: 75,
    months_with_income: 12,
    monthly_income_consistency_percent: 100,
    payment_count: 8,
    received_payment_count: 4,
    estimated_payment_count: 4,
    next_payment: {
      ticker: "AAA",
      date: "2026-05-15",
      eligibility_date: "2026-04-30",
      amount: 40,
      status: "estimated",
    },
  },
  concentration: {
    top_payer: {
      ticker: "AAA",
      projected_total: 120,
      income_share_percent: 50,
      payment_count: 4,
    },
    top_payer_income_share_percent: 50,
    top_three_income_share_percent: 100,
    positions: [
      {
        ticker: "AAA",
        projected_total: 120,
        income_share_percent: 50,
        payment_count: 4,
      },
      {
        ticker: "BBB",
        projected_total: 84,
        income_share_percent: 35,
        payment_count: 4,
      },
    ],
  },
  monthly_cash_flow: [
    {
      month: "05",
      month_name: "May",
      received: 5,
      estimated: 35,
      total: 40,
      payer_count: 2,
      payment_count: 2,
    },
  ],
  risk_flags: [
    {
      code: "income_concentration",
      severity: "warning",
      message: "One holding provides 50.00% of modeled dividend income.",
    },
  ],
  research_checks: [
    {
      label: "Income timing",
      status: "tracked",
      message: "Received and estimated pay dates are modeled from dividend history.",
    },
    {
      label: "Payout ratio and cash-flow coverage",
      status: "needs_fundamental_data",
      message: "Issuer earnings and free-cash-flow coverage are not available.",
    },
  ],
};

describe("DividendDashboard", () => {
  it("renders dividend income, quality, concentration, and safety data gaps", () => {
    render(<DividendDashboard data={dividendDashboardData} />);

    expect(screen.getByRole("heading", { name: "Dividend Dashboard" })).toBeInTheDocument();
    expect(screen.getByText("Forward Annual Income")).toBeInTheDocument();
    expect(screen.getByText("$240.00")).toBeInTheDocument();
    expect(screen.getByText("Yield On Cost")).toBeInTheDocument();
    expect(screen.getByText("16.00%")).toBeInTheDocument();
    expect(screen.getByText("Next Ex-Date")).toBeInTheDocument();
    expect(screen.getByText("AAA ex Apr 30")).toBeInTheDocument();
    expect(screen.getByText("12 of 12 months with income")).toBeInTheDocument();
    expect(screen.getByText("Top payer provides 50.00%")).toBeInTheDocument();
    expect(screen.getByText("Payout ratio and cash-flow coverage")).toBeInTheDocument();
    expect(screen.getByText("Needs fundamental data")).toBeInTheDocument();
    expect(screen.getByText(/One holding provides 50.00%/i)).toBeInTheDocument();
  });
});
