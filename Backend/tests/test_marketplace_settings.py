import unittest
from unittest.mock import patch

from app.main import _public_marketplace_product_query


class QueryStub:
    def __init__(self):
        self.filters = []

    def filter(self, *conditions):
        self.filters.extend(conditions)
        return self


class DatabaseStub:
    def __init__(self):
        self.query_result = QueryStub()

    def query(self, model):
        return self.query_result


class AutoHideSoldSettingsTests(unittest.TestCase):
    def build_query(self, auto_hide_sold):
        database = DatabaseStub()
        with patch("app.main._get_setting_value", return_value=auto_hide_sold):
            query = _public_marketplace_product_query(database)
        return query

    def test_enabled_hides_sold_and_out_of_stock_products(self):
        query = self.build_query(True)
        self.assertEqual(len(query.filters), 2)
        status_filter, stock_filter = query.filters
        status_params = status_filter.compile().params
        self.assertIn(["approved"], status_params.values())
        self.assertIn("products.stock", str(stock_filter))

    def test_disabled_includes_sold_products(self):
        query = self.build_query(False)
        self.assertEqual(len(query.filters), 1)
        status_params = query.filters[0].compile().params
        self.assertIn(["approved", "sold"], status_params.values())


if __name__ == "__main__":
    unittest.main()
