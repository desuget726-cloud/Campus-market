import io
import unittest
from datetime import datetime
from types import SimpleNamespace

from fastapi import HTTPException
from sqlalchemy.sql import visitors

from app.order_lifecycle import (
    apply_buyer_receipt_confirmation,
    apply_seller_order_action,
    payout_release_allowed,
)
from app.main import (
    _build_seller_listing_analytics,
    _derived_dispute_thread,
    _escrow_hold_refund_amount,
    _prepare_dispute_evidence_value,
    _product_has_orders,
    _resolve_pickup_location,
    _restock_product_for_order,
    _should_show_in_my_products,
    get_seller_sales_analytics,
)
from app import main as main_module


def make_order():
    return SimpleNamespace(
        status="Pending",
        pickup_code=4821,
        buyer_confirmed=False,
        seller_confirmed=False,
        active_dispute=False,
    )


class OrderLifecycleTests(unittest.TestCase):
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

        bound_values = {
            element.value
            for condition in captured_filters
            for element in visitors.iterate(condition)
            if hasattr(element, "value")
        }
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

    def test_complete_order_requires_both_confirmations(self):
        order = make_order()

        apply_seller_order_action(order, "accept")
        apply_seller_order_action(order, "ready")
        apply_seller_order_action(order, "handover", 4821)

        self.assertEqual(order.status, "Ready for Pickup")
        self.assertTrue(order.seller_confirmed)
        self.assertFalse(order.buyer_confirmed)
        self.assertFalse(payout_release_allowed(order))

        apply_buyer_receipt_confirmation(order)

        self.assertEqual(order.status, "Completed")
        self.assertTrue(order.buyer_confirmed)
        self.assertTrue(payout_release_allowed(order))

    def test_buyer_cannot_confirm_before_seller_handover(self):
        order = make_order()
        apply_seller_order_action(order, "accept")
        apply_seller_order_action(order, "ready")

        with self.assertRaises(HTTPException) as error:
            apply_buyer_receipt_confirmation(order)

        self.assertEqual(error.exception.status_code, 409)
        self.assertEqual(order.status, "Ready for Pickup")
        self.assertFalse(payout_release_allowed(order))

    def test_seller_cannot_skip_states_or_reuse_code(self):
        order = make_order()

        with self.assertRaises(HTTPException):
            apply_seller_order_action(order, "ready")

        apply_seller_order_action(order, "accept")
        apply_seller_order_action(order, "ready")

        with self.assertRaises(HTTPException) as error:
            apply_seller_order_action(order, "handover", 1234)
        self.assertEqual(error.exception.status_code, 400)

        apply_seller_order_action(order, "handover", 4821)
        with self.assertRaises(HTTPException) as error:
            apply_seller_order_action(order, "handover", 4821)
        self.assertEqual(error.exception.status_code, 409)

    def test_buyer_cannot_confirm_twice(self):
        order = make_order()
        apply_seller_order_action(order, "accept")
        apply_seller_order_action(order, "ready")
        apply_seller_order_action(order, "handover", 4821)
        apply_buyer_receipt_confirmation(order)

        with self.assertRaises(HTTPException) as error:
            apply_buyer_receipt_confirmation(order)
        self.assertEqual(error.exception.status_code, 409)

    def test_open_dispute_blocks_receipt_and_payout(self):
        order = make_order()
        order.status = "Disputed"
        order.active_dispute = True

        with self.assertRaises(HTTPException) as error:
            apply_buyer_receipt_confirmation(order)

        self.assertEqual(error.exception.status_code, 409)
        self.assertFalse(payout_release_allowed(order))

    def test_resolved_order_can_be_paid_out_after_dispute(self):
        order = make_order()
        order.status = "Completed"
        order.buyer_confirmed = True
        order.seller_confirmed = True
        order.active_dispute = False

        self.assertTrue(payout_release_allowed(order))

    def test_refund_amount_matches_escrow_hold_for_multiple_units(self):
        order = SimpleNamespace(quantity=3, price="200")
        escrow_hold = SimpleNamespace(amount="600.00")

        refund_amount = _escrow_hold_refund_amount(escrow_hold)

        self.assertEqual(refund_amount, 600)
        self.assertNotEqual(refund_amount, 200)
        self.assertEqual(order.quantity * 200, refund_amount)

    def test_restock_restores_order_quantity_and_availability(self):
        product = SimpleNamespace(stock=0, status="Sold")
        order = SimpleNamespace(quantity=3)

        _restock_product_for_order(product, order)

        self.assertEqual(product.stock, 3)
        self.assertEqual(product.status, "Approved")

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
