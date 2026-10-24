import io
import os
import unittest
from datetime import datetime
from decimal import Decimal
from types import SimpleNamespace

from fastapi import HTTPException
from sqlalchemy.sql import visitors

os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from app.main import (
    _build_seller_listing_analytics,
    _derived_dispute_thread,
    _prepare_dispute_evidence_value,
    _product_has_orders,
    _resolve_pickup_location,
    _should_show_in_my_products,
    get_seller_sales_analytics,
)
from app import main as main_module


class OrderLifecycleTests(unittest.TestCase):
    def test_direct_student_id_profile_edit_is_rejected(self):
        student = SimpleNamespace(student_id="OAUTH-875D73CE2C")
        original_auth = main_module._student_from_authorization
        main_module._student_from_authorization = lambda _authorization, _db: student
        try:
            with self.assertRaises(HTTPException) as error:
                main_module.update_student_me(
                    main_module.StudentSelfProfileUpdate(student_id="MAU1600007"),
                    "Bearer test-token",
                    SimpleNamespace(),
                )
            self.assertEqual(error.exception.status_code, 403)
        finally:
            main_module._student_from_authorization = original_auth

    def test_seller_analytics_query_is_scoped_to_authenticated_seller(self):
        captured_filters = []

        class Query:
            def join(self, *_args):
                return self

            def filter(self, *conditions):
                captured_filters.extend(conditions)
                return self

            def all(self):
                return []

            def count(self):
                return 0

        class Database:
            def query(self, *_columns):
                return Query()

        seller = SimpleNamespace(student_id="seller-1", name="Seller One")
        original_resolver = main_module._student_from_authorization
        main_module._student_from_authorization = lambda _authorization, _db: seller
        try:
            get_seller_sales_analytics("7d", "Bearer token", Database())
        finally:
            main_module._student_from_authorization = original_resolver

        bound_values = [
            element.value
            for condition in captured_filters
            for element in visitors.iterate(condition)
            if hasattr(element, "value")
        ]
        self.assertIn("seller-1", bound_values)
        self.assertIn("Seller One", bound_values)

    def test_chart_points_match_stats_for_current_month_order(self):
        order = SimpleNamespace(
            status="Completed",
            created_at=datetime.now(),
            quantity=1,
            price="1000",
            seller_id="seller-1",
        )

        class Query:
            def __init__(self, model):
                self.model = model

            def join(self, *_args):
                return self

            def filter(self, *_conditions):
                return self

            def all(self):
                return [order] if self.model.__name__ == "Order" else []

            def count(self):
                return 0

        class Database:
            def query(self, model, *_columns):
                return Query(model)

        seller = SimpleNamespace(student_id="seller-1", name="Seller One")
        original_resolver = main_module._student_from_authorization
        main_module._student_from_authorization = lambda _authorization, _db: seller
        try:
            result = get_seller_sales_analytics("3m", "Bearer token", Database())
        finally:
            main_module._student_from_authorization = original_resolver

        self.assertEqual(result["stats"]["total_revenue"], 1000)
        self.assertEqual(result["stats"]["total_orders"], 1)
        self.assertEqual(sum(point["total"] for point in result["points"]), 1000)
        self.assertEqual(sum(point["orders"] for point in result["points"]), 1)

    def test_explicit_pickup_location_wins_over_category_fallback(self):
        product = SimpleNamespace(
            pickup_location="Dormitory Gate 2",
            category="Books",
            subcategory="Textbooks",
            title="Database Systems",
        )

        self.assertEqual(_resolve_pickup_location(None, product), "Dormitory Gate 2")

    def test_empty_pickup_location_uses_category_fallback(self):
        product = SimpleNamespace(
            pickup_location="",
            category="Books",
            subcategory="Textbooks",
            title="Database Systems",
        )

        self.assertEqual(_resolve_pickup_location(None, product), "Campus Bookstore")

    def test_saved_commission_settings_override_hardcoded_default(self):
        class FakeSystemSetting:
            def __init__(self, value):
                self.value = value

        class FakeDatabase:
            def query(self, model):
                class Query:
                    def filter(self, *_args, **_kwargs):
                        return self

                    def first(self):
                        return FakeSystemSetting('{"commission": {"commission_enabled": true, "commission_type": "percentage", "commission_rate": "2.5"}}')

                return Query()

        saved_settings = FakeDatabase()
        self.assertEqual(main_module._get_platform_commission_percent(saved_settings), Decimal("2.5"))
        self.assertEqual(
            main_module._calculate_platform_commission(saved_settings, Decimal("100.00")),
            Decimal("2.50"),
        )

    def test_same_title_products_keep_separate_leaderboard_stats(self):
        listings = [
            SimpleNamespace(id=11, title="Books", views=64),
            SimpleNamespace(id=12, title="Books", views=69),
        ]
        completed_orders = [
            SimpleNamespace(product_id=11, price="120", quantity=1),
        ]

        analytics = _build_seller_listing_analytics(listings, completed_orders)

        self.assertEqual([item["listing"].id for item in analytics], [11, 12])
        self.assertEqual([item["completed_orders"] for item in analytics], [1, 0])
        self.assertEqual([item["completed_revenue"] for item in analytics], [120, 0])

    def test_product_order_history_predicate_matches_delete_guard(self):
        class Query:
            def __init__(self, result):
                self.result = result

            def filter(self, *_conditions):
                return self

            def first(self):
                return self.result

        class Database:
            def __init__(self, result):
                self.result = result

            def query(self, *_columns):
                return Query(self.result)

        self.assertTrue(_product_has_orders(Database(object()), 7))
        self.assertFalse(_product_has_orders(Database(None), 7))

    def test_seller_inventory_filters_out_sold_products(self):
        self.assertFalse(_should_show_in_my_products("Sold"))
        self.assertFalse(_should_show_in_my_products("sold"))
        self.assertTrue(_should_show_in_my_products("Active"))
        self.assertTrue(_should_show_in_my_products("Paused"))
        self.assertTrue(_should_show_in_my_products("Pending"))
        self.assertTrue(_should_show_in_my_products("Approved"))

    def test_dispute_thread_normalizes_legacy_and_json_seller_replies(self):
        dispute = SimpleNamespace(
            id=18,
            description="The order arrived damaged and the item was not as listed.",
            created_at="2026-09-10T10:00:00",
            updated_at="2026-09-11T12:30:00",
            seller_response='[{"role": "seller", "message": "We apologize. We already arranged a replacement and sent the tracking details.", "created_at": "2026-09-11T12:30:00", "attachments": ["http://127.0.0.1:8000/static/uploads/e1.jpg"]}]',
            seller_evidence='["http://127.0.0.1:8000/static/uploads/e1.jpg"]',
        )

        thread = _derived_dispute_thread(dispute)

        self.assertEqual(thread[0]["sender"], "Buyer")
        self.assertEqual(thread[1]["sender"], "Seller")
        self.assertEqual(thread[1]["message"], "We apologize. We already arranged a replacement and sent the tracking details.")
        self.assertEqual(thread[1]["attachments"], ["http://127.0.0.1:8000/static/uploads/e1.jpg"])

    def test_dispute_evidence_handles_multipart_payloads(self):
        evidence_json = _prepare_dispute_evidence_value(
            evidence_value=None,
            uploaded_files=[
                SimpleNamespace(filename="buyer-proof.jpg", file=io.BytesIO(b"test-image-data")),
                SimpleNamespace(filename="buyer-proof-2.png", file=io.BytesIO(b"more-image-data")),
            ],
            static_dir="/tmp",
            now=lambda: __import__("datetime").datetime(2026, 9, 11, 8, 15, 0),
            save_file=lambda path, file_obj: None,
        )

        self.assertTrue(evidence_json.startswith("[\"http://127.0.0.1:8000/static/uploads/"))
        self.assertIn(".jpg", evidence_json)
        self.assertIn(".png", evidence_json)


if __name__ == "__main__":
    unittest.main()
