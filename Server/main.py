import logging
import os

from flask import Flask, jsonify, request
from flask_cors import CORS
from dashboard_data import (
    InvalidInputError,
    clear_dashboard_caches,
    get_dashboard_snapshot as fetch_dashboard_snapshot,
    get_dividends as fetch_dividends_data,
    get_dividend_projection as fetch_dividend_projection,
    get_holdings as fetch_holdings_data,
    get_portfolio as fetch_portfolio_data,
    get_quote as fetch_quote_data,
    get_yearly_dividend_summary as fetch_yearly_dividend_summary,
    validate_ticker,
    validate_year,
)
from robinhood_auth import (
    RobinhoodAuthError,
    RobinhoodVerificationRequired,
    complete_pending_login,
    login_to_robinhood,
    logout_from_robinhood,
)

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)
app.logger.setLevel(logging.INFO)
logging.getLogger('robinhood_auth').setLevel(logging.INFO)

DEFAULT_ALLOWED_CORS_ORIGINS = (
    'http://localhost:5173',
    'http://127.0.0.1:5173',
)


def get_allowed_cors_origins():
    configured_origins = os.getenv('CORS_ALLOWED_ORIGINS')

    if not configured_origins:
        return list(DEFAULT_ALLOWED_CORS_ORIGINS)

    return [
        origin.strip()
        for origin in configured_origins.split(',')
        if origin.strip()
    ]


def configure_cors(flask_app):
    CORS(
        flask_app,
        resources={
            r'/api/*': {
                'origins': get_allowed_cors_origins(),
            },
        },
    )


configure_cors(app)

robinhood_login = None
robinhood_auth_error = None
robinhood_auth_requires_mfa = False
pending_robinhood_login = None
MFA_REQUIRED_CODE = 'mfa_required'
MFA_CODE_REQUIRED_CODE = 'mfa_code_required'
MFA_REQUIRED_STATUS_MESSAGE = (
    'Robinhood is waiting for MFA confirmation. Approve the prompt in your '
    'Robinhood app to continue.'
)
MFA_CODE_REQUIRED_STATUS_MESSAGE = (
    'Robinhood requires an MFA code. Enter the current code and submit again.'
)


class AuthenticationRequired(Exception):
    pass


def is_robinhood_authenticated():
    return robinhood_login is not None


def ensure_robinhood_login():
    if robinhood_login:
        return robinhood_login

    raise AuthenticationRequired("Log in to Robinhood to load dashboard data.")


def set_robinhood_session(login_response):
    global robinhood_login, robinhood_auth_error, robinhood_auth_requires_mfa
    global pending_robinhood_login
    robinhood_login = login_response
    robinhood_auth_error = None
    robinhood_auth_requires_mfa = False
    pending_robinhood_login = None


def clear_robinhood_session():
    global robinhood_login, robinhood_auth_error, robinhood_auth_requires_mfa
    global pending_robinhood_login
    robinhood_login = None
    robinhood_auth_error = None
    robinhood_auth_requires_mfa = False
    pending_robinhood_login = None
    logout_from_robinhood()
    clear_dashboard_caches()


def mark_robinhood_mfa_required():
    global robinhood_auth_error, robinhood_auth_requires_mfa
    robinhood_auth_error = MFA_REQUIRED_STATUS_MESSAGE
    robinhood_auth_requires_mfa = True


def api_error(error, status=500, **extra_fields):
    return jsonify({'error': str(error), **extra_fields}), status


def log_api_error(error, status):
    app.logger.warning(
        "API request failed: path=%s status=%s error_type=%s",
        request.path,
        status,
        type(error).__name__,
    )


def run_robinhood_request(callback):
    try:
        ensure_robinhood_login()
    except AuthenticationRequired as error:
        return api_error(error, 401)

    try:
        return callback()
    except InvalidInputError as error:
        log_api_error(error, 400)
        return api_error(error, 400)
    except Exception as error:
        app.logger.exception(
            "Unhandled API request failure: path=%s error_type=%s",
            request.path,
            type(error).__name__,
        )
        return api_error(error)


@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok'})


@app.route('/api/auth/status', methods=['GET'])
def auth_status():
    response = {'authenticated': is_robinhood_authenticated()}

    if not response['authenticated'] and robinhood_auth_error:
        response['error'] = robinhood_auth_error
        if robinhood_auth_requires_mfa:
            response['mfa_required'] = True
            response['code'] = (
                MFA_CODE_REQUIRED_CODE
                if pending_robinhood_login
                else MFA_REQUIRED_CODE
            )
            if pending_robinhood_login:
                response['mfa_code_required'] = True

    return jsonify(response)


@app.route('/api/robinhood/status', methods=['GET'])
def robinhood_status():
    return auth_status()


@app.route('/api/auth/login', methods=['POST'])
def auth_login():
    global robinhood_auth_error, robinhood_auth_requires_mfa, pending_robinhood_login
    payload = request.get_json(silent=True) or {}
    robinhood_auth_error = None
    robinhood_auth_requires_mfa = False
    mfa_code = payload.get('mfa_code')

    try:
        if pending_robinhood_login and mfa_code:
            login_response = complete_pending_login(
                pending_robinhood_login,
                mfa_code,
            )
        else:
            pending_robinhood_login = None
            login_response = login_to_robinhood(
                payload.get('username'),
                payload.get('password'),
                mfa_code,
                on_verification_required=mark_robinhood_mfa_required,
            )
        set_robinhood_session(login_response)
        clear_dashboard_caches()
        return jsonify({'authenticated': True})
    except RobinhoodVerificationRequired as error:
        pending_robinhood_login = error.pending_login
        robinhood_auth_error = str(error)
        robinhood_auth_requires_mfa = True
        log_api_error(error, 409)
        mfa_code_required = bool(error.mfa_code_required)
        extra_fields = {
            'authenticated': False,
            'mfa_required': True,
            'code': (
                MFA_CODE_REQUIRED_CODE
                if mfa_code_required
                else MFA_REQUIRED_CODE
            ),
        }
        if mfa_code_required:
            extra_fields['mfa_code_required'] = True

        return api_error(
            error,
            409,
            **extra_fields,
        )
    except RobinhoodAuthError as error:
        pending_robinhood_login = None
        robinhood_auth_error = str(error)
        robinhood_auth_requires_mfa = False
        log_api_error(error, 401)
        return api_error(error, 401)


@app.route('/api/auth/logout', methods=['POST'])
def auth_logout():
    clear_robinhood_session()
    return jsonify({'authenticated': False})


@app.route('/api/dashboard', methods=['GET'])
def get_dashboard_snapshot():
    year = request.args.get('year')

    if year is not None:
        try:
            validate_year(year)
        except InvalidInputError as error:
            return api_error(error, 400)

    def fetch_snapshot():
        return jsonify(fetch_dashboard_snapshot(year))

    return run_robinhood_request(fetch_snapshot)


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
    except InvalidInputError as error:
        return api_error(error, 400)

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
    except InvalidInputError as error:
        return api_error(error, 400)

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
