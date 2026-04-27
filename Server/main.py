import requests
import robin_stocks.robinhood as robin
import pandas as pd
import datetime
from flask import Flask, jsonify
from flask_cors import CORS
from Constants.constants import month_conversion_dict, months
from robinhood_auth import login_to_robinhood

app = Flask(__name__)
CORS(app)  # Enable CORS for React frontend

robinhood_login = None
robinhood_auth_error = None


def ensure_robinhood_login():
    global robinhood_login, robinhood_auth_error

    if robinhood_login:
        return robinhood_login

    try:
        robinhood_login = login_to_robinhood()
        robinhood_auth_error = None
        return robinhood_login
    except Exception as e:
        robinhood_auth_error = str(e)
        raise


def api_error(error, status=500):
    return jsonify({'error': str(error)}), status


def run_robinhood_request(callback):
    try:
        ensure_robinhood_login()
        return callback()
    except Exception as e:
        return api_error(e)


@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok'})


@app.route('/api/robinhood/status', methods=['GET'])
def robinhood_status():
    try:
        ensure_robinhood_login()
        return jsonify({'authenticated': True})
    except Exception:
        return jsonify({
            'authenticated': False,
            'error': robinhood_auth_error or 'Unable to authenticate with Robinhood.'
        }), 503

# @app.route('/routes')
# def list_routes():
#     import urllib
#     output = []
#     for rule in app.url_map.iter_rules():
#         methods = ','.join(rule.methods)
#         line = urllib.parse.unquote(f"{rule.endpoint:50s} {methods:20s} {rule}")
#         output.append(line)
#     return '<br>'.join(sorted(output))


@app.route('/api/holdings', methods=['GET'])
def get_holdings():
    def fetch_holdings():
        my_stocks = robin.build_holdings()
        return jsonify(my_stocks)

    return run_robinhood_request(fetch_holdings)

@app.route('/api/quote/<ticker>', methods=['GET'])
def get_quote(ticker):
    def fetch_quote():
        price = robin.get_latest_price(ticker)
        return jsonify({'ticker': ticker.upper(), 'price': float(price[0])})

    return run_robinhood_request(fetch_quote)

@app.route('/api/dividends', methods=['GET'])
def get_dividends():
    def fetch_dividends():
        dividend_data = robin.account.get_dividends()
        dividend_df = pd.DataFrame(dividend_data)
        
        # Add ticker symbols
        tickers = []
        for i in range(len(dividend_data)):
            response = requests.get(dividend_data[i]['instrument'])
            tickers.append(response.json()['symbol'])
        dividend_df['Ticker'] = tickers
        
        return jsonify(dividend_df.to_dict(orient='records'))

    return run_robinhood_request(fetch_dividends)

@app.route('/api/dividends/yearly/<year>', methods=['GET'])
def get_yearly_dividends(year):
    def fetch_yearly_dividends():
        dividend_data = robin.account.get_dividends()
        monthly_totals = dividends_by_month(dividend_data, year)
        dividends_collected = [monthly_totals[month_conversion_dict[month]] for month in months]
        
        return jsonify({
            'months': months,
            'dividends': dividends_collected,
            'total': sum(dividends_collected)
        })

    return run_robinhood_request(fetch_yearly_dividends)

@app.route('/api/portfolio', methods=['GET'])
def get_portfolio():
    def fetch_portfolio():
        profile = robin.profiles.load_portfolio_profile()
        dividend_data = robin.account.get_dividends()
        current_dt = str(datetime.datetime.now())
        curr_month = current_dt[5:7]
        curr_year = current_dt[0:4]
        monthly_totals = dividends_by_month(dividend_data, curr_year)
        
        return jsonify({
            'equity': profile['equity'],
            'dividends_this_month': monthly_totals[curr_month],
            'dividends_this_year': sum(monthly_totals.values())
        })

    return run_robinhood_request(fetch_portfolio)

def normalize_month(month):
    if len(str(month)) != 2:
        return month_conversion_dict[month]
    return str(month)

def dividends_by_month(dividend_data, year):
    monthly_totals = {month_conversion_dict[month]: 0 for month in months}

    for dividend in dividend_data:
        payable_date = dividend.get('payable_date', '')
        month = payable_date[5:7]

        if (
            payable_date[0:4] == str(year)
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
        dividend_data = robin.account.get_dividends()

    normalized_month = normalize_month(month)
    return dividends_by_month(dividend_data, year)[normalized_month]

if __name__ == '__main__':
    app.run(port=5000)
