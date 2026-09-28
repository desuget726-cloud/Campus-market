import unittest
import os
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock

os.environ.setdefault("DATABASE_URL", "mysql+pymysql://test:test@localhost/test")

from app.models import Transaction
from app.wallet_service import apply_transaction


class FakeQuery:
    def __init__(self, result):
        self.result = result

    def filter(self, *conditions):
        return self

    def with_for_update(self):
        return self

    def first(self):
        return self.result


class WalletServiceTests(unittest.TestCase):
    def make_db(self, *, existing_transaction=None):
        self.student = SimpleNamespace(student_id="seller-1", wallet_balance=Decimal("100.00"))
        self.wallet = SimpleNamespace(id=7, student_id="seller-1", balance=Decimal("100.00"), updated_at=None)
        self.transactions = []
        db = MagicMock()
        db.query.side_effect = lambda model: FakeQuery(
            existing_transaction if model is Transaction else self.student if model.__name__ == "Student" else self.wallet
        )
        db.add.side_effect = self.transactions.append
        return db

    def test_release_credits_wallet_and_links_ledger_once(self):
        db = self.make_db()
        transaction, wallet, applied = apply_transaction(
            db,
            student_id="seller-1",
            tx_id="RELEASE-18",
            transaction_type="Escrow Release",
            amount=Decimal("297.00"),
            description="Escrow release for order #18",
        )

        self.assertTrue(applied)
        self.assertEqual(wallet.balance, Decimal("397.00"))
        self.assertEqual(transaction.wallet_id, wallet.id)

        replay = SimpleNamespace(status="Successful", wallet_id=wallet.id)
        replay_db = self.make_db(existing_transaction=replay)
        _, replay_wallet, applied_again = apply_transaction(
            replay_db,
            student_id="seller-1",
            tx_id="RELEASE-18",
            transaction_type="Escrow Release",
            amount=Decimal("297.00"),
            description="Escrow release for order #18",
        )
        self.assertFalse(applied_again)
        self.assertEqual(replay_wallet.balance, Decimal("100.00"))

    def test_ledger_sum_matches_balance_for_wallet_actions(self):
        db = self.make_db()
        actions = [
            ("Wallet Deposit", Decimal("500.00")),
            ("Escrow Hold", Decimal("200.00")),
            ("Escrow Release", Decimal("198.00")),
            ("Refund", Decimal("50.00")),
            ("Wallet Withdrawal", Decimal("25.00")),
        ]
        for index, (transaction_type, amount) in enumerate(actions):
            apply_transaction(
                db,
                student_id="seller-1",
                tx_id=f"TX-{index}",
                transaction_type=transaction_type,
                amount=amount,
                description=transaction_type,
            )

        expected = Decimal("100.00") + Decimal("500.00") - Decimal("200.00") + Decimal("198.00") + Decimal("50.00") - Decimal("25.00")
        self.assertEqual(self.wallet.balance, expected)
        self.assertTrue(all(row.wallet_id == self.wallet.id for row in self.transactions))

    def test_pending_withdrawal_debits_wallet_and_is_linked_to_ledger(self):
        db = self.make_db()
        transaction, wallet, applied = apply_transaction(
            db,
            student_id="seller-1",
            tx_id="PAYOUT-PENDING-1",
            transaction_type="Wallet Withdrawal",
            amount=Decimal("100.00"),
            description="Pending Withdrawal",
            status="Pending",
        )

        self.assertTrue(applied)
        self.assertEqual(wallet.balance, Decimal("0.00"))
        self.assertEqual(self.student.wallet_balance, Decimal("0.00"))
        self.assertEqual(transaction.status, "Pending")
        self.assertEqual(transaction.wallet_id, wallet.id)

    def test_failed_withdrawal_refund_credits_wallet_with_positive_ledger_amount(self):
        db = self.make_db()
        transaction, wallet, applied = apply_transaction(
            db,
            student_id="seller-1",
            tx_id="REFUND-PAYOUT-1",
            transaction_type="Refund",
            amount=Decimal("-100.00"),
            description="Refund for failed payout PAYOUT-1",
        )

        self.assertTrue(applied)
        self.assertEqual(wallet.balance, Decimal("200.00"))
        self.assertEqual(transaction.amount, Decimal("100.00"))
        self.assertEqual(transaction.type, "Refund")


if __name__ == "__main__":
    unittest.main()
