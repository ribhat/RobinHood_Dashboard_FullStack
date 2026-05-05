export const monthNames = [
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

export const currentYear = new Date().getFullYear();

export const currentYearDividends = {
  months: monthNames,
  dividends: [18.72, 22.35, 19.5, 28.44, 21.1, 35.8, 24.95, 27.4, 31.2, 26.75, 29.9, 34.6],
  total: 320.71,
};

export const previousYearDividends = {
  months: monthNames,
  dividends: [14.25, 18.8, 17.9, 21.4, 19.1, 26.75, 20.3, 22.9, 24.4, 23.2, 25.1, 28.6],
  total: 262.7,
};

export const holdings = {
  SCHD: {
    name: "Schwab US Dividend Equity ETF",
    quantity: "92.1450",
    equity: "7200.83",
    price: "78.15",
    average_buy_price: "70.25",
  },
  MSFT: {
    name: "Microsoft Corporation",
    quantity: "18.2500",
    equity: "7825.41",
    price: "428.79",
    average_buy_price: "345.12",
  },
  AAPL: {
    name: "Apple Inc.",
    quantity: "21.0000",
    equity: "3981.18",
    price: "189.58",
    average_buy_price: "171.35",
  },
  O: {
    name: "Realty Income Corporation",
    quantity: "64.0000",
    equity: "3564.80",
    price: "55.70",
    average_buy_price: "51.15",
  },
};

export const dashboardData = {
  portfolio: {
    equity: "22572.22",
    dividends_this_month: 28.44,
    dividends_this_year: currentYearDividends.total,
  },
  portfolio_overview: {
    total_equity: 22572.22,
    position_count: 4,
    unrealized_gain_loss: 2148.36,
    unrealized_return_percent: 10.52,
    estimated_annual_dividend_income: 792.44,
    estimated_dividend_yield_percent: 3.51,
    largest_position: {
      ticker: "MSFT",
      name: "Microsoft Corporation",
      equity: 7825.41,
    },
    largest_position_weight_percent: 34.67,
    cost_basis_coverage: {
      covered_position_count: 4,
      unavailable_position_count: 0,
      coverage_percent: 100,
    },
    top_holdings: [
      {
        ticker: "MSFT",
        name: "Microsoft Corporation",
        equity: 7825.41,
        weight_percent: 34.67,
      },
      {
        ticker: "SCHD",
        name: "Schwab US Dividend Equity ETF",
        equity: 7200.83,
        weight_percent: 31.9,
      },
      {
        ticker: "AAPL",
        name: "Apple Inc.",
        equity: 3981.18,
        weight_percent: 17.64,
      },
    ],
    top_gainers: [
      {
        ticker: "MSFT",
        name: "Microsoft Corporation",
        unrealized_gain_loss: 1527.98,
        unrealized_return_percent: 24.26,
      },
      {
        ticker: "SCHD",
        name: "Schwab US Dividend Equity ETF",
        unrealized_gain_loss: 727.86,
        unrealized_return_percent: 11.24,
      },
    ],
    top_losers: [
      {
        ticker: "O",
        name: "Realty Income Corporation",
        unrealized_gain_loss: -33.6,
        unrealized_return_percent: -0.93,
      },
    ],
  },
  holdings,
  yearly_dividends: currentYearDividends,
  income_projection: {
    current_year: currentYear,
    current_year_collected: currentYearDividends.total,
    previous_year: currentYear - 1,
    previous_year_actual_total: previousYearDividends.total,
    previous_year_monthly_average: 21.89,
    remaining_to_previous_year_actual: 0,
    current_holdings_estimate: {
      total: 792.44,
      monthly_average: 66.04,
      modeled_ticker_count: 4,
      unmodeled_tickers: [],
      external_lookup_enabled: true,
      external_lookup_used: ["O"],
      rate_limited_tickers: [],
      details: [
        {
          ticker: "SCHD",
          quantity: 92.145,
          opened_at: `${currentYear - 3}-05-14`,
          projected_total: 342.84,
          projected_payments: [
            {
              expected_date: `${currentYear}-06-24`,
              amount: 86.7,
              rate: 0.94,
              source: "estimated",
              label: "Estimated quarterly dividend",
            },
          ],
        },
      ],
    },
  },
  income_calendar: {
    year: currentYear,
    as_of_date: `${currentYear}-04-20`,
    summary: {
      current_month_income: 28.44,
      current_month_received: 28.44,
      current_month_estimated: 0,
      remaining_estimated_annual_income: 471.73,
      total_projected_annual_income: 792.44,
    },
    months: [
      {
        month: "04",
        month_name: "April",
        total: 28.44,
        received: 28.44,
        estimated: 0,
        items: [
          {
            ticker: "O",
            date: `${currentYear}-04-15`,
            amount: 18.44,
            status: "received",
          },
          {
            ticker: "AAPL",
            date: `${currentYear}-04-18`,
            amount: 10,
            status: "received",
          },
        ],
      },
      {
        month: "06",
        month_name: "June",
        total: 86.7,
        received: 0,
        estimated: 86.7,
        items: [
          {
            ticker: "SCHD",
            date: `${currentYear}-06-24`,
            amount: 86.7,
            status: "estimated",
          },
        ],
      },
    ],
  },
  selected_year: currentYear,
  generated_at: `${currentYear}-04-28T19:30:00+00:00`,
  warnings: [
    {
      code: "polygon-fallback",
      severity: "info",
      message: "Polygon fallback supplied dividend schedules for O.",
    },
  ],
  data_sources: {
    robinhood: { enabled: true },
    polygon: {
      enabled: true,
      used_for_tickers: ["O"],
      rate_limited_tickers: [],
    },
  },
  partial_data_available: false,
};
