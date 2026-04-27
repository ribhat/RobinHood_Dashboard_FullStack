import datetime
import re
import time
from urllib.parse import urlparse

import requests
import robin_stocks.robinhood as robin

from Constants.constants import month_conversion_dict, months


CACHE_TTL_SECONDS = 90
QUOTE_CACHE_TTL_SECONDS = 15
SYMBOL_CACHE_TTL_SECONDS = 24 * 60 * 60
INSTRUMENT_REQUEST_TIMEOUT_SECONDS = 10
TICKER_PATTERN = re.compile(r"^[A-Za-z0-9.-]{1,12}$")
ALLOWED_INSTRUMENT_HOSTS = {"api.robinhood.com", "nummus.robinhood.com"}


class InvalidInputError(ValueError):
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
    return dashboard_cache.get_or_set("holdings", robin.build_holdings)


def get_quote(ticker):
    ticker_text = validate_ticker(ticker)

    def fetch_quote():
        price = robin.get_latest_price(ticker_text)
        return {'ticker': ticker_text, 'price': float(price[0])}

    return quote_cache.get_or_set(f"quote:{ticker_text}", fetch_quote)


def get_dividend_records():
    return dashboard_cache.get_or_set("dividends", robin.account.get_dividends)


def get_portfolio_profile():
    return dashboard_cache.get_or_set(
        "portfolio_profile",
        robin.profiles.load_portfolio_profile,
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
