import unittest
from datetime import datetime, timezone

from app.sales_analytics import build_sales_trend_response, get_sales_trend_buckets


class SalesAnalyticsBucketTests(unittest.TestCase):
    def test_ranges_have_chronological_zero_filled_buckets(self):
        now = datetime(2026, 10, 14, 12)
        expected_lengths = {"7d": 7, "30d": 30, "year": 12}

        for period, expected_length in expected_lengths.items():
            with self.subTest(period=period):
                buckets = get_sales_trend_buckets(period, now)
                self.assertEqual(len(buckets.labels), expected_length)
                self.assertEqual(len(buckets.buckets), expected_length)
                self.assertEqual(sorted(buckets.buckets), list(buckets.buckets))
                empty_result = build_sales_trend_response(buckets, [])
                self.assertEqual(empty_result["labels"], list(buckets.labels))
                self.assertEqual(empty_result["revenue"], [0.0] * expected_length)

    def test_daily_and_monthly_sales_are_added_to_their_matching_buckets(self):
        now = datetime(2026, 10, 14, 12)
        daily_buckets = get_sales_trend_buckets("7d", now)
        daily_sales = [
            (datetime(2026, 10, 8, 8), 20),
            (datetime(2026, 10, 8, 18), 5.25),
            (datetime(2026, 10, 14, 9), 100),
        ]
        daily_result = build_sales_trend_response(daily_buckets, daily_sales)
        self.assertEqual(daily_result["revenue"], [25.25, 0.0, 0.0, 0.0, 0.0, 0.0, 100.0])

        yearly_buckets = get_sales_trend_buckets("year", now)
        monthly_result = build_sales_trend_response(yearly_buckets, [
            (datetime(2026, 10, 1), 12.5),
            (datetime(2026, 10, 22), 7.5),
        ])
        self.assertEqual(monthly_result["revenue"][-1], 20.0)
        self.assertEqual(sum(monthly_result["revenue"]), 20.0)

    def test_day_ranges_cover_the_last_calendar_days_in_addis_ababa(self):
        buckets = get_sales_trend_buckets("7d", datetime(2026, 10, 14, 12))
        self.assertEqual(buckets.buckets[0], datetime(2026, 10, 8).date())
        self.assertEqual(buckets.buckets[-1], datetime(2026, 10, 14).date())
        self.assertEqual(buckets.start, datetime(2026, 10, 8))
        self.assertEqual(buckets.end, datetime(2026, 10, 15))

    def test_aware_now_is_converted_to_addis_ababa_before_bucket_generation(self):
        utc_now = datetime(2026, 10, 13, 21, 30, tzinfo=timezone.utc)
        buckets = get_sales_trend_buckets("7d", utc_now)

        self.assertEqual(buckets.buckets[-1], datetime(2026, 10, 14).date())

    def test_year_buckets_cross_the_calendar_year_in_order(self):
        buckets = get_sales_trend_buckets("year", datetime(2026, 1, 14, 12))

        self.assertEqual(buckets.buckets[0], datetime(2025, 2, 1))
        self.assertEqual(buckets.buckets[-1], datetime(2026, 1, 1))
        self.assertEqual(list(buckets.buckets), sorted(buckets.buckets))

    def test_rejects_an_unsupported_period(self):
        with self.assertRaises(ValueError):
            get_sales_trend_buckets("6m", datetime(2026, 10, 14))

if __name__ == "__main__":
    unittest.main()
