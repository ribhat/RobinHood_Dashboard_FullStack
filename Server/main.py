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
        dividend_data = robin.account.get_dividends()  # Fixed typo here
        dividends_collected = []
        
        for month in months:
            dividends_collected.append(TotalDivendsForMonth(month, year))
        
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
        current_dt = str(datetime.datetime.now())
        curr_month = current_dt[5:7]
        curr_year = current_dt[0:4]
        
        return jsonify({
            'equity': profile['equity'],
            'dividends_this_month': TotalDivendsForMonth(str(curr_month), curr_year),
            'dividends_this_year': sum([TotalDivendsForMonth(month, curr_year) for month in months])
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def TotalDivendsForMonth(month, year):
    sum = 0
    if len(str(month)) != 2:
        month = month_conversion_dict[month]
    dividend_data = robin.account.get_dividends()
    for dictionary in dividend_data:
        if dictionary['payable_date'][0:7] == str(year) + '-' + str(month) and dictionary['state'] != 'voided':
            sum += float(dictionary['amount'])
    return float("%.2f" % sum)

if __name__ == '__main__':
    app.run(port=5000)