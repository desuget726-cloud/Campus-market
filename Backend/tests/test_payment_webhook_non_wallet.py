import asyncio
import json
import os
import unittest
from decimal import Decimal
from unittest.mock import patch

os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from starlette.requests import Request

from app import main as main_module
from app.database import Base
from app.models import Student, Transaction


class PaymentWebhookNonWalletTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        cls.session_factory = sessionmaker(bind=cls.engine, autoflush=False, autocommit=False)
        cls.original_session_local = main_module.SessionLocal
        main_module.SessionLocal = cls.session_factory
        Base.metadata.create_all(bind=cls.engine)

    @classmethod
    def tearDownClass(cls):
        main_module.SessionLocal = cls.original_session_local
        cls.engine.dispose()

    def test_signed_non_wallet_callback_is_ignored_instead_of_400(self):
        secret = "webhook-test-secret"
        db = self.session_factory()
        student = Student(
            name="Webhook Student",
            student_id="WEBHOOK-STUDENT",
            email="webhook@example.test",
            password="secret",
            college="Test College",
            department="Testing",
            wallet_balance=Decimal("0.00"),
            is_verified=True,
        )
        db.add(student)
        db.commit()

        transaction = Transaction(
            student_id=student.student_id,
            tx_id="TX-NON-WALLET",
            type="Product Purchase",
            amount=Decimal("100.00"),
            description="Book purchase",
            status="Pending",
        )
        db.add(transaction)
        db.commit()

        body = json.dumps({
            "status": "success",
            "tx_ref": transaction.tx_id,
            "amount": "100.00",
            "student_id": student.student_id,
        }).encode()
        signature = main_module._compute_chapa_body_signature(secret, body)

        async def receive():
            return {"type": "http.request", "body": body, "more_body": False}

        request = Request(
            {
                "type": "http",
                "method": "POST",
                "path": "/api/payment/webhook",
                "headers": [(b"x-chapa-signature", signature.encode())],
            },
            receive,
        )

        with patch.dict(os.environ, {"CHAPA_WEBHOOK_SECRET": secret}):
            result = asyncio.run(
                main_module.simulate_chapa_webhook(
                    payload=main_module.ChapaWebhookPayload(
                        status="success",
                        tx_ref=transaction.tx_id,
                        amount=100.0,
                        student_id=student.student_id,
                    ),
                    request=request,
                    db=db,
                    authorization=None,
                )
            )

        self.assertEqual(result["status"], "success")
        self.assertTrue(result["verified"])
        self.assertFalse(result["settled"])
        self.assertIn("not a wallet deposit", result["message"].lower())
        db.close()
