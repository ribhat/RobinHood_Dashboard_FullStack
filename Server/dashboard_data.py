import datetime
import os
import re
import time
from collections import defaultdict
from urllib.parse import urlparse

import requests

try:
    import robin_stocks.robinhood as robin
except ModuleNotFoundError:
    robin = None

from Constants.constants import month_conversion_dict, months


CACHE_TTL_SECONDS = 90
QUOTE_CACHE_TTL_SECONDS = 15
SYMBOL_CACHE_TTL_SECONDS = 24 * 60 * 60
INSTRUMENT_REQUEST_TIMEOUT_SECONDS = 10
POLYGON_DIVIDEND_CACHE_TTL_SECONDS = 24 * 60 * 60
POLYGON_FREE_REQUESTS_PER_MINUTE = 4
POLYGON_REQUEST_TIMEOUT_SECONDS = 10
TICKER_PATTERN = re.compile(r"^[A-Za-z0-9.-]{1,12}$")
ALLOWED_INSTRUMENT_HOSTS = {"api.robinhood.com", "nummus.robinhood.com"}


class InvalidInputError(ValueError):
    pass


class ExternalRateLimitReached(Exception):
    pass


class TTLCache:
    def __init__(self, ttl_seconds):
        self.ttl_seconds = ttl_seconds
        self._values = {}

    def get_or_set(self, key, factory):
        now = time.monotonic()
        cached = self._values.get(key)

        if cached and cached["expires_at"] > now:
            return cached["value"]

        value = factory()
        self._values[key] = {
            "value": value,
            "expires_at": now + self.ttl_seconds,
        }
        return value

    def clear(self):
        self._values.clear()


dashboard_cache = TTLCache(CACHE_TTL_SECONDS)
quote_cache = TTLCache(QUOTE_CACHE_TTL_SECONDS)
symbol_cache = TTLCache(SYMBOL_CACHE_TTL_SECONDS)
polygon_dividend_cache = TTLCache(POLYGON_DIVIDEND_CACHE_TTL_SECONDS)
polygon_request_timestamps = []


def require_robinhood_client():
    if robin is None:
        raise RuntimeError(
            "Robinhood support is not installed. Install project dependencies and try again."
        )

    return robin


def clear_dashboard_caches():
    dashboard_cache.clear()
    quote_cache.clear()
    symbol_cache.clear()
    polygon_dividend_cache.clear()
    polygon_request_timestamps.clear()


def validate_year(year):
    year_text = str(year)
    current_year = datetime.datetime.now().year

    if not year_text.isdigit() or len(year_text) != 4:
        raise InvalidInputError("Year must be a four-digit value.")

    year_int = int(year_text)
    if year_int < 1900 or year_int > current_year + 1:
        raise InvalidInputError(
            f"Year must be between 1900 and {current_year + 1}."
        )

    return year_text


def validate_ticker(ticker):
    ticker_text = str(ticker).strip().upper()

    if not TICKER_PATTERN.fullmatch(ticker_text):
        raise InvalidInputError("Ticker must be 1-12 letters, numbers, dots, or dashes.")

    return ticker_text


def get_holdings():
    robin_client = require_robinhood_client()
    return dashboard_cache.get_or_set("holdings", robin_client.build_holdings)


def get_open_positions():
    robin_client = require_robinhood_client()
    return dashboard_cache.get_or_set(
        "open_positions",
        robin_client.get_open_stock_positions,
    )


def get_quote(ticker):
    ticker_text = validate_ticker(ticker)

    def fetch_quote():
        robin_client = require_robinhood_client()
        price = robin_client.get_latest_price(ticker_text)
        return {'ticker': ticker_text, 'price': float(price[0])}

    return quote_cache.get_or_set(f"quote:{ticker_text}", fetch_quote)


def get_dividend_records():
    robin_client = require_robinhood_client()
    return dashboard_cache.get_or_set("dividends", robin_client.account.get_dividends)


def get_portfolio_profile():
    robin_client = require_robinhood_client()
    return dashboard_cache.get_or_set(
        "portfolio_profile",
        robin_client.profiles.load_portfolio_profile,
    )


def get_instrument_symbol(instrument_url):
    parsed_url = urlparse(instrument_url)

    if parsed_url.scheme != "https" or parsed_url.netloc not in ALLOWED_INSTRUMENT_HOSTS:
        raise InvalidInputError("Dividend instrument URL is not a recognized Robinhood URL.")

    def fetch_symbol():
        response = requests.get(
            instrument_url,
            timeout=INSTRUMENT_REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        return response.json()["symbol"]

    return symbol_cache.get_or_set(f"symbol:{instrument_url}", fetch_symbol)


def get_dividends():
    enriched_dividends = []

    for dividend in get_dividend_records():
        enriched_dividend = dict(dividend)
        enriched_dividend["Ticker"] = get_instrument_symbol(dividend["instrument"])
        enriched_dividends.append(enriched_dividend)

    return enriched_dividends


def get_yearly_dividend_summary(year):
    year_text = validate_year(year)
    monthly_totals = dividends_by_month(get_dividend_records(), year_text)
    dividends_collected = [
        monthly_totals[month_conversion_dict[month]]
        for month in months
    ]

    return {
        'months': months,
        'dividends': dividends_collected,
        'total': sum(dividends_collected),
    }


def get_dividend_projection(current_year=None):
    if current_year is None:
        current_year = datetime.datetime.now().year

    current_year_text = validate_year(current_year)
    previous_year_text = str(int(current_year_text) - 1)
    current_year_total = get_yearly_dividend_summary(current_year_text)["total"]
    previous_year_total = get_yearly_dividend_summary(previous_year_text)["total"]
    current_holdings_estimate = estimate_current_holdings_income(
        current_year_text,
        previous_year_text,
        get_open_positions(),
        get_dividend_records(),
    )

    return {
        "current_year": int(current_year_text),
        "current_year_collected": current_year_total,
        "previous_year": int(previous_year_text),
        "previous_year_actual_total": previous_year_total,
        "previous_year_monthly_average": round(previous_year_total / 12, 2),
        "remaining_to_previous_year_actual": round(
            max(previous_year_total - current_year_total, 0),
            2,
        ),
        "current_holdings_estimate": current_holdings_estimate,
    }


def get_dashboard_snapshot(year=None):
    if year is None:
        year = datetime.datetime.now().year

    year_text = validate_year(year)

    return {
        "portfolio": get_portfolio(),
        "holdings": get_holdings(),
        "yearly_dividends": get_yearly_dividend_summary(year_text),
        "income_projection": get_dividend_projection(),
        "selected_year": int(year_text),
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }


def estimate_current_holdings_income(
    current_year,
    previous_year,
    positions,
    dividend_data,
    as_of_date=None,
):
    current_year_text = validate_year(current_year)
    previous_year_text = validate_year(previous_year)
    current_year_start = datetime.date(int(current_year_text), 1, 1)
    if as_of_date is None:
        as_of_date = datetime.date.today()
    schedule_by_symbol = build_prior_year_dividend_schedule(
        dividend_data,
        previous_year_text,
        current_year_text,
    )
    actual_payments_by_symbol = build_current_year_actual_payments(
        dividend_data,
        current_year_text,
        as_of_date,
    )
    estimates = []
    unmodeled_tickers = []
    rate_limited_tickers = []
    external_lookup_used = []

    for position in positions:
        symbol = position.get("symbol")

        if not symbol:
            continue

        ticker = validate_ticker(symbol)
        quantity = parse_float(position.get("quantity"))
        payment_schedule = schedule_by_symbol.get(ticker, [])

        if quantity <= 0:
            continue

        if not payment_schedule:
            try:
                payment_schedule = get_external_dividend_schedule(
                    ticker,
                    previous_year_text,
                    current_year_text,
                )
            except ExternalRateLimitReached:
                rate_limited_tickers.append(ticker)
                continue
            except requests.RequestException:
                unmodeled_tickers.append(ticker)
                continue

            if payment_schedule:
                external_lookup_used.append(ticker)
            else:
                unmodeled_tickers.append(ticker)
                continue

        opened_at = parse_date(position.get("created_at")) or current_year_start
        if opened_at.year > int(current_year_text):
            include_after = datetime.date(int(current_year_text), 12, 31) + datetime.timedelta(days=1)
        elif opened_at.year == int(current_year_text):
            include_after = opened_at
        else:
            include_after = current_year_start
        projected_payments = build_position_payment_outlook(
            ticker,
            quantity,
            payment_schedule,
            actual_payments_by_symbol.get(ticker, {}),
            include_after,
        )
        projected_total = round(
            sum(payment["amount"] for payment in projected_payments),
            2,
        )

        estimates.append({
            "ticker": ticker,
            "quantity": quantity,
            "opened_at": opened_at.isoformat(),
            "projected_total": projected_total,
            "projected_payments": projected_payments,
        })

    estimates.sort(key=lambda estimate: estimate["projected_total"], reverse=True)
    total = round(sum(estimate["projected_total"] for estimate in estimates), 2)

    return {
        "total": total,
        "monthly_average": round(total / 12, 2),
        "modeled_ticker_count": len(estimates),
        "unmodeled_tickers": sorted(unmodeled_tickers),
        "external_lookup_enabled": bool(os.getenv("POLYGON_API_KEY")),
        "external_lookup_source": "Polygon",
        "external_lookup_used": sorted(external_lookup_used),
        "rate_limited_tickers": sorted(rate_limited_tickers),
        "details": estimates,
    }


def build_current_year_actual_payments(dividend_data, current_year, as_of_date=None):
    current_year_text = validate_year(current_year)
    if as_of_date is None:
        as_of_date = datetime.date.today()
    actual_payments = defaultdict(lambda: defaultdict(lambda: {
        "amount": 0,
        "dates": [],
    }))

    for dividend in dividend_data:
        if dividend.get("state") == "voided":
            continue

        payable_date = parse_date(dividend.get("payable_date"))
        amount = parse_float(dividend.get("amount"))

        if (
            not payable_date
            or str(payable_date.year) != current_year_text
            or payable_date > as_of_date
            or amount <= 0
        ):
            continue

        symbol = get_dividend_symbol(dividend)

        if not symbol:
            continue

        month = f"{payable_date.month:02d}"
        actual_payments[symbol][month]["amount"] += amount
        actual_payments[symbol][month]["dates"].append(payable_date)

    return {
        symbol: {
            month: {
                "amount": round(payment["amount"], 2),
                "dates": sorted(payment["dates"]),
            }
            for month, payment in monthly_payments.items()
        }
        for symbol, monthly_payments in actual_payments.items()
    }


def build_position_payment_outlook(
    ticker,
    quantity,
    payment_schedule,
    actual_payments_by_month,
    include_after,
):
    payments = []

    for payment in payment_schedule:
        if payment["eligibility_date"] < include_after:
            continue

        payment_month = f"{payment['expected_date'].month:02d}"
        actual_payment = actual_payments_by_month.get(payment_month)

        if actual_payment:
            payment_dates = actual_payment["dates"]
            payments.append({
                "expected_date": payment["expected_date"].isoformat(),
                "actual_date": payment_dates[-1].isoformat(),
                "eligibility_date": payment["eligibility_date"].isoformat(),
                "rate": payment["rate"],
                "amount": actual_payment["amount"],
                "source": "actual",
                "label": "Received",
            })
            continue

        payments.append({
            "expected_date": payment["expected_date"].isoformat(),
            "eligibility_date": payment["eligibility_date"].isoformat(),
            "rate": payment["rate"],
            "amount": round(quantity * payment["rate"], 2),
            "source": "estimate",
            "label": "Estimated",
        })

    return payments


def build_prior_year_dividend_schedule(dividend_data, previous_year, current_year):
    schedule_by_symbol = defaultdict(list)

    for dividend in dividend_data:
        if dividend.get("state") == "voided":
            continue

        payable_date = parse_date(dividend.get("payable_date"))
        rate = parse_float(dividend.get("rate"))

        if not payable_date or str(payable_date.year) != str(previous_year) or rate <= 0:
            continue

        symbol = get_dividend_symbol(dividend)

        if not symbol:
            continue

        schedule_by_symbol[symbol].append({
            "expected_date": replace_year(payable_date, int(current_year)),
            "eligibility_date": replace_year(
                parse_date(dividend.get("ex_dividend_date")) or payable_date,
                int(current_year),
            ),
            "rate": rate,
        })

    for symbol, payments in schedule_by_symbol.items():
        schedule_by_symbol[symbol] = sorted(
            payments,
            key=lambda payment: payment["expected_date"],
        )

    return schedule_by_symbol


def get_external_dividend_schedule(ticker, previous_year, current_year):
    if not os.getenv("POLYGON_API_KEY"):
        return []

    return polygon_dividend_cache.get_or_set(
        f"polygon:{ticker}:{previous_year}:{current_year}",
        lambda: fetch_polygon_dividend_schedule(ticker, previous_year, current_year),
    )


def fetch_polygon_dividend_schedule(ticker, previous_year, current_year):
    consume_polygon_request_budget()
    response = requests.get(
        "https://api.polygon.io/v3/reference/dividends",
        params={
            "ticker": ticker,
            "pay_date.gte": f"{previous_year}-01-01",
            "pay_date.lte": f"{previous_year}-12-31",
            "limit": 1000,
            "apiKey": os.getenv("POLYGON_API_KEY"),
        },
        timeout=POLYGON_REQUEST_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    dividends = response.json().get("results", [])
    schedule = []

    for dividend in dividends:
        rate = parse_float(dividend.get("cash_amount"))
        expected_date = parse_date(
            dividend.get("pay_date") or dividend.get("ex_dividend_date")
        )
        eligibility_date = parse_date(
            dividend.get("ex_dividend_date") or dividend.get("pay_date")
        )

        if rate <= 0 or not expected_date or not eligibility_date:
            continue

        schedule.append({
            "expected_date": replace_year(expected_date, int(current_year)),
            "eligibility_date": replace_year(eligibility_date, int(current_year)),
            "rate": rate,
        })

    return sorted(schedule, key=lambda payment: payment["expected_date"])


def consume_polygon_request_budget():
    now = time.monotonic()
    one_minute_ago = now - 60
    recent_timestamps = [
        timestamp
        for timestamp in polygon_request_timestamps
        if timestamp > one_minute_ago
    ]
    polygon_request_timestamps.clear()
    polygon_request_timestamps.extend(recent_timestamps)

    if len(polygon_request_timestamps) >= POLYGON_FREE_REQUESTS_PER_MINUTE:
        raise ExternalRateLimitReached()

    polygon_request_timestamps.append(now)


def get_dividend_symbol(dividend):
    symbol = dividend.get("Ticker") or dividend.get("symbol")

    if symbol:
        return validate_ticker(symbol)

    instrument_url = dividend.get("instrument")

    if not instrument_url:
        return None

    return validate_ticker(get_instrument_symbol(instrument_url))


def replace_year(date_value, year):
    try:
        return date_value.replace(year=year)
    except ValueError:
        return date_value.replace(year=year, day=28)


def parse_date(date_text):
    if not date_text:
        return None

    try:
        return datetime.date.fromisoformat(str(date_text)[:10])
    except ValueError:
        return None


def parse_float(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0


def get_portfolio():
    profile = get_portfolio_profile()
    dividend_data = get_dividend_records()
    current_dt = datetime.datetime.now()
    curr_month = f"{current_dt.month:02d}"
    curr_year = str(current_dt.year)
    monthly_totals = dividends_by_month(dividend_data, curr_year)

    return {
        'equity': profile['equity'],
        'dividends_this_month': monthly_totals[curr_month],
        'dividends_this_year': sum(monthly_totals.values()),
    }


def normalize_month(month):
    if len(str(month)) != 2:
        return month_conversion_dict[month]
    return str(month)


def dividends_by_month(dividend_data, year):
    year_text = validate_year(year)
    monthly_totals = {month_conversion_dict[month]: 0 for month in months}

    for dividend in dividend_data:
        payable_date = dividend.get('payable_date', '')
        month = payable_date[5:7]

        if (
            payable_date[0:4] == year_text
            and month in monthly_totals
            and dividend.get('state') != 'voided'
        ):
            monthly_totals[month] += float(dividend.get('amount', 0))

    return {
        month: float("%.2f" % total)
        for month, total in monthly_totals.items()
    }


def TotalDivendsForMonth(month, year, dividend_data=None):
    if dividend_data is None:
        dividend_data = get_dividend_records()

    normalized_month = normalize_month(month)
    return dividends_by_month(dividend_data, year)[normalized_month]
