import sys
import unittest
from pathlib import Path
from unittest.mock import Mock, patch


SERVER_DIR = Path(__file__).resolve().parents[1]
if str(SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(SERVER_DIR))

import dashboard_data
import main


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
        mock_projection.assert_called_once_with('2026')
        mock_calendar.assert_called_once_with('2026', {'current_year': 2026})


class ApiValidationTests(unittest.TestCase):
    def setUp(self):
        main.robinhood_login = None
        main.robinhood_auth_error = None
        self.client = main.app.test_client()

    def tearDown(self):
        main.robinhood_login = None
        main.robinhood_auth_error = None
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
        self.client = main.app.test_client()

    def tearDown(self):
        main.robinhood_login = None
        main.robinhood_auth_error = None
        dashboard_data.clear_dashboard_caches()

    @patch('main.login_to_robinhood')
    def test_auth_status_does_not_trigger_login(self, mock_login):
        response = self.client.get('/api/auth/status')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {'authenticated': False})
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
        mock_login.assert_called_once_with('user@example.com', 'secret', '123456')
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
        self.assertEqual(response.get_json()['error'], 'MFA required')
        self.assertFalse(main.is_robinhood_authenticated())

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


if __name__ == '__main__':
    unittest.main()
