import os
import unittest
from decimal import Decimal
from unittest.mock import patch

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["SESSION_SECRET"] = "wallet-visibility-test-secret"

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import main as main_module
from app.database import Base
from app.models import Student, Transaction, Wallet


class WalletTransactionVisibilityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        cls.session_factory = sessionmaker(bind=cls.engine, autoflush=False, autocommit=False)

    @classmethod
    def tearDownClass(cls):
        cls.engine.dispose()

    def setUp(self):
        Base.metadata.drop_all(bind=self.engine)
        Base.metadata.create_all(bind=self.engine)
        self.db = self.session_factory()
        self.student = Student(
            name="Wallet Owner",
            student_id="wallet-owner",
            email="wallet-owner@example.test",
            password="test-password",
            college="Test College",
            department="Testing",
            wallet_balance=Decimal("250.00"),
        )
        self.other_student = Student(
            name="Other Student",
            student_id="other-student",
            email="other-student@example.test",
            password="test-password",
            college="Test College",
            department="Testing",
        )
        self.wallet = Wallet(student_id=self.student.student_id, balance=Decimal("250.00"))
        self.active_transaction = Transaction(
            student_id=self.student.student_id,
            tx_id="TX-ACTIVE",
            type="Wallet Deposit",
            amount=Decimal("100.00"),
            status="Successful",
        )
        self.hidden_transaction = Transaction(
            student_id=self.student.student_id,
            tx_id="TX-HIDDEN",
            type="Product Purchase",
            amount=Decimal("25.00"),
            status="Successful",
            is_hidden=True,
        )
        self.db.add_all([
            self.student,
            self.other_student,
            self.wallet,
            self.active_transaction,
            self.hidden_transaction,
        ])
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def test_payment_list_filters_hidden_rows_without_changing_balance(self):
        with patch.object(main_module, "_student_from_authorization", return_value=self.student):
            active = main_module.get_student_payments(
                "wallet-owner", db=self.db, hidden=False, authorization="Bearer owner-token",
            )
            hidden = main_module.get_student_payments(
                "wallet-owner", db=self.db, hidden=True, authorization="Bearer owner-token",
            )

        self.assertEqual([row["hash"] for row in active["transactions"]], ["TX-ACTIVE"])
        self.assertEqual([row["hash"] for row in hidden["transactions"]], ["TX-HIDDEN"])
        self.assertEqual(active["hidden_count"], 1)
        self.assertEqual(active["balance"], hidden["balance"])
        self.assertEqual(active["balance"], 250.0)

    def test_only_transaction_owner_can_hide_or_unhide(self):
        with patch.object(main_module, "_student_from_authorization", return_value=self.other_student):
            with self.assertRaises(HTTPException) as hide_error:
                main_module.hide_student_transaction(
                    self.active_transaction.id, "Bearer other-token", self.db,
                )
        self.assertEqual(hide_error.exception.status_code, 403)
        self.db.refresh(self.active_transaction)
        self.assertFalse(self.active_transaction.is_hidden)

        with patch.object(main_module, "_student_from_authorization", return_value=self.student):
            main_module.hide_student_transaction(
                self.active_transaction.id, "Bearer owner-token", self.db,
            )
            main_module.unhide_student_transaction(
                self.active_transaction.id, "Bearer owner-token", self.db,
            )

        self.db.refresh(self.active_transaction)
        self.assertFalse(self.active_transaction.is_hidden)
        self.db.refresh(self.wallet)
        self.assertEqual(self.wallet.balance, Decimal("250.00"))