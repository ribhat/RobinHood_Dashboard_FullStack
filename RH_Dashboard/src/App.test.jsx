import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { fetchJson, postJson } from "./api";

vi.mock("./api", () => ({
  fetchJson: vi.fn(),
  postJson: vi.fn(),
}));

vi.mock("./Components/HoldingsPieChart", () => ({
  default: ({ data }) => (
    <div data-testid="holdings-chart">
      Holdings chart {Object.keys(data || {}).length}
    </div>
  ),
  HoldingsTable: ({ data }) => (
    <div data-testid="holdings-table">{Object.keys(data || {}).join(" ")}</div>
  ),
}));

vi.mock("./Components/DividendChart", () => ({
  default: ({ chartType, comparePreviousYear, selectedYear }) => (
    <div data-testid="dividend-chart">
      {selectedYear} {chartType} {comparePreviousYear ? "compared" : "solo"}
    </div>
  ),
}));

vi.mock("./Components/PortfolioSummary", () => ({
  default: () => <div data-testid="portfolio-summary">Portfolio summary</div>,
}));

vi.mock("./Components/PortfolioOverview", () => ({
  default: () => <div data-testid="portfolio-overview">Portfolio health</div>,
}));

vi.mock("./Components/IncomeProjection", () => ({
  default: () => <div data-testid="income-projection">Income projection</div>,
}));

vi.mock("./Components/IncomeCalendar", () => ({
  default: () => <div data-testid="income-calendar">Income calendar</div>,
}));

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const buildDashboardResponse = (year = new Date().getFullYear()) => ({
  portfolio: {
    equity: "1000.00",
    dividends_this_month: 4.25,
    dividends_this_year: 12.75,
  },
  portfolio_overview: {
    total_equity: 1000,
    position_count: 1,
    cost_basis_coverage: {
      unavailable_position_count: 1,
    },
  },
  holdings: {
    SCHD: {
      name: "Schwab US Dividend Equity ETF",
      quantity: "5",
      equity: "300.00",
      price: "60.00",
    },
    MSFT: {
      name: "Microsoft Corporation",
      quantity: "2",
      equity: "700.00",
      price: "350.00",
    },
  },
  yearly_dividends: {
    months: monthNames,
    dividends: [4.25, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    total: 4.25,
  },
  income_projection: {
    current_year: year,
    current_year_collected: 4.25,
    previous_year: year - 1,
    previous_year_actual_total: 20,
    previous_year_monthly_average: 1.67,
    remaining_to_previous_year_actual: 15.75,
    current_holdings_estimate: {
      total: 12,
      monthly_average: 1,
      modeled_ticker_count: 1,
      unmodeled_tickers: [],
      external_lookup_enabled: false,
      external_lookup_used: [],
      rate_limited_tickers: [],
      details: [],
    },
  },
  income_calendar: {
    year,
    as_of_date: `${year}-05-04`,
    months: [
      {
        month: "05",
        month_name: "May",
        total: 20.63,
        received: 0.9,
        estimated: 19.73,
        items: [
          {
            ticker: "SCHD",
            date: `${year}-05-01`,
            amount: 0.9,
            status: "received",
          },
          {
            ticker: "JEPI",
            date: `${year}-05-05`,
            amount: 5.25,
            status: "estimated",
          },
          {
            ticker: "JEPQ",
            date: `${year}-05-05`,
            amount: 5.26,
            status: "estimated",
          },
        ],
      },
    ],
    summary: {
      current_month_income: 20.63,
      current_month_received: 0.9,
      current_month_estimated: 19.73,
      remaining_estimated_annual_income: 227.71,
      total_projected_annual_income: 334.71,
    },
  },
  selected_year: year,
  generated_at: `${year}-04-28T19:30:00+00:00`,
  warnings: [
    {
      code: "missing_cost_basis",
      severity: "info",
      message: "Cost basis is unavailable for 1 position(s), so gain/loss totals may be partial.",
    },
  ],
  data_sources: {
    robinhood: { enabled: true },
    polygon: { enabled: false, used_for_tickers: [], rate_limited_tickers: [] },
  },
  partial_data_available: true,
});

const buildYearlyDividends = () => ({
  months: monthNames,
  dividends: [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  total: 2,
});

const mockAuthenticatedDashboard = () => {
  const currentYear = new Date().getFullYear();

  fetchJson.mockImplementation((path) => {
    if (path === "/api/auth/status") {
      return Promise.resolve({ authenticated: true });
    }

    if (path === `/api/dashboard?year=${currentYear}`) {
      return Promise.resolve(buildDashboardResponse(currentYear));
    }

    if (path === `/api/dividends/yearly/${currentYear - 1}`) {
      return Promise.resolve(buildYearlyDividends());
    }

    return Promise.reject(new Error(`Unhandled API path: ${path}`));
  });
  postJson.mockResolvedValue({ authenticated: false });
};

describe("App", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it("shows dashboard status, sources, and backend data notes after load", async () => {
    mockAuthenticatedDashboard();

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Portfolio Dashboard" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Overview" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(await screen.findByText("Robinhood connected")).toBeInTheDocument();
    expect(await screen.findAllByText("Partial data")).toHaveLength(2);
    expect(
      screen.getByText(/Cost basis is unavailable for 1 position/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Robinhood portfolio, holdings, and dividend history/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reports" })).toBeDisabled();
  });

  it("switches views and remembers dividend controls while loading comparison data", async () => {
    const user = userEvent.setup();
    const currentYear = new Date().getFullYear();
    mockAuthenticatedDashboard();

    render(<App />);

    await screen.findByText("Robinhood connected");
    await user.click(screen.getByRole("button", { name: "Dividends" }));
    expect(
      screen.getByRole("heading", { name: "Dividends" })
    ).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Dividend chart type"), "Line Graph");
    await user.click(screen.getByLabelText("Compare Previous Year"));

    await waitFor(() => {
      expect(fetchJson).toHaveBeenCalledWith(
        `/api/dividends/yearly/${currentYear - 1}`
      );
    });

    const storedPreferences = JSON.parse(
      window.localStorage.getItem("rh-dashboard:preferences")
    );
    expect(storedPreferences).toMatchObject({
      activeView: "dividends",
      chartType: "Line Graph",
      comparePreviousYear: true,
    });
  });

  it("filters holdings by ticker or company name", async () => {
    const user = userEvent.setup();
    mockAuthenticatedDashboard();

    render(<App />);

    await screen.findByText("Robinhood connected");
    await user.click(screen.getByRole("button", { name: "Holdings" }));
    expect(screen.getByTestId("holdings-table")).toHaveTextContent("SCHD");
    expect(screen.getByTestId("holdings-table")).toHaveTextContent("MSFT");

    await user.type(screen.getByLabelText("Search holdings"), "schwab");

    expect(screen.getByTestId("holdings-table")).toHaveTextContent("SCHD");
    expect(screen.getByTestId("holdings-table")).not.toHaveTextContent("MSFT");
  });

  it("shows income calendar summary values in the analytics top cards", async () => {
    const user = userEvent.setup();
    mockAuthenticatedDashboard();

    render(<App />);

    await screen.findByText("Robinhood connected");
    await user.click(screen.getByRole("button", { name: "Analytics" }));

    expect(screen.getByRole("heading", { name: "Dividend Income Outlook" })).toBeInTheDocument();
    expect(screen.getByText("Next Expected Payment")).toBeInTheDocument();
    expect(screen.getByText("$10.51")).toBeInTheDocument();
    expect(screen.getByText("JEPI, JEPQ on May 5")).toBeInTheDocument();
    expect(screen.getByText("Current Month Income")).toBeInTheDocument();
    expect(screen.getByText("$20.63")).toBeInTheDocument();
    expect(
      screen.getByText("$0.90 received / $19.73 estimated remaining")
    ).toBeInTheDocument();
    expect(screen.getByText("Remaining Estimated Annual Income")).toBeInTheDocument();
    expect(screen.getByText("$227.71")).toBeInTheDocument();
    expect(screen.getByText("$334.71 projected total")).toBeInTheDocument();
    expect(screen.queryByText("Modeled in calendar")).not.toBeInTheDocument();
    expect(screen.queryByText("See income calendar")).not.toBeInTheDocument();
    expect(screen.queryByText("See projection")).not.toBeInTheDocument();
  });

  it("refreshes the dashboard snapshot on demand", async () => {
    const user = userEvent.setup();
    const currentYear = new Date().getFullYear();
    mockAuthenticatedDashboard();

    render(<App />);

    await screen.findByText("Robinhood connected");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Refresh" })).toBeEnabled();
    });
    await user.click(screen.getByRole("button", { name: "Refresh" }));

    await waitFor(() => {
      const dashboardCalls = fetchJson.mock.calls.filter(
        ([path]) => path === `/api/dashboard?year=${currentYear}`
      );
      expect(dashboardCalls).toHaveLength(2);
    });
  });
});
