import requests
import robin_stocks
import robin_stocks.robinhood as robin
import pandas as pd
import datetime
from flask import Flask, jsonify
from flask_cors import CORS
from Constants.constants import month_conversion_dict, months, default_year, curr_year, curr_month, curr_day

app = Flask(__name__)
cors = CORS(app, origins='*')

lines = open("C:/Users/rishs/OneDrive/Desktop/RHCredentials.txt").read().splitlines()  # enter the path to your credentials here or manually enter them on the next line instead of this line

Username = lines[0]
Password = lines[1]

login = robin.login(Username, Password)

print("login successful")

@app.route('/api/holdings', methods=['GET'])
def get_holdings():
    my_stocks = robin.build_holdings()
    return jsonify(my_stocks)


if __name__ == '__main__':
    app.run(port=5000)