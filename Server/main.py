import requests
import robin_stocks
import robin_stocks.robinhood as robin
import pandas as pd
import datetime
from flask import Flask, jsonify
from flask_cors import CORS
from Constants.constants import month_conversion_dict, months, default_year, curr_year, curr_month, curr_day

app = Flask(__name__)
CORS(app)  # Enable CORS for React frontend

lines = open("C:/Users/rishs/OneDrive/Desktop/RHCredentials.txt").read().splitlines()  # enter the path to your credentials here or manually enter them on the next line instead of this line

Username = lines[0]
Password = lines[1]

login = robin.login(Username, Password)

print("login successful")

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
    try:
        my_stocks = robin.build_holdings()
        return jsonify(my_stocks)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/quote/<ticker>', methods=['GET'])
def get_quote(ticker):
    try:
        price = robin.get_latest_price(ticker)
        return jsonify({'ticker': ticker.upper(), 'price': float(price[0])})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/dividends', methods=['GET'])
def get_dividends():
    try:
        dividend_data = robin.account.get_dividends()
        dividend_df = pd.DataFrame(dividend_data)
        
        # Add ticker symbols
        tickers = []
        for i in range(len(dividend_data)):
            response = requests.get(dividend_data[i]['instrument'])
            tickers.append(response.json()['symbol'])
        dividend_df['Ticker'] = tickers
        
        return jsonify(dividend_df.to_dict(orient='records'))
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/dividends/yearly/<year>', methods=['GET'])
def get_yearly_dividends(year):
    try:
        dividend_data = robin.account.get_dividends()
        monthly_totals = dividends_by_month(dividend_data, year)
        dividends_collected = [monthly_totals[month_conversion_dict[month]] for month in months]
        
        return jsonify({
            'months': months,
            'dividends': dividends_collected,
            'total': sum(dividends_collected)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/portfolio', methods=['GET'])
def get_portfolio():
    try:
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
    except Exception as e:
        return jsonify({'error': str(e)}), 500

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
