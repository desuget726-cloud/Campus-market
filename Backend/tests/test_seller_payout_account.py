import asyncio
import os
import unittest
from unittest.mock import patch

import httpx
from fastapi import HTTPException
from fastapi import Request
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["SESSION_SECRET"] = "seller-payout-test-secret"

from app import main as main_module
from app.database import Base
from app.models import AuditLog, PayoutProvider, SellerPaymentAccount, SellerPaymentAccountHistory, Student
from app.password_security import hash_password


class SellerPayoutAccountTests(unittest.TestCase):
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
            name="Payout Seller",
            student_id="MAU1600007",
            email="payout-seller@example.test",
            password=hash_password("payout-test-password"),
            college="Test College",
            department="Testing",
            is_verified=True,
        )
        self.provider = PayoutProvider(
            name="Test Bank",
            type="bank",
            code="123",
            is_active=True,
            integration_status="available",
        )
        self.db.add_all([self.student, self.provider])
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def payload(self, account_number="1234567890123"):
        return main_module.SellerPayoutSetupRequest(
            business_name="Test Shop",
            payout_type="bank",
            provider_id=self.provider.id,
            provider_name=self.provider.name,
            bank_code=self.provider.code,
            account_number=account_number,
            account_name="Payout Seller",
        )

    def request(self, password=None):
        headers = [(b"user-agent", b"seller-payout-tests")]
        if password is not None:
            headers.append((b"x-reauth-password", password.encode("utf-8")))
        return Request({
            "type": "http",
            "method": "PATCH",
            "headers": headers,
            "client": ("127.0.0.1", 43100),
            "server": ("testserver", 80),
        })

    def create_account(self, *, student_id=None, chapa_sub_account_id=None):
        account = SellerPaymentAccount(
            student_id=student_id or self.student.student_id,
            provider_id=self.provider.id,
            chapa_sub_account_id=chapa_sub_account_id,
            business_name="Test Shop",
            payout_type="bank",
            bank_code=self.provider.code,
            account_number="1234567890123",
            account_name="Payout Seller",
            account_status="Active",
        )
        self.db.add(account)
        self.db.commit()
        return account

    def authenticated(self, function, *args, **kwargs):
        with patch.object(main_module, "_student_from_authorization", return_value=self.student):
            return function(*args, authorization="Bearer payout-test", db=self.db, **kwargs)

    def test_second_create_returns_conflict(self):
        payload = self.payload()
        self.authenticated(main_module.create_seller_payout_account, payload, request=self.request())
        with self.assertRaises(HTTPException) as error:
            self.authenticated(main_module.create_seller_payout_account, payload, request=self.request())
        self.assertEqual(error.exception.status_code, 409)
        self.assertEqual(self.db.query(SellerPaymentAccount).count(), 1)

    def test_case_different_existing_student_id_cannot_create_duplicate(self):
        self.create_account(student_id="mau1600007")
        with self.assertRaises(HTTPException) as error:
            self.authenticated(main_module.create_seller_payout_account, self.payload(), request=self.request())
        self.assertEqual(error.exception.status_code, 409)
        self.assertEqual(self.db.query(SellerPaymentAccount).count(), 1)

    def test_chapa_setup_rejects_second_create(self):
        self.create_account()
        with patch.object(main_module, "_student_from_authorization", return_value=self.student):
            with self.assertRaises(HTTPException) as error:
                asyncio.run(main_module.setup_seller_payout_account(
                    self.payload(), authorization="Bearer payout-test", db=self.db
                ))
        self.assertEqual(error.exception.status_code, 409)
        self.assertEqual(self.db.query(SellerPaymentAccount).count(), 1)

    def test_edit_requires_reauthentication(self):
        self.create_account()
        with patch.object(main_module, "_student_from_authorization", return_value=self.student):
            with self.assertRaises(HTTPException) as error:
                asyncio.run(main_module.update_seller_payout_account(
                    self.payload("9876543210123"), request=self.request(), authorization="Bearer payout-test", db=self.db
                ))
        self.assertEqual(error.exception.status_code, 401)
        self.assertEqual(self.db.query(SellerPaymentAccountHistory).count(), 0)

    def test_chapa_update_failure_leaves_account_and_history_unchanged(self):
        account = self.create_account(chapa_sub_account_id="chapa-test-subaccount")

        class FailingAsyncClient:
            async def __aenter__(self):
                return self

            async def __aexit__(self, *_args):
                return False

            async def post(self, *_args, **_kwargs):
                raise httpx.ConnectError("mock connection failure")

        with patch.object(main_module, "_student_from_authorization", return_value=self.student), \
                patch.object(main_module.httpx, "AsyncClient", return_value=FailingAsyncClient()), \
                patch.dict(os.environ, {"CHAPA_SECRET_KEY": "test-secret"}):
            with self.assertRaises(HTTPException) as error:
                asyncio.run(main_module.update_seller_payout_account(
                    self.payload("9876543210123"),
                    request=self.request("payout-test-password"),
                    authorization="Bearer payout-test",
                    db=self.db,
                ))

        self.assertEqual(error.exception.status_code, 502)
        self.db.refresh(account)
        self.assertTrue(account.account_number.endswith("0123"))
        self.assertEqual(account.business_name, "Test Shop")
        self.assertEqual(self.db.query(SellerPaymentAccountHistory).count(), 0)

    def update_account_with_client(self, account, client, payload=None):
        with patch.object(main_module, "_student_from_authorization", return_value=self.student), \
                patch.object(main_module.httpx, "AsyncClient", return_value=client), \
                patch.dict(os.environ, {"CHAPA_SECRET_KEY": "test-secret"}):
            return asyncio.run(main_module.update_seller_payout_account(
                payload or self.payload("9876543210123"),
                request=self.request("payout-test-password"),
                authorization="test-token",
                db=self.db,
            ))

    def make_chapa_client(self, status_code, response_body=None, error=None):
        class MockAsyncClient:
            def __init__(self):
                self.url = None
                self.request_json = None

            async def __aenter__(self):
                return self

            async def __aexit__(self, *_args):
                return False

            async def post(self, url, **kwargs):
                self.url = url
                self.request_json = kwargs.get("json")
                if error:
                    raise error
                return httpx.Response(
                    status_code,
                    json=response_body,
                    request=httpx.Request("POST", url),
                )

        return MockAsyncClient()

    def assert_payout_account_unchanged(self, account):
        self.db.refresh(account)
        self.assertEqual(account.chapa_sub_account_id, "chapa-test-subaccount")
        self.assertEqual(account.account_number, "1234567890123")
        self.assertEqual(account.business_name, "Test Shop")
        self.assertEqual(self.db.query(SellerPaymentAccountHistory).count(), 0)
        self.assertEqual(
            self.db.query(AuditLog).filter(AuditLog.action == "Payout Account Updated").count(),
            0,
        )

    def test_chapa_validation_error_returns_422_and_keeps_database_unchanged(self):
        account = self.create_account(chapa_sub_account_id="chapa-test-subaccount")
        client = self.make_chapa_client(
            422,
            {
                "status": "failed",
                "message": "Invalid account number 9876543210123",
                "errors": {"account_number": ["Account number 9876543210123 is invalid"]},
            },
        )

        with self.assertLogs("app.payments", level="WARNING") as captured_logs:
            with self.assertRaises(HTTPException) as error:
                self.update_account_with_client(account, client)

        self.assertEqual(error.exception.status_code, 422)
        self.assertNotIn("9876543210123", error.exception.detail)
        self.assertEqual(client.url, "https://api.chapa.co/v1/subaccount")
        diagnostic = "\n".join(captured_logs.output)
        self.assertIn("method=POST", diagnostic)
        self.assertIn("path=/v1/subaccount", diagnostic)
        self.assertIn("status=422", diagnostic)
        self.assertIn("validation_fields=['account_number']", diagnostic)
        self.assertNotIn("9876543210123", diagnostic)
        self.assertNotIn("test-secret", diagnostic)
        self.assert_payout_account_unchanged(account)

    def test_chapa_server_error_returns_502_and_keeps_database_unchanged(self):
        account = self.create_account(chapa_sub_account_id="chapa-test-subaccount")
        client = self.make_chapa_client(500, {"message": "Temporary provider error"})

        with self.assertRaises(HTTPException) as error:
            self.update_account_with_client(account, client)

        self.assertEqual(error.exception.status_code, 502)
        self.assert_payout_account_unchanged(account)

    def test_chapa_authentication_error_returns_503_and_keeps_database_unchanged(self):
        account = self.create_account(chapa_sub_account_id="chapa-test-subaccount")
        client = self.make_chapa_client(401, {"message": "Invalid secret key"})

        with self.assertRaises(HTTPException) as error:
            self.update_account_with_client(account, client)

        self.assertEqual(error.exception.status_code, 503)
        self.assertNotIn("Invalid secret key", error.exception.detail)
        self.assert_payout_account_unchanged(account)

    def test_chapa_timeout_returns_503_and_keeps_database_unchanged(self):
        account = self.create_account(chapa_sub_account_id="chapa-test-subaccount")
        client = self.make_chapa_client(0, error=httpx.TimeoutException("request timed out"))

        with self.assertRaises(HTTPException) as error:
            self.update_account_with_client(account, client)

        self.assertEqual(error.exception.status_code, 503)
        self.assert_payout_account_unchanged(account)

    def test_chapa_success_replaces_subaccount_and_records_audited_masked_change(self):
        account = self.create_account(chapa_sub_account_id="chapa-test-subaccount")
        client = self.make_chapa_client(
            201,
            {"status": "success", "data": {"subaccount_id": "replacement-subaccount"}},
        )
        name_only_payload = main_module.SellerPayoutSetupRequest(
            business_name="Updated Shop",
            payout_type="bank",
            provider_id=self.provider.id,
            provider_name=self.provider.name,
            bank_code=self.provider.code,
            account_number="",
            account_name="Payout Seller",
        )

        result = self.update_account_with_client(account, client, name_only_payload)

        self.db.refresh(account)
        history = self.db.query(SellerPaymentAccountHistory).one()
        audit_log = self.db.query(AuditLog).filter(
            AuditLog.action == "Payout Account Updated"
        ).one()
        self.assertEqual(result["success"], True)
        self.assertEqual(client.url, "https://api.chapa.co/v1/subaccount")
        self.assertEqual(account.chapa_sub_account_id, "replacement-subaccount")
        self.assertEqual(account.business_name, "Updated Shop")
        self.assertEqual(account.account_number, "1234567890123")
        self.assertEqual(history.old_last4, "••••0123")
        self.assertEqual(history.new_last4, "••••0123")
        self.assertEqual(history.changed_fields, ["business_name"])
        self.assertNotIn("1234567890123", repr(history))
        hold_duration = account.payout_hold_until - account.updated_at
        self.assertGreater(hold_duration.total_seconds(), 23 * 60 * 60)
        self.assertLess(hold_duration.total_seconds(), 25 * 60 * 60)
        self.assertEqual(audit_log.status, "SUCCESS")
        self.assertEqual(audit_log.entity_id, account.id)
        self.assertNotIn("1234567890123", audit_log.description)

    def test_cors_preflight_allows_reauth_header_for_payout_update(self):
        client = TestClient(main_module.app)
        response = client.options(
            "/api/seller/payout-account",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "PATCH",
                "Access-Control-Request-Headers": "authorization, x-reauth-password",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers.get("access-control-allow-origin"), "http://localhost:5173")
        self.assertIn("x-reauth-password", response.headers.get("access-control-allow-headers", "").lower())

    def test_get_returns_masked_account_values_only(self):
        self.create_account()
        with patch.object(main_module, "_student_from_authorization", return_value=self.student):
            result = main_module.get_authenticated_seller_payout_account(
                authorization="Bearer payout-test", db=self.db
            )

        self.assertEqual(result["account_number_masked"], "••••0123")
        self.assertEqual(result["bank_code"], self.provider.code)
        self.assertNotIn("1234567890123", repr(result))
        self.assertNotIn("account_number\"", repr(result))


if __name__ == "__main__":
    unittest.main()