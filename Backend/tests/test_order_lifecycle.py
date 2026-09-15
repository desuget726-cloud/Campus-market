import unittest
from types import SimpleNamespace

from fastapi import HTTPException

from app.order_lifecycle import (
    apply_buyer_receipt_confirmation,
    apply_seller_order_action,
    payout_release_allowed,
)
from app.main import _build_seller_listing_analytics, _escrow_hold_refund_amount, _product_has_orders, _resolve_pickup_location, _restock_product_for_order


def make_order():
    return SimpleNamespace(
        status="Pending",
        pickup_code=4821,
        buyer_confirmed=False,
        seller_confirmed=False,
        active_dispute=False,
    )


class OrderLifecycleTests(unittest.TestCase):
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


if __name__ == "__main__":
    unittest.main()
