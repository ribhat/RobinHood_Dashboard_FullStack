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
        dashboard_data.dashboard_cache.clear()
        dashboard_data.quote_cache.clear()
        dashboard_data.symbol_cache.clear()
        dashboard_data.polygon_dividend_cache.clear()
        dashboard_data.polygon_request_timestamps.clear()

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
    ):
        mock_portfolio.return_value = {'equity': '123.45'}
        mock_holdings.return_value = {'AAPL': {'equity': '100.00'}}
        mock_yearly_dividends.return_value = {'months': [], 'dividends': [], 'total': 0}
        mock_projection.return_value = {'current_year': 2026}

        snapshot = dashboard_data.get_dashboard_snapshot('2026')

        self.assertEqual(snapshot['portfolio'], {'equity': '123.45'})
        self.assertEqual(snapshot['holdings'], {'AAPL': {'equity': '100.00'}})
        self.assertEqual(snapshot['yearly_dividends']['total'], 0)
        self.assertEqual(snapshot['income_projection'], {'current_year': 2026})
        self.assertEqual(snapshot['selected_year'], 2026)
        self.assertIn('generated_at', snapshot)


class ApiValidationTests(unittest.TestCase):
    def setUp(self):
        self.client = main.app.test_client()

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

    @patch('main.ensure_robinhood_login', side_effect=RuntimeError('auth failed'))
    def test_auth_failure_returns_503(self, mock_login):
        response = self.client.get('/api/portfolio')

        self.assertEqual(response.status_code, 503)
        self.assertIn('auth failed', response.get_json()['error'])
        mock_login.assert_called_once()

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
            'selected_year': 2026,
            'generated_at': '2026-01-01T00:00:00+00:00',
        }

        response = self.client.get('/api/dashboard?year=2026')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()['selected_year'], 2026)
        mock_login.assert_called_once()
        mock_snapshot.assert_called_once_with('2026')


if __name__ == '__main__':
    unittest.main()
