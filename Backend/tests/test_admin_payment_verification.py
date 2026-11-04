import asyncio
import json
import os
import unittest
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SESSION_SECRET", "admin-payment-verification-test-secret")

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import main as main_module
from app.database import Base
from app.models import Student, Transaction


class AdminPaymentVerificationTests(unittest.TestCase):
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
        student = Student(
            name="Payment Owner",
            student_id="PAYMENT-OWNER",
            email="payment-owner@example.test",
            password="test-password",
            college="Test College",
            department="Testing",
            wallet_balance=Decimal("0.00"),
        )
        self.db.add(student)
        self.transaction = Transaction(
            student_id=student.student_id,
            tx_id="TX-16426E1E",
            type="Wallet Deposit",
            amount=Decimal("75.00"),
            status="Pending",
        )
        self.db.add(self.transaction)
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def _verify(self):
        return asyncio.run(main_module.verify_admin_payment_with_chapa(
            "TX-16426E1E",
            authorization="Bearer admin-token",
            db=self.db,
        ))

    def test_pending_gateway_status_returns_structured_pending_result(self):
        with patch.object(main_module, "_require_admin", return_value=SimpleNamespace(id=1, username="admin")) as require_admin, \
                patch.object(main_module, "_request_chapa_verification", return_value={
                    "tx_ref": "TX-16426E1E",
                    "amount": Decimal("75.00"),
                    "currency": "ETB",
                    "status": "Pending",
                }):
            result = self._verify()

        require_admin.assert_called_once_with("Bearer admin-token", None, self.db)
        self.assertFalse(result["verified"])
        self.assertEqual(result["status"], "Pending")
        self.assertEqual(result["detail"], "Transaction is still pending on Chapa")

    def test_chapa_transport_failure_does_not_raise_auth_error(self):
        with patch.object(main_module, "_require_admin", return_value=SimpleNamespace(id=1, username="admin")), \
                patch.object(
                    main_module,
                    "_request_chapa_verification",
                    side_effect=HTTPException(status_code=502, detail="Unable to verify payment with Chapa."),
                ):
            result = self._verify()

        self.assertEqual(result.status_code, 200)
        payload = json.loads(result.body)
        self.assertFalse(payload["verified"])
        self.assertEqual(payload["status"], "Pending")

    def test_invalid_admin_session_still_returns_401(self):
        with patch.object(
            main_module,
            "_require_admin",
            side_effect=HTTPException(status_code=401, detail="Invalid admin session."),
        ):
            with self.assertRaises(HTTPException) as error:
                self._verify()

        self.assertEqual(error.exception.status_code, 401)


if __name__ == "__main__":
    unittest.main()
