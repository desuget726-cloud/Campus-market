import unittest
from types import SimpleNamespace

from fastapi import HTTPException

from app.order_lifecycle import (
    apply_buyer_receipt_confirmation,
    apply_seller_order_action,
    payout_release_allowed,
)


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


if __name__ == "__main__":
    unittest.main()
