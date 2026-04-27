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


if __name__ == '__main__':
    unittest.main()
