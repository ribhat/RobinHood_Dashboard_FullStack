from flask import Flask, jsonify
from flask_cors import CORS
from dashboard_data import (
    InvalidInputError,
    get_dividends as fetch_dividends_data,
    get_dividend_projection as fetch_dividend_projection,
    get_holdings as fetch_holdings_data,
    get_portfolio as fetch_portfolio_data,
    get_quote as fetch_quote_data,
    get_yearly_dividend_summary as fetch_yearly_dividend_summary,
    validate_ticker,
    validate_year,
)
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
    except Exception as e:
        return api_error(e, 503)

    try:
        return callback()
    except InvalidInputError as e:
        return api_error(e, 400)
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
        return jsonify(fetch_holdings_data())

    return run_robinhood_request(fetch_holdings)

@app.route('/api/quote/<ticker>', methods=['GET'])
def get_quote(ticker):
    try:
        validate_ticker(ticker)
    except InvalidInputError as e:
        return api_error(e, 400)

    def fetch_quote():
        return jsonify(fetch_quote_data(ticker))

    return run_robinhood_request(fetch_quote)

@app.route('/api/dividends', methods=['GET'])
def get_dividends():
    def fetch_dividends():
        return jsonify(fetch_dividends_data())

    return run_robinhood_request(fetch_dividends)

@app.route('/api/dividends/yearly/<year>', methods=['GET'])
def get_yearly_dividends(year):
    try:
        validate_year(year)
    except InvalidInputError as e:
        return api_error(e, 400)

    def fetch_yearly_dividends():
        return jsonify(fetch_yearly_dividend_summary(year))

    return run_robinhood_request(fetch_yearly_dividends)

@app.route('/api/dividends/projection', methods=['GET'])
def get_dividend_projection():
    def fetch_projection():
        return jsonify(fetch_dividend_projection())

    return run_robinhood_request(fetch_projection)

@app.route('/api/portfolio', methods=['GET'])
def get_portfolio():
    def fetch_portfolio():
        return jsonify(fetch_portfolio_data())

    return run_robinhood_request(fetch_portfolio)

if __name__ == '__main__':
    app.run(port=5000)
