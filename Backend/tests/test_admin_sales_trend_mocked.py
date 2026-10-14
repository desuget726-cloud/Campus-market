import os
import unittest
from datetime import datetime
from unittest.mock import MagicMock, patch

os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from app import main as main_module


class AdminSalesTrendMockedRouteTests(unittest.TestCase):
    def test_route_uses_mocked_order_rows_and_returns_number_arrays(self):
        now = datetime(2026, 10, 14, 12)
        database = MagicMock()
        database.query.return_value.filter.return_value.all.return_value = [
            (datetime(2026, 10, 14, 9), 125),
        ]

        with (
            patch.object(main_module, "_require_admin"),
            patch.object(main_module, "_analytics_local_now", return_value=now),
        ):
            response = main_module.get_admin_sales_trend(
                months=6,
                period="7d",
                authorization="Bearer test-admin-token",
                db=database,
            )

        self.assertEqual(response["revenue"], [0.0] * 6 + [125.0])
        self.assertEqual(len(response["labels"]), 7)
        self.assertTrue(all(isinstance(value, float) for value in response["revenue"]))
        database.query.assert_called_once()


if __name__ == "__main__":
    unittest.main()
