import sys
import unittest
from pathlib import Path
from unittest.mock import ANY, Mock, patch

from flask import Flask


SERVER_DIR = Path(__file__).resolve().parents[1]
if str(SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(SERVER_DIR))

import dashboard_data
import main
import robinhood_auth


class DashboardDataTests(unittest.TestCase):
    def tearDown(self):
        dashboard_data.clear_dashboard_caches()

    def test_dividends_by_month_ignores_voided_and_rounds(self):
        dividends = [
            {'payable_date': '2026-01-15', 'amount': '1.235', 'state': 'paid'},
            {'payable_date': '2026-01-20', 'amount': '2.105', 'state': 'paid'},
            {'payable_date': '2026-01-25', 'amount': '9.99', 'state': 'voided'},
            {'payable_date': '2025-01-15', 'amount': '4.00', 'state': 'paid'},
        ]

        totals = dashboard_data.dividends_by_month(dividends, '2026')

        self.assertEqual(totals['01'], 3.34)

    def test_validate_year_rejects_bad_values(self):
        with self.assertRaises(dashboard_data.InvalidInputError):
            dashboard_data.validate_year('26')

        with self.assertRaises(dashboard_data.InvalidInputError):
            dashboard_data.validate_year('abcd')

    def test_ttl_cache_avoids_repeated_factory_calls(self):
        cache = dashboard_data.TTLCache(ttl_seconds=60)
        factory = Mock(side_effect=['first', 'second'])

        self.assertEqual(cache.get_or_set('key', factory), 'first')
        self.assertEqual(cache.get_or_set('key', factory), 'first')
        self.assertEqual(factory.call_count, 1)

    def test_instrument_symbol_rejects_unrecognized_url(self):
        with self.assertRaises(dashboard_data.InvalidInputError):
            dashboard_data.get_instrument_symbol('http://example.com/instruments/abc')

    def test_current_year_position_estimate_excludes_payments_before_open_date(self):
        positions = [
            {
                'symbol': 'FKST',
                'quantity': '10',
                'created_at': '2026-05-15T12:00:00Z',
            },
        ]
        dividends = [
            {
                'Ticker': 'FKST',
                'payable_date': '2025-01-10',
                'rate': '1.00',
                'amount': '10.00',
                'state': 'paid',
            },
            {
                'Ticker': 'FKST',
                'payable_date': '2025-04-10',
                'rate': '1.00',
                'amount': '10.00',
                'state': 'paid',
            },
            {
                'Ticker': 'FKST',
                'payable_date': '2025-08-10',
                'rate': '1.00',
                'amount': '10.00',
                'state': 'paid',
            },
        ]

        estimate = dashboard_data.estimate_current_holdings_income(
            '2026',
            '2025',
            positions,
            dividends,
        )

        self.assertEqual(estimate['total'], 10)
        self.assertEqual(estimate['details'][0]['projected_total'], 10)
        self.assertEqual(
            [payment['expected_date'] for payment in estimate['details'][0]['projected_payments']],
            ['2026-08-10'],
        )

    def test_current_year_actual_payment_replaces_matching_month_estimate(self):
        positions = [
            {
                'symbol': 'JEPI',
                'quantity': '10',
                'created_at': '2024-01-01T12:00:00Z',
            },
        ]
        dividends = [
            {
                'Ticker': 'JEPI',
                'payable_date': '2025-01-10',
                'ex_dividend_date': '2025-01-03',
                'rate': '0.40',
                'amount': '4.00',
                'state': 'paid',
            },
            {
                'Ticker': 'JEPI',
                'payable_date': '2025-02-10',
                'ex_dividend_date': '2025-02-03',
                'rate': '0.45',
                'amount': '4.50',
                'state': 'paid',
            },
            {
                'Ticker': 'JEPI',
                'payable_date': '2026-01-12',
                'amount': '4.25',
                'state': 'paid',
            },
        ]

        estimate = dashboard_data.estimate_current_holdings_income(
            '2026',
            '2025',
            positions,
            dividends,
            as_of_date=dashboard_data.parse_date('2026-04-27'),
        )

        payments = estimate['details'][0]['projected_payments']

        self.assertEqual(estimate['total'], 8.75)
        self.assertEqual(payments[0]['source'], 'actual')
        self.assertEqual(payments[0]['amount'], 4.25)
        self.assertEqual(payments[0]['actual_date'], '2026-01-12')
        self.assertEqual(payments[1]['source'], 'estimate')
        self.assertEqual(payments[1]['amount'], 4.5)

    def test_income_calendar_combines_received_actuals_and_future_estimates(self):
        dividends = [
            {
                'Ticker': 'JEPI',
                'payable_date': '2026-01-12',
                'amount': '4.25',
                'state': 'paid',
            },
            {
                'Ticker': 'JEPI',
                'payable_date': '2026-05-12',
                'amount': '4.40',
                'state': 'paid',
            },
            {
                'Ticker': 'VOID',
                'payable_date': '2026-03-01',
                'amount': '10.00',
                'state': 'voided',
            },
        ]
        projection = {
            'current_holdings_estimate': {
                'details': [
                    {
                        'ticker': 'JEPI',
                        'projected_payments': [
                            {
                                'expected_date': '2026-01-10',
                                'actual_date': '2026-01-12',
                                'amount': 4.25,
                                'source': 'actual',
                            },
                            {
                                'expected_date': '2026-05-10',
                                'amount': '4.50',
                                'source': 'estimate',
                            },
                        ],
                    },
                    {
                        'ticker': 'SCHD',
                        'projected_payments': [
                            {
                                'expected_date': '2026-03-15',
                                'amount': '1.00',
                                'source': 'estimate',
                            },
                            {
                                'expected_date': '2026-11-20',
                                'amount': '3.25',
                                'source': 'estimate',
                            },
                        ],
                    },
                ],
            },
        }

        calendar = dashboard_data.build_income_calendar(
            '2026',
            dividends,
            projection,
            dashboard_data.parse_date('2026-04-27'),
        )

        self.assertEqual(
            calendar['items'],
            [
                {
                    'ticker': 'JEPI',
                    'date': '2026-01-12',
                    'amount': 4.25,
                    'source': 'actual',
                    'status': 'received',
                },
                {
                    'ticker': 'JEPI',
                    'date': '2026-05-10',
                    'amount': 4.5,
                    'source': 'estimate',
                    'status': 'estimated',
                },
                {
                    'ticker': 'SCHD',
                    'date': '2026-11-20',
                    'amount': 3.25,
                    'source': 'estimate',
                    'status': 'estimated',
                },
            ],
        )
        self.assertEqual(calendar['summary']['next_expected_payment']['ticker'], 'JEPI')
        self.assertEqual(calendar['summary']['received_annual_income'], 4.25)
        self.assertEqual(calendar['summary']['remaining_estimated_annual_income'], 7.75)
        self.assertEqual(calendar['summary']['total_projected_annual_income'], 12)

    def test_income_calendar_groups_payments_by_month(self):
        dividends = [
            {
                'Ticker': 'O',
                'payable_date': '2026-04-15',
                'amount': '3.00',
                'state': 'paid',
            },
        ]
        projection = {
            'current_holdings_estimate': {
                'details': [
                    {
                        'ticker': 'O',
                        'projected_payments': [
                            {
                                'expected_date': '2026-04-30',
                                'amount': '3.20',
                                'source': 'estimate',
                            },
                            {
                                'expected_date': '2026-05-31',
                                'amount': '3.20',
                                'source': 'estimate',
                            },
                        ],
                    },
                ],
            },
        }

        calendar = dashboard_data.build_income_calendar(
            '2026',
            dividends,
            projection,
            dashboard_data.parse_date('2026-04-20'),
        )
        april = calendar['months'][3]
        may = calendar['months'][4]

        self.assertEqual(april['month_name'], 'April')
        self.assertEqual(april['received'], 3)
        self.assertEqual(april['estimated'], 3.2)
        self.assertEqual(april['total'], 6.2)
        self.assertEqual(calendar['summary']['current_month_income'], 6.2)
        self.assertEqual(may['total'], 3.2)

    def test_income_calendar_returns_empty_months_without_data(self):
        calendar = dashboard_data.build_income_calendar(
            '2026',
            [],
            {'current_holdings_estimate': {'details': []}},
            dashboard_data.parse_date('2026-04-27'),
        )

        self.assertEqual(calendar['items'], [])
        self.assertEqual(len(calendar['months']), 12)
        self.assertTrue(all(month['total'] == 0 for month in calendar['months']))
        self.assertIsNone(calendar['summary']['next_expected_payment'])
        self.assertEqual(calendar['summary']['current_month_income'], 0)
        self.assertEqual(calendar['summary']['remaining_estimated_annual_income'], 0)

    @patch.dict('os.environ', {'POLYGON_API_KEY': 'test-key'})
    @patch('dashboard_data.fetch_polygon_dividend_schedule')
    def test_current_year_position_estimate_uses_external_schedule_for_unmodeled_ticker(
        self,
        mock_fetch_schedule,
    ):
        mock_fetch_schedule.return_value = [
            {
                'expected_date': dashboard_data.parse_date('2026-08-10'),
                'eligibility_date': dashboard_data.parse_date('2026-08-01'),
                'rate': 1.5,
            },
        ]
        positions = [
            {
                'symbol': 'NEW',
                'quantity': '4',
                'created_at': '2026-02-01T12:00:00Z',
            },
        ]

        estimate = dashboard_data.estimate_current_holdings_income(
            '2026',
            '2025',
            positions,
            [],
        )

        self.assertEqual(estimate['total'], 6)
        self.assertEqual(estimate['external_lookup_used'], ['NEW'])
        self.assertEqual(estimate['unmodeled_tickers'], [])

    def test_polygon_request_budget_stops_before_free_limit(self):
        for _ in range(dashboard_data.POLYGON_FREE_REQUESTS_PER_MINUTE):
            dashboard_data.consume_polygon_request_budget()

        with self.assertRaises(dashboard_data.ExternalRateLimitReached):
            dashboard_data.consume_polygon_request_budget()

    @patch.dict('os.environ', {'POLYGON_API_KEY': 'test-key'})
    @patch('dashboard_data.fetch_polygon_dividend_schedule')
    def test_external_provider_error_keeps_ticker_unmodeled(self, mock_fetch_schedule):
        mock_fetch_schedule.side_effect = dashboard_data.requests.RequestException()
        positions = [
            {
                'symbol': 'NEW',
                'quantity': '4',
                'created_at': '2026-02-01T12:00:00Z',
            },
        ]

        estimate = dashboard_data.estimate_current_holdings_income(
            '2026',
            '2025',
            positions,
            [],
        )

        self.assertEqual(estimate['total'], 0)
        self.assertEqual(estimate['unmodeled_tickers'], ['NEW'])

    def test_current_year_position_estimate_flags_unmodeled_tickers(self):
        positions = [
            {
                'symbol': 'NEW',
                'quantity': '4',
                'created_at': '2026-02-01T12:00:00Z',
            },
        ]

        estimate = dashboard_data.estimate_current_holdings_income(
            '2026',
            '2025',
            positions,
            [],
        )

        self.assertEqual(estimate['total'], 0)
        self.assertEqual(estimate['unmodeled_tickers'], ['NEW'])

    def test_portfolio_overview_calculates_gain_loss_and_yield(self):
        overview = dashboard_data.build_portfolio_overview(
            {'equity': '1000.00'},
            {
                'AAPL': {
                    'name': 'Apple',
                    'quantity': '3',
                    'equity': '600.00',
                    'price': '200.00',
                    'average_buy_price': '150.00',
                },
                'TSLA': {
                    'name': 'Tesla',
                    'quantity': '2',
                    'equity': '400.00',
                    'price': '200.00',
                    'average_buy_price': '250.00',
                },
            },
            {'current_holdings_estimate': {'total': 50}},
        )

        self.assertEqual(overview['total_equity'], 1000)
        self.assertEqual(overview['position_count'], 2)
        self.assertEqual(overview['total_cost_basis'], 950)
        self.assertEqual(overview['unrealized_gain_loss'], 50)
        self.assertEqual(overview['unrealized_return_percent'], 5.26)
        self.assertEqual(overview['estimated_dividend_yield_percent'], 5)
        self.assertEqual(overview['largest_position']['ticker'], 'AAPL')
        self.assertEqual(overview['largest_position_weight_percent'], 60)
        self.assertEqual(overview['top_gainers'][0]['ticker'], 'AAPL')
        self.assertEqual(overview['top_losers'][0]['ticker'], 'TSLA')
        self.assertEqual(overview['cost_basis_coverage']['covered_position_count'], 2)
        self.assertEqual(overview['cost_basis_coverage']['coverage_percent'], 100)

    def test_portfolio_overview_handles_missing_cost_basis(self):
        overview = dashboard_data.build_portfolio_overview(
            {'equity': '300.00'},
            {
                'SCHD': {
                    'name': 'Schwab US Dividend Equity ETF',
                    'quantity': '5',
                    'equity': '300.00',
                    'price': '60.00',
                },
            },
            {'current_holdings_estimate': {'total': 12}},
        )

        self.assertIsNone(overview['total_cost_basis'])
        self.assertIsNone(overview['unrealized_gain_loss'])
        self.assertIsNone(overview['unrealized_return_percent'])
        self.assertEqual(overview['estimated_dividend_yield_percent'], 4)
        self.assertEqual(overview['top_gainers'], [])
        self.assertEqual(overview['top_losers'], [])
        self.assertEqual(overview['cost_basis_coverage']['covered_position_count'], 0)
        self.assertEqual(overview['cost_basis_coverage']['unavailable_position_count'], 1)

    @patch('dashboard_data.get_income_calendar')
    @patch('dashboard_data.get_dividend_projection')
    @patch('dashboard_data.get_yearly_dividend_summary')
    @patch('dashboard_data.get_holdings')
    @patch('dashboard_data.get_portfolio')
    def test_dashboard_snapshot_bundles_core_dashboard_data(
        self,
        mock_portfolio,
        mock_holdings,
        mock_yearly_dividends,
        mock_projection,
        mock_calendar,
    ):
        mock_portfolio.return_value = {'equity': '123.45'}
        mock_holdings.return_value = {'AAPL': {'equity': '100.00'}}
        mock_yearly_dividends.return_value = {'months': [], 'dividends': [], 'total': 0}
        mock_projection.return_value = {'current_year': 2026}
        mock_calendar.return_value = {'year': 2026, 'items': []}

        snapshot = dashboard_data.get_dashboard_snapshot('2026')

        self.assertEqual(snapshot['portfolio'], {'equity': '123.45'})
        self.assertEqual(snapshot['holdings'], {'AAPL': {'equity': '100.00'}})
        self.assertEqual(snapshot['portfolio_overview']['position_count'], 1)
        self.assertEqual(snapshot['portfolio_overview']['total_equity'], 123.45)
        self.assertEqual(snapshot['yearly_dividends']['total'], 0)
        self.assertEqual(snapshot['income_projection'], {'current_year': 2026})
        self.assertEqual(snapshot['income_calendar'], {'year': 2026, 'items': []})
        self.assertEqual(snapshot['selected_year'], 2026)
        self.assertIn('generated_at', snapshot)
        self.assertIn('warnings', snapshot)
        self.assertIn('data_sources', snapshot)
        self.assertIn('partial_data_available', snapshot)
        mock_projection.assert_called_once_with('2026')
        mock_calendar.assert_called_once_with('2026', {'current_year': 2026})

    def test_dashboard_warnings_flag_partial_data(self):
        warnings = dashboard_data.build_dashboard_warnings(
            {'NEW': {'equity': '100.00'}},
            {'total': 0},
            {
                'current_holdings_estimate': {
                    'unmodeled_tickers': ['NEW'],
                    'external_lookup_used': [],
                    'rate_limited_tickers': ['RATE'],
                },
            },
            {
                'cost_basis_coverage': {
                    'unavailable_position_count': 1,
                },
            },
        )

        self.assertEqual(
            [warning['code'] for warning in warnings],
            [
                'dividends_empty',
                'missing_cost_basis',
                'unmodeled_dividend_schedule',
                'external_lookup_rate_limited',
            ],
        )
        self.assertEqual(warnings[2]['tickers'], ['NEW'])
        self.assertEqual(warnings[3]['tickers'], ['RATE'])

    @patch.dict('os.environ', {'POLYGON_API_KEY': 'test-key'})
    def test_dashboard_data_sources_include_external_lookup_status(self):
        sources = dashboard_data.build_dashboard_data_sources({
            'current_holdings_estimate': {
                'external_lookup_used': ['NEW'],
                'rate_limited_tickers': ['RATE'],
            },
        })

        self.assertTrue(sources['robinhood']['enabled'])
        self.assertTrue(sources['polygon']['enabled'])
        self.assertEqual(sources['polygon']['used_for_tickers'], ['NEW'])
        self.assertEqual(sources['polygon']['rate_limited_tickers'], ['RATE'])


class ApiValidationTests(unittest.TestCase):
    def setUp(self):
        main.robinhood_login = None
        main.robinhood_auth_error = None
        main.robinhood_auth_requires_mfa = False
        self.client = main.app.test_client()

    def tearDown(self):
        main.robinhood_login = None
        main.robinhood_auth_error = None
        main.robinhood_auth_requires_mfa = False
        dashboard_data.clear_dashboard_caches()

    def test_health_check_does_not_require_robinhood_auth(self):
        response = self.client.get('/api/health')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {'status': 'ok'})

    @patch('main.ensure_robinhood_login')
    def test_invalid_year_returns_400_without_auth_attempt(self, mock_login):
        response = self.client.get('/api/dividends/yearly/not-a-year')

        self.assertEqual(response.status_code, 400)
        self.assertIn('Year must be', response.get_json()['error'])
        mock_login.assert_not_called()

    @patch('main.ensure_robinhood_login')
    def test_invalid_ticker_returns_400_without_auth_attempt(self, mock_login):
        response = self.client.get('/api/quote/INVALID_TOO_LONG')

        self.assertEqual(response.status_code, 400)
        self.assertIn('Ticker must be', response.get_json()['error'])
        mock_login.assert_not_called()

    def test_unauthenticated_portfolio_returns_401(self):
        response = self.client.get('/api/portfolio')

        self.assertEqual(response.status_code, 401)
        self.assertIn('Log in to Robinhood', response.get_json()['error'])

    @patch('main.ensure_robinhood_login')
    def test_dashboard_invalid_year_returns_400_without_auth_attempt(self, mock_login):
        response = self.client.get('/api/dashboard?year=invalid')

        self.assertEqual(response.status_code, 400)
        self.assertIn('Year must be', response.get_json()['error'])
        mock_login.assert_not_called()

    @patch('main.fetch_dashboard_snapshot')
    @patch('main.ensure_robinhood_login')
    def test_dashboard_snapshot_endpoint_returns_bundled_data(
        self,
        mock_login,
        mock_snapshot,
    ):
        mock_snapshot.return_value = {
            'portfolio': {'equity': '123.45'},
            'holdings': {},
            'yearly_dividends': {'months': [], 'dividends': [], 'total': 0},
            'income_projection': {'current_year': 2026},
            'income_calendar': {'year': 2026, 'items': []},
            'selected_year': 2026,
            'generated_at': '2026-01-01T00:00:00+00:00',
        }

        response = self.client.get('/api/dashboard?year=2026')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()['selected_year'], 2026)
        mock_login.assert_called_once()
        mock_snapshot.assert_called_once_with('2026')


class ApiAuthTests(unittest.TestCase):
    def setUp(self):
        main.robinhood_login = None
        main.robinhood_auth_error = None
        main.robinhood_auth_requires_mfa = False
        self.client = main.app.test_client()

    def tearDown(self):
        main.robinhood_login = None
        main.robinhood_auth_error = None
        main.robinhood_auth_requires_mfa = False
        dashboard_data.clear_dashboard_caches()

    @patch('main.login_to_robinhood')
    def test_auth_status_does_not_trigger_login(self, mock_login):
        response = self.client.get('/api/auth/status')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {'authenticated': False})
        mock_login.assert_not_called()

    @patch('main.login_to_robinhood')
    def test_auth_status_reports_pending_verification(self, mock_login):
        main.robinhood_auth_error = 'MFA required'
        main.robinhood_auth_requires_mfa = True

        response = self.client.get('/api/auth/status')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.get_json(),
            {
                'authenticated': False,
                'error': 'MFA required',
                'mfa_required': True,
                'code': 'mfa_required',
            },
        )
        mock_login.assert_not_called()

    @patch('main.clear_dashboard_caches')
    @patch('main.login_to_robinhood')
    def test_login_success_sets_session_and_clears_caches(
        self,
        mock_login,
        mock_clear_caches,
    ):
        mock_login.return_value = {'access_token': 'token'}

        response = self.client.post(
            '/api/auth/login',
            json={
                'username': 'user@example.com',
                'password': 'secret',
                'mfa_code': '123456',
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {'authenticated': True})
        self.assertEqual(main.robinhood_login, {'access_token': 'token'})
        mock_login.assert_called_once_with(
            'user@example.com',
            'secret',
            '123456',
            on_verification_required=ANY,
        )
        mock_clear_caches.assert_called_once()

    @patch('main.login_to_robinhood')
    def test_login_failure_returns_401(self, mock_login):
        mock_login.side_effect = main.RobinhoodAuthError('bad credentials')

        response = self.client.post(
            '/api/auth/login',
            json={'username': 'user@example.com', 'password': 'wrong'},
        )

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.get_json()['error'], 'bad credentials')
        self.assertFalse(main.is_robinhood_authenticated())

    @patch('main.login_to_robinhood')
    def test_login_verification_required_returns_409(self, mock_login):
        mock_login.side_effect = main.RobinhoodVerificationRequired('MFA required')

        response = self.client.post(
            '/api/auth/login',
            json={'username': 'user@example.com', 'password': 'secret'},
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(
            response.get_json(),
            {
                'authenticated': False,
                'error': 'MFA required',
                'mfa_required': True,
                'code': 'mfa_required',
            },
        )
        self.assertFalse(main.is_robinhood_authenticated())

    @patch('main.login_to_robinhood')
    def test_login_code_required_keeps_pending_login_context(self, mock_login):
        pending_login = {'workflow_id': 'workflow-id'}
        mock_login.side_effect = main.RobinhoodVerificationRequired(
            'MFA code required',
            pending_login=pending_login,
            mfa_code_required=True,
        )

        response = self.client.post(
            '/api/auth/login',
            json={'username': 'user@example.com', 'password': 'secret'},
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(
            response.get_json(),
            {
                'authenticated': False,
                'error': 'MFA code required',
                'mfa_required': True,
                'mfa_code_required': True,
                'code': 'mfa_code_required',
            },
        )
        self.assertEqual(main.pending_robinhood_login, pending_login)

    @patch('main.clear_dashboard_caches')
    @patch('main.complete_pending_login')
    def test_login_with_mfa_code_completes_pending_login(
        self,
        mock_complete_pending_login,
        mock_clear_caches,
    ):
        main.pending_robinhood_login = {'workflow_id': 'workflow-id'}
        mock_complete_pending_login.return_value = {'access_token': 'token'}

        response = self.client.post(
            '/api/auth/login',
            json={'mfa_code': '123456'},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {'authenticated': True})
        self.assertEqual(main.robinhood_login, {'access_token': 'token'})
        self.assertIsNone(main.pending_robinhood_login)
        mock_complete_pending_login.assert_called_once_with(
            {'workflow_id': 'workflow-id'},
            '123456',
        )
        mock_clear_caches.assert_called_once()

    @patch('main.clear_dashboard_caches')
    @patch('main.logout_from_robinhood')
    def test_logout_clears_session_and_caches(self, mock_logout, mock_clear_caches):
        main.robinhood_login = {'access_token': 'token'}

        response = self.client.post('/api/auth/logout')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {'authenticated': False})
        self.assertFalse(main.is_robinhood_authenticated())
        mock_logout.assert_called_once()
        mock_clear_caches.assert_called_once()

    @patch('main.fetch_dashboard_snapshot')
    def test_unauthenticated_dashboard_access_returns_401(self, mock_snapshot):
        response = self.client.get('/api/dashboard?year=2026')

        self.assertEqual(response.status_code, 401)
        self.assertIn('Log in to Robinhood', response.get_json()['error'])
        mock_snapshot.assert_not_called()


class CorsConfigurationTests(unittest.TestCase):
    def build_test_app(self):
        app = Flask(__name__)
        main.configure_cors(app)

        @app.route('/api/example')
        def example():
            return {'ok': True}

        return app.test_client()

    @patch.dict('os.environ', {'CORS_ALLOWED_ORIGINS': ''})
    def test_allows_default_vite_origin(self):
        client = self.build_test_app()

        response = client.get(
            '/api/example',
            headers={'Origin': 'http://localhost:5173'},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.headers.get('Access-Control-Allow-Origin'),
            'http://localhost:5173',
        )

    @patch.dict('os.environ', {'CORS_ALLOWED_ORIGINS': ''})
    def test_rejects_unconfigured_origin(self):
        client = self.build_test_app()

        response = client.get(
            '/api/example',
            headers={'Origin': 'https://evil.example'},
        )

        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.headers.get('Access-Control-Allow-Origin'))


class RobinhoodAuthFlowTests(unittest.TestCase):
    def setUp(self):
        self.request_post_patcher = patch('robinhood_auth.robin_auth.request_post')
        self.request_get_patcher = patch('robinhood_auth.robin_auth.request_get')
        self.update_session_patcher = patch('robinhood_auth.robin_auth.update_session')
        self.set_login_state_patcher = patch('robinhood_auth.robin_auth.set_login_state')
        self.respond_to_challenge_patcher = patch(
            'robinhood_auth.robin_auth.respond_to_challenge'
        )
        self.sleep_patcher = patch('robinhood_auth.time.sleep')

        self.mock_request_post = self.request_post_patcher.start()
        self.mock_request_get = self.request_get_patcher.start()
        self.mock_update_session = self.update_session_patcher.start()
        self.mock_set_login_state = self.set_login_state_patcher.start()
        self.mock_respond_to_challenge = self.respond_to_challenge_patcher.start()
        self.mock_sleep = self.sleep_patcher.start()

    def tearDown(self):
        self.request_post_patcher.stop()
        self.request_get_patcher.stop()
        self.update_session_patcher.stop()
        self.set_login_state_patcher.stop()
        self.respond_to_challenge_patcher.stop()
        self.sleep_patcher.stop()

    @patch('robinhood_auth.robin_auth.login_url', return_value='https://login.example')
    @patch('robinhood_auth.robin_auth.generate_device_token', return_value='device-token')
    def test_login_waits_for_device_approval_and_completes(
        self,
        mock_generate_device_token,
        mock_login_url,
    ):
        self.mock_request_post.side_effect = [
            {
                'verification_workflow': {
                    'id': 'workflow-id',
                    'workflow_status': 'workflow_status_internal_pending',
                },
            },
            {
                'id': 'inquiry-id',
                'type_context': {
                    'result': 'workflow_status_internal_pending',
                },
            },
            {
                'access_token': 'access-token',
                'token_type': 'Bearer',
                'refresh_token': 'refresh-token',
            },
        ]
        self.mock_request_get.return_value = {
            'type_context': {
                'result': 'workflow_status_approved',
            },
        }
        on_verification_required = Mock()

        login_response = robinhood_auth.login_to_robinhood(
            'user@example.com',
            'secret',
            on_verification_required=on_verification_required,
        )

        self.assertEqual(login_response['access_token'], 'access-token')
        self.assertEqual(self.mock_request_post.call_count, 3)
        self.mock_request_get.assert_called_once()
        on_verification_required.assert_called_once()
        self.mock_sleep.assert_not_called()
        self.mock_update_session.assert_called_once_with(
            'Authorization',
            'Bearer access-token',
        )
        self.mock_set_login_state.assert_called_once_with(True)
        mock_generate_device_token.assert_called_once()
        mock_login_url.assert_called_once()

    @patch('robinhood_auth.robin_auth.login_url', return_value='https://login.example')
    @patch('robinhood_auth.robin_auth.generate_device_token', return_value='device-token')
    def test_login_completes_phone_prompt_after_challenge_validation(
        self,
        mock_generate_device_token,
        mock_login_url,
    ):
        self.mock_request_post.side_effect = [
            {
                'verification_workflow': {
                    'id': 'workflow-id',
                    'workflow_status': 'workflow_status_internal_pending',
                },
            },
            {
                'id': 'inquiry-id',
            },
            {
                'state_name': 'Challenge',
                'type': 'result',
                'type_context': {
                    'result': 'workflow_status_approved',
                    'result_type': 'workflow_status',
                },
            },
            {
                'access_token': 'access-token',
                'token_type': 'Bearer',
                'refresh_token': 'refresh-token',
            },
        ]
        self.mock_request_get.side_effect = [
            {
                'state_name': 'Challenge',
                'sequence': 7,
                'type_context': {
                    'context': {
                        'sheriff_challenge': {
                            'id': 'challenge-id',
                            'type': 'prompt',
                            'status': 'issued',
                        },
                    },
                },
            },
            {
                'type': 'prompt',
                'status': 'issued',
            },
            {
                'type': 'prompt',
                'status': 'validated',
            },
        ]

        login_response = robinhood_auth.login_to_robinhood(
            'user@example.com',
            'secret',
        )

        self.assertEqual(login_response['access_token'], 'access-token')
        self.assertEqual(self.mock_request_post.call_count, 4)
        self.assertEqual(self.mock_request_get.call_count, 3)
        self.mock_request_post.assert_any_call(
            url='https://api.robinhood.com/pathfinder/inquiries/inquiry-id/user_view/',
            payload={
                'sequence': 7,
                'user_input': {
                    'status': 'continue',
                },
            },
            json=True,
        )
        self.mock_sleep.assert_called_once_with(
            robinhood_auth.DEVICE_APPROVAL_POLL_INTERVAL_SECONDS,
        )
        mock_generate_device_token.assert_called_once()
        mock_login_url.assert_called_once()

    @patch('robinhood_auth.robin_auth.login_url', return_value='https://login.example')
    @patch('robinhood_auth.robin_auth.generate_device_token', return_value='device-token')
    def test_login_polls_device_inquiry_without_reposting_login_until_approved(
        self,
        mock_generate_device_token,
        mock_login_url,
    ):
        self.mock_request_post.side_effect = [
            {
                'verification_workflow': {
                    'id': 'workflow-id',
                    'workflow_status': 'workflow_status_internal_pending',
                },
            },
            {
                'id': 'inquiry-id',
            },
            {
                'access_token': 'access-token',
                'token_type': 'Bearer',
                'refresh_token': 'refresh-token',
            },
        ]
        self.mock_request_get.side_effect = [
            {
                'type_context': {},
                'state_name': 'waiting_for_device_approval',
            },
            {
                'type_context': {
                    'result': 'workflow_status_approved',
                },
            },
        ]

        login_response = robinhood_auth.login_to_robinhood(
            'user@example.com',
            'secret',
        )

        self.assertEqual(login_response['access_token'], 'access-token')
        self.assertEqual(self.mock_request_post.call_count, 3)
        self.assertEqual(self.mock_request_get.call_count, 2)
        self.mock_sleep.assert_called_once_with(
            robinhood_auth.DEVICE_APPROVAL_POLL_INTERVAL_SECONDS,
        )
        mock_generate_device_token.assert_called_once()
        mock_login_url.assert_called_once()

    @patch('robinhood_auth.robin_auth.login_url', return_value='https://login.example')
    @patch('robinhood_auth.robin_auth.generate_device_token', return_value='device-token')
    def test_login_returns_pending_context_when_workflow_requires_code(
        self,
        mock_generate_device_token,
        mock_login_url,
    ):
        self.mock_request_post.side_effect = [
            {
                'verification_workflow': {
                    'id': 'workflow-id',
                    'workflow_status': 'workflow_status_internal_pending',
                },
            },
            {
                'id': 'inquiry-id',
            },
        ]
        self.mock_request_get.return_value = {
            'state_name': 'Challenge',
            'type_context': {
                'context': {
                    'sheriff_challenge': {
                        'id': 'challenge-id',
                        'type': 'sms',
                    },
                },
            },
        }

        with self.assertRaises(robinhood_auth.RobinhoodVerificationRequired) as context:
            robinhood_auth.login_to_robinhood('user@example.com', 'secret')

        self.assertTrue(context.exception.mfa_code_required)
        self.assertEqual(
            context.exception.pending_login['workflow_id'],
            'workflow-id',
        )
        self.assertEqual(self.mock_request_post.call_count, 2)
        self.mock_request_get.assert_called_once()
        self.mock_sleep.assert_not_called()
        mock_generate_device_token.assert_called_once()
        mock_login_url.assert_called_once()

    @patch('robinhood_auth.robin_auth._validate_sherrif_id')
    def test_complete_pending_login_validates_workflow_and_retries_token_request(
        self,
        mock_validate_sheriff_id,
    ):
        pending_login = {
            'payload': {'username': 'user@example.com'},
            'login_url': 'https://login.example',
            'device_token': 'device-token',
            'workflow_id': 'workflow-id',
        }
        self.mock_request_post.return_value = {
            'access_token': 'access-token',
            'token_type': 'Bearer',
            'refresh_token': 'refresh-token',
        }

        login_response = robinhood_auth.complete_pending_login(
            pending_login,
            '123456',
        )

        self.assertEqual(login_response['access_token'], 'access-token')
        mock_validate_sheriff_id.assert_called_once_with(
            device_token='device-token',
            workflow_id='workflow-id',
            mfa_code='123456',
        )
        self.mock_request_post.assert_called_once_with(
            'https://login.example',
            {'username': 'user@example.com'},
        )

    @patch('robinhood_auth.robin_auth.login_url', return_value='https://login.example')
    @patch('robinhood_auth.robin_auth.generate_device_token', return_value='device-token')
    def test_login_reports_code_challenge_without_canceling_as_auth_error(
        self,
        mock_generate_device_token,
        mock_login_url,
    ):
        self.mock_request_post.return_value = {
            'challenge': {
                'id': 'challenge-id',
            },
        }

        with self.assertRaises(robinhood_auth.RobinhoodVerificationRequired) as context:
            robinhood_auth.login_to_robinhood('user@example.com', 'secret')

        self.assertEqual(
            context.exception.pending_login['challenge_id'],
            'challenge-id',
        )
        self.mock_sleep.assert_not_called()
        mock_generate_device_token.assert_called_once()
        mock_login_url.assert_called_once()

    def test_complete_pending_login_responds_to_pending_challenge(self):
        pending_login = {
            'payload': {'username': 'user@example.com'},
            'login_url': 'https://login.example',
            'device_token': 'device-token',
            'challenge_id': 'challenge-id',
        }
        self.mock_respond_to_challenge.return_value = {'status': 'validated'}
        self.mock_request_post.return_value = {
            'access_token': 'access-token',
            'token_type': 'Bearer',
            'refresh_token': 'refresh-token',
        }

        login_response = robinhood_auth.complete_pending_login(
            pending_login,
            '123456',
        )

        self.assertEqual(login_response['access_token'], 'access-token')
        self.mock_respond_to_challenge.assert_called_once_with(
            'challenge-id',
            '123456',
        )
        self.mock_update_session.assert_any_call(
            'X-ROBINHOOD-CHALLENGE-RESPONSE-ID',
            'challenge-id',
        )
        self.mock_request_post.assert_called_once_with(
            'https://login.example',
            {'username': 'user@example.com'},
        )


if __name__ == '__main__':
    unittest.main()
