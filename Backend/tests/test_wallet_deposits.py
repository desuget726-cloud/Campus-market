import asyncio
import json
import os
import unittest
from decimal import Decimal
from unittest.mock import patch

os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from starlette.requests import Request

from app import main as main_module
from app.database import Base
from app.models import PaymentIdempotency, Student, Transaction, Wallet


class FakeChapaResponse:
    def __init__(self, payload, status_code=200):
        self.payload = payload
        self.status_code = status_code
        self.is_error = status_code >= 400

    def json(self):
        return self.payload

    def raise_for_status(self):
        if self.is_error:
            raise AssertionError("Unexpected Chapa HTTP error in this test.")


class FakeChapaClient:
    def __init__(self, response):
        self.response = response

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return False

    async def post(self, *_args, **_kwargs):
        return self.response


class WalletDepositTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(bind=self.engine)
        self.session_factory = sessionmaker(bind=self.engine, autoflush=False, autocommit=False)
        self.db = self.session_factory()
        self.student = Student(
            name="Ada Student",
            student_id="DEPOSIT-1",
            email="ada-deposit@example.test",
            password="test-password-hash",
            college="Test College",
            department="Testing",
            wallet_balance=Decimal("0.00"),
            is_verified=True,
        )
        self.db.add(self.student)
        self.db.flush()
        self.wallet = Wallet(student_id=self.student.student_id, balance=Decimal("0.00"))
        self.db.add(self.wallet)
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def _webhook_request(self, payload, signature=None):
        body = json.dumps(payload).encode("utf-8")
        signature = signature or main_module._compute_chapa_body_signature("webhook-test-secret", body)

        async def receive():
            return {"type": "http.request", "body": body, "more_body": False}

        request = Request(
            {
                "type": "http",
                "method": "POST",
                "path": "/api/payment/webhook",
                "headers": [(b"x-chapa-signature", signature.encode("utf-8"))],
            },
            receive,
        )
        return body, request

    def _create_pending_deposit(self, tx_ref="TX-DEPOSIT-1", amount=Decimal("75.00")):
        transaction = Transaction(
            student_id=self.student.student_id,
            wallet_id=self.wallet.id,
            tx_id=tx_ref,
            type="Wallet Deposit",
            amount=amount,
            description="Test wallet deposit",
            status="Pending",
        )
        self.db.add(transaction)
        self.db.add(PaymentIdempotency(
            idempotency_key=f"chapa-wallet:{tx_ref}",
            order_id=None,
            buyer_id=self.student.student_id,
            product_id=None,
            transaction_id=tx_ref,
        ))
        self.db.commit()
        return transaction

    def test_initializing_deposit_does_not_require_a_payout_account(self):
        async def run_initialization():
            with patch.object(main_module, "_student_from_authorization", return_value=self.student), \
                    patch.object(main_module, "get_payment_settings", return_value={
                        "enableOnlinePayment": True,
                        "security": {"duplicateTransactionProtection": False},
                    }), \
                    patch.object(main_module, "get_chapa_secret_key", return_value="test-secret"), \
                    patch.object(main_module, "_get_public_payment_url", return_value="https://example.test/callback"), \
                    patch.object(
                        main_module.httpx,
                        "AsyncClient",
                        return_value=FakeChapaClient(FakeChapaResponse({
                            "status": "success",
                            "data": {"checkout_url": "https://checkout.chapa.co/test"},
                        })),
                    ):
                return await main_module.initialize_payment(
                    main_module.DepositRequest(
                        student_id=self.student.student_id,
                        amount=Decimal("75.00"),
                    ),
                    authorization="student-token",
                    db=self.db,
                )

        result = asyncio.run(run_initialization())

        self.assertEqual(result["status"], "success")
        self.assertTrue(result["checkout_url"].startswith("https://checkout.chapa.co/"))
        self.assertEqual(self.db.query(main_module.SellerPaymentAccount).count(), 0)
        self.assertEqual(self.db.query(Transaction).filter_by(type="Wallet Deposit").count(), 1)
        self.assertEqual(self.db.query(PaymentIdempotency).filter(
            PaymentIdempotency.idempotency_key.startswith("chapa-wallet:")
        ).count(), 1)
        self.assertEqual(self.wallet.balance, Decimal("0.00"))

    def test_unverified_and_unauthenticated_students_cannot_initialize_deposits(self):
        request = main_module.DepositRequest(
            student_id=self.student.student_id,
            amount=Decimal("75.00"),
        )
        self.student.is_verified = False
        with patch.object(main_module, "_student_from_authorization", return_value=self.student):
            with self.assertRaises(HTTPException) as unverified_error:
                asyncio.run(main_module.initialize_payment(request, authorization="student-token", db=self.db))
        self.assertEqual(unverified_error.exception.status_code, 403)

        with self.assertRaises(HTTPException) as unauthenticated_error:
            asyncio.run(main_module.initialize_payment(request, authorization=None, db=self.db))
        self.assertEqual(unauthenticated_error.exception.status_code, 401)

    def test_verified_deposit_settles_once_through_verify_endpoint(self):
        self._create_pending_deposit()
        verification = {
            "tx_ref": "TX-DEPOSIT-1",
            "amount": Decimal("75.00"),
            "currency": "ETB",
            "status": "Successful",
        }
        with patch.object(main_module, "_student_from_authorization", return_value=self.student), \
                patch.object(main_module, "_request_chapa_verification", return_value=verification):
            first = main_module.verify_payment_with_chapa(
                "TX-DEPOSIT-1", authorization="student-token", db=self.db
            )
            second = main_module.verify_payment_with_chapa(
                "TX-DEPOSIT-1", authorization="student-token", db=self.db
            )

        self.db.refresh(self.wallet)
        self.db.refresh(self.student)
        transaction = self.db.query(Transaction).filter_by(tx_id="TX-DEPOSIT-1").one()
        self.assertEqual(first["status"], "Successful")
        self.assertEqual(second["status"], "Successful")
        self.assertEqual(self.wallet.balance, Decimal("75.00"))
        self.assertEqual(self.student.wallet_balance, Decimal("75.00"))
        self.assertEqual(transaction.status, "Successful")
        self.assertEqual(self.db.query(Transaction).filter_by(type="Wallet Deposit").count(), 1)

    def test_verify_rejects_amount_mismatch_without_crediting(self):
        self._create_pending_deposit()
        with patch.object(main_module, "_student_from_authorization", return_value=self.student), \
                patch.object(main_module, "_request_chapa_verification", return_value={
                    "tx_ref": "TX-DEPOSIT-1",
                    "amount": Decimal("74.99"),
                    "currency": "ETB",
                    "status": "Successful",
                }):
            with self.assertRaises(HTTPException) as error:
                main_module.verify_payment_with_chapa(
                    "TX-DEPOSIT-1", authorization="student-token", db=self.db
                )

        self.assertEqual(error.exception.status_code, 400)
        self.assertEqual(self.wallet.balance, Decimal("0.00"))
        self.assertEqual(self.db.query(Transaction).filter_by(tx_id="TX-DEPOSIT-1").one().status, "Pending")

    def test_verification_uses_chapa_verify_endpoint_and_returns_provider_amount_currency(self):
        response = FakeChapaResponse({
            "status": "success",
            "data": {
                "tx_ref": "TX-DEPOSIT-1",
                "amount": "75.00",
                "currency": "ETB",
                "status": "success",
            },
        })
        with patch.object(main_module, "get_chapa_secret_key", return_value="test-secret"), \
                patch.object(main_module.httpx, "get", return_value=response) as chapa_get:
            verification = main_module._request_chapa_verification("TX-DEPOSIT-1")

        self.assertEqual(verification["tx_ref"], "TX-DEPOSIT-1")
        self.assertEqual(verification["amount"], Decimal("75.00"))
        self.assertEqual(verification["currency"], "ETB")
        self.assertEqual(verification["status"], "Successful")
        chapa_get.assert_called_once_with(
            "https://api.chapa.co/v1/transaction/verify/TX-DEPOSIT-1",
            headers={"Authorization": "Bearer test-secret"},
            timeout=15.0,
        )

    def test_signed_webhook_verifies_with_chapa_and_duplicate_does_not_credit_twice(self):
        self._create_pending_deposit()
        payload = {
            "status": "success",
            "tx_ref": "TX-DEPOSIT-1",
            "amount": 75,
            "currency": "ETB",
        }
        _, request = self._webhook_request(payload)
        verified = {
            "tx_ref": "TX-DEPOSIT-1",
            "amount": Decimal("75.00"),
            "currency": "ETB",
            "status": "Successful",
        }
        webhook_payload = main_module.ChapaWebhookPayload(**payload)
        with patch.object(main_module, "_request_chapa_verification", return_value=verified), \
                patch.object(main_module, "get_chapa_webhook_secret", return_value="webhook-test-secret"):
            first = asyncio.run(main_module.simulate_chapa_webhook(
                payload=webhook_payload,
                request=request,
                db=self.db,
                authorization=None,
            ))
            _, duplicate_request = self._webhook_request(payload)
            duplicate = asyncio.run(main_module.simulate_chapa_webhook(
                payload=webhook_payload,
                request=duplicate_request,
                db=self.db,
                authorization=None,
            ))

        self.db.refresh(self.wallet)
        self.assertEqual(first["status"], "Successful")
        self.assertEqual(duplicate["status"], "Successful")
        self.assertEqual(self.wallet.balance, Decimal("75.00"))
        self.assertEqual(self.db.query(Transaction).filter_by(type="Wallet Deposit").count(), 1)

    def test_webhook_rejects_invalid_signature_and_amount_mismatch(self):
        self._create_pending_deposit()
        payload = {
            "status": "success",
            "tx_ref": "TX-DEPOSIT-1",
            "amount": 75,
            "currency": "ETB",
        }
        webhook_payload = main_module.ChapaWebhookPayload(**payload)
        _, invalid_request = self._webhook_request(payload, signature="invalid-signature")
        with patch.object(main_module, "get_chapa_webhook_secret", return_value="webhook-test-secret"):
            with self.assertRaises(HTTPException) as signature_error:
                asyncio.run(main_module.simulate_chapa_webhook(
                    payload=webhook_payload,
                    request=invalid_request,
                    db=self.db,
                    authorization=None,
                ))
        self.assertEqual(signature_error.exception.status_code, 401)

        mismatch_payload = {**payload, "amount": 76}
        _, mismatch_request = self._webhook_request(mismatch_payload)
        with patch.object(main_module, "get_chapa_webhook_secret", return_value="webhook-test-secret"), \
                patch.object(main_module, "_request_chapa_verification") as verify:
            with self.assertRaises(HTTPException) as amount_error:
                asyncio.run(main_module.simulate_chapa_webhook(
                    payload=main_module.ChapaWebhookPayload(**mismatch_payload),
                    request=mismatch_request,
                    db=self.db,
                    authorization=None,
                ))
        self.assertEqual(amount_error.exception.status_code, 400)
        verify.assert_not_called()
        self.assertEqual(self.wallet.balance, Decimal("0.00"))


if __name__ == "__main__":
    unittest.main()
