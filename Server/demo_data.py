import datetime
from copy import deepcopy

from Constants.constants import month_conversion_dict, months


DEMO_HOLDINGS = {
    "SCHD": {
        "name": "Schwab US Dividend Equity ETF",
        "quantity": "92.1450",
        "equity": "7200.83",
        "price": "78.15",
        "average_buy_price": "70.25",
    },
    "MSFT": {
        "name": "Microsoft Corporation",
        "quantity": "18.2500",
        "equity": "7825.41",
        "price": "428.79",
        "average_buy_price": "345.12",
    },
    "AAPL": {
        "name": "Apple Inc.",
        "quantity": "21.0000",
        "equity": "3981.18",
        "price": "189.58",
        "average_buy_price": "171.35",
    },
    "O": {
        "name": "Realty Income Corporation",
        "quantity": "64.0000",
        "equity": "3564.80",
        "price": "55.70",
        "average_buy_price": "51.15",
    },
}

DEMO_CURRENT_YEAR_DIVIDENDS = [
    18.72,
    22.35,
    19.50,
    28.44,
    21.10,
    35.80,
    24.95,
    27.40,
    31.20,
    26.75,
    29.90,
    34.60,
]
DEMO_PREVIOUS_YEAR_DIVIDENDS = [
    14.25,
    18.80,
    17.90,
    21.40,
    19.10,
    26.75,
    20.30,
    22.90,
    24.40,
    23.20,
    25.10,
    28.60,
]


def get_demo_holdings():
    return deepcopy(DEMO_HOLDINGS)


def get_demo_portfolio():
    return {
        "equity": "22572.22",
        "dividends_this_month": 28.44,
        "dividends_this_year": get_demo_yearly_dividend_summary(
            datetime.datetime.now().year
        )["total"],
    }


def get_demo_quote(ticker):
    ticker_text = str(ticker).strip().upper()
    holding = DEMO_HOLDINGS.get(ticker_text, {})

    return {
        "ticker": ticker_text,
        "price": float(holding.get("price") or 0),
    }


def get_demo_dividends():
    current_year = datetime.datetime.now().year
    return [
        {
            "Ticker": "O",
            "symbol": "O",
            "payable_date": f"{current_year}-04-15",
            "ex_dividend_date": f"{current_year}-03-31",
            "amount": "18.44",
            "rate": "0.288",
            "state": "paid",
        },
        {
            "Ticker": "AAPL",
            "symbol": "AAPL",
            "payable_date": f"{current_year}-04-18",
            "ex_dividend_date": f"{current_year}-04-10",
            "amount": "10.00",
            "rate": "0.24",
            "state": "paid",
        },
        {
            "Ticker": "SCHD",
            "symbol": "SCHD",
            "payable_date": f"{current_year}-03-25",
            "ex_dividend_date": f"{current_year}-03-20",
            "amount": "19.50",
            "rate": "0.21",
            "state": "paid",
        },
        {
            "Ticker": "MSFT",
            "symbol": "MSFT",
            "payable_date": f"{current_year}-03-14",
            "ex_dividend_date": f"{current_year}-02-20",
            "amount": "16.50",
            "rate": "0.90",
            "state": "paid",
        },
    ]


def get_demo_yearly_dividend_summary(year):
    year_int = int(year)
    current_year = datetime.datetime.now().year

    if year_int == current_year:
        dividends = DEMO_CURRENT_YEAR_DIVIDENDS
    elif year_int == current_year - 1:
        dividends = DEMO_PREVIOUS_YEAR_DIVIDENDS
    else:
        age = max(current_year - year_int, 0)
        factor = max(0.55, 1 - (age * 0.08))
        dividends = [
            round(month_total * factor, 2)
            for month_total in DEMO_PREVIOUS_YEAR_DIVIDENDS
        ]

    return {
        "months": months,
        "dividends": list(dividends),
        "total": round(sum(dividends), 2),
    }


def get_demo_dividend_projection(year=None):
    if year is None:
        year = datetime.datetime.now().year

    year_int = int(year)
    yearly_dividends = get_demo_yearly_dividend_summary(year_int)
    previous_yearly_dividends = get_demo_yearly_dividend_summary(year_int - 1)
    current_holdings_estimate = {
        "total": 792.44,
        "monthly_average": 66.04,
        "modeled_ticker_count": 4,
        "unmodeled_tickers": [],
        "external_lookup_enabled": False,
        "external_lookup_source": "Demo data",
        "external_lookup_used": [],
        "rate_limited_tickers": [],
        "details": [
            {
                "ticker": "SCHD",
                "quantity": 92.145,
                "opened_at": f"{year_int - 3}-05-14",
                "projected_total": 342.84,
                "projected_payments": [
                    {
                        "expected_date": f"{year_int}-06-24",
                        "eligibility_date": f"{year_int}-06-18",
                        "amount": 86.70,
                        "rate": 0.94,
                        "source": "estimate",
                        "label": "Estimated quarterly dividend",
                    },
                    {
                        "expected_date": f"{year_int}-09-24",
                        "eligibility_date": f"{year_int}-09-18",
                        "amount": 86.70,
                        "rate": 0.94,
                        "source": "estimate",
                        "label": "Estimated quarterly dividend",
                    },
                ],
            },
            {
                "ticker": "O",
                "quantity": 64.0,
                "opened_at": f"{year_int - 2}-02-08",
                "projected_total": 221.28,
                "projected_payments": [
                    {
                        "expected_date": f"{year_int}-05-15",
                        "eligibility_date": f"{year_int}-04-30",
                        "amount": 18.44,
                        "rate": 0.288,
                        "source": "estimate",
                        "label": "Estimated monthly dividend",
                    },
                    {
                        "expected_date": f"{year_int}-06-15",
                        "eligibility_date": f"{year_int}-05-31",
                        "amount": 18.44,
                        "rate": 0.288,
                        "source": "estimate",
                        "label": "Estimated monthly dividend",
                    },
                ],
            },
        ],
    }

    return {
        "current_year": year_int,
        "current_year_collected": yearly_dividends["total"],
        "previous_year": year_int - 1,
        "previous_year_actual_total": previous_yearly_dividends["total"],
        "previous_year_monthly_average": round(
            previous_yearly_dividends["total"] / 12,
            2,
        ),
        "remaining_to_previous_year_actual": round(
            max(previous_yearly_dividends["total"] - yearly_dividends["total"], 0),
            2,
        ),
        "current_holdings_estimate": current_holdings_estimate,
    }


def get_demo_income_calendar(year, income_projection=None):
    year_int = int(year)
    if income_projection is None:
        income_projection = get_demo_dividend_projection(year_int)

    items = [
        {
            "ticker": "MSFT",
            "date": f"{year_int}-03-14",
            "amount": 16.50,
            "source": "actual",
            "status": "received",
        },
        {
            "ticker": "SCHD",
            "date": f"{year_int}-03-25",
            "amount": 19.50,
            "source": "actual",
            "status": "received",
        },
        {
            "ticker": "O",
            "date": f"{year_int}-04-15",
            "amount": 18.44,
            "source": "actual",
            "status": "received",
        },
        {
            "ticker": "AAPL",
            "date": f"{year_int}-04-18",
            "amount": 10.00,
            "source": "actual",
            "status": "received",
        },
        {
            "ticker": "O",
            "date": f"{year_int}-05-15",
            "amount": 18.44,
            "source": "estimate",
            "status": "estimated",
        },
        {
            "ticker": "MSFT",
            "date": f"{year_int}-06-13",
            "amount": 16.43,
            "source": "estimate",
            "status": "estimated",
        },
        {
            "ticker": "SCHD",
            "date": f"{year_int}-06-24",
            "amount": 86.70,
            "source": "estimate",
            "status": "estimated",
        },
        {
            "ticker": "AAPL",
            "date": f"{year_int}-07-18",
            "amount": 10.00,
            "source": "estimate",
            "status": "estimated",
        },
    ]
    monthly_buckets = []

    for month_name in months:
        month_number = month_conversion_dict[month_name]
        month_items = [
            item for item in items if item["date"][5:7] == month_number
        ]
        received = round(
            sum(item["amount"] for item in month_items if item["status"] == "received"),
            2,
        )
        estimated = round(
            sum(item["amount"] for item in month_items if item["status"] != "received"),
            2,
        )
        monthly_buckets.append({
            "month": month_number,
            "month_name": month_name,
            "received": received,
            "estimated": estimated,
            "total": round(received + estimated, 2),
            "items": month_items,
        })

    remaining_estimated = round(
        sum(item["amount"] for item in items if item["status"] != "received"),
        2,
    )
    received_income = round(
        sum(item["amount"] for item in items if item["status"] == "received"),
        2,
    )

    return {
        "year": year_int,
        "as_of_date": f"{year_int}-04-20",
        "items": items,
        "months": monthly_buckets,
        "summary": {
            "next_expected_payment": {
                "ticker": "O",
                "date": f"{year_int}-05-15",
                "amount": 18.44,
                "source": "estimate",
                "status": "estimated",
            },
            "current_month_income": 28.44,
            "current_month_received": 28.44,
            "current_month_estimated": 0,
            "received_annual_income": received_income,
            "remaining_estimated_annual_income": remaining_estimated,
            "total_projected_annual_income": round(
                received_income + remaining_estimated,
                2,
            ),
        },
    }


def get_demo_portfolio_overview():
    return {
        "total_equity": 22572.22,
        "position_count": 4,
        "total_cost_basis": 20423.86,
        "unrealized_gain_loss": 2148.36,
        "unrealized_return_percent": 10.52,
        "estimated_annual_dividend_income": 792.44,
        "estimated_dividend_yield_percent": 3.51,
        "largest_position": {
            "ticker": "MSFT",
            "name": "Microsoft Corporation",
            "equity": 7825.41,
            "weight_percent": 34.67,
        },
        "largest_position_weight_percent": 34.67,
        "cost_basis_coverage": {
            "covered_position_count": 4,
            "unavailable_position_count": 0,
            "covered_equity": 22572.22,
            "coverage_percent": 100,
        },
        "top_holdings": [
            {
                "ticker": "MSFT",
                "name": "Microsoft Corporation",
                "equity": 7825.41,
                "weight_percent": 34.67,
            },
            {
                "ticker": "SCHD",
                "name": "Schwab US Dividend Equity ETF",
                "equity": 7200.83,
                "weight_percent": 31.90,
            },
            {
                "ticker": "AAPL",
                "name": "Apple Inc.",
                "equity": 3981.18,
                "weight_percent": 17.64,
            },
        ],
        "top_gainers": [
            {
                "ticker": "MSFT",
                "name": "Microsoft Corporation",
                "unrealized_gain_loss": 1527.98,
                "unrealized_return_percent": 24.26,
            },
            {
                "ticker": "SCHD",
                "name": "Schwab US Dividend Equity ETF",
                "unrealized_gain_loss": 727.86,
                "unrealized_return_percent": 11.24,
            },
        ],
        "top_losers": [
            {
                "ticker": "O",
                "name": "Realty Income Corporation",
                "unrealized_gain_loss": -33.60,
                "unrealized_return_percent": -0.93,
            },
        ],
    }


def get_demo_dashboard_snapshot(year=None):
    if year is None:
        year = datetime.datetime.now().year

    year_int = int(year)
    income_projection = get_demo_dividend_projection(year_int)

    return {
        "portfolio": get_demo_portfolio(),
        "portfolio_overview": get_demo_portfolio_overview(),
        "holdings": get_demo_holdings(),
        "yearly_dividends": get_demo_yearly_dividend_summary(year_int),
        "income_projection": income_projection,
        "income_calendar": get_demo_income_calendar(year_int, income_projection),
        "selected_year": year_int,
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "warnings": [
            {
                "code": "demo_data",
                "severity": "info",
                "message": "Demo mode is using sample portfolio and dividend data.",
            },
        ],
        "data_sources": {
            "robinhood": {
                "enabled": True,
                "label": "Demo data",
                "provides": [
                    "sample_portfolio_profile",
                    "sample_holdings",
                    "sample_dividend_history",
                ],
            },
            "polygon": {
                "enabled": False,
                "label": "Not used in demo mode",
                "provides": [],
                "used_for_tickers": [],
                "rate_limited_tickers": [],
            },
        },
        "partial_data_available": False,
    }
