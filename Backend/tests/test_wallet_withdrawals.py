import asyncio
import json
import os
import tempfile
import threading
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
from app.models import Notification, PayoutProvider, PayoutTransaction, SellerPaymentAccount, Student, Transaction, Wallet
from app.payout_service import PayoutProviderError, PayoutResult, _chapa_secret_key


class StubPayoutAdapter:
    def __init__(self, create_result=None, status_result=None):
        self.create_result = create_result or PayoutResult("processing", "chapa-transfer-1", "Awaiting Chapa confirmation.")
        self.status_result = status_result
        self.create_calls = 0

    def create_transfer(self, **_kwargs):
        self.create_calls += 1
        return self.create_result

    def get_transfer_status(self, reference):
        return self.status_result or PayoutResult("processing", reference, "Still processing.")


class BlockingPayoutAdapter(StubPayoutAdapter):
    def __init__(self, entered, release):
        super().__init__()
        self.entered = entered
        self.release = release
        self.call_lock = threading.Lock()

    def create_transfer(self, **kwargs):
        with self.call_lock:
            self.create_calls += 1
        self.entered.set()
        self.release.wait(timeout=5)
        return self.create_result


class WalletWithdrawalTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(bind=self.engine)
        self.session_factory = sessionmaker(bind=self.engine, autoflush=False, autocommit=False)
        self.db = self.session_factory()
        self.student, self.wallet, self.account, self.provider = self._seed_wallet(self.db)

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    @staticmethod
    def _seed_wallet(db, balance=Decimal("1000.00")):
        student = Student(
            name="Ada Student",
            student_id="WITHDRAW-1",
            email="ada@example.test",
            password="hashed-password",
            college="Test College",
            department="Testing",
            wallet_balance=balance,
            is_verified=True,
            notif_pay_inapp=True,
            notif_pay_email=True,
        )
        provider = PayoutProvider(
            name="Chapa Test Bank",
            type="bank",
            code="12345",
            is_active=True,
            integration_status="available",
        )
        db.add_all([student, provider])
        db.flush()
        wallet = Wallet(student_id=student.student_id, balance=balance, held_balance=Decimal("0.00"))
        account = SellerPaymentAccount(
            student_id=student.student_id,
            provider_id=provider.id,
            business_name=student.name,
            payout_type="bank",
            bank_code=provider.code,
            account_number="1234567890",
            account_name=student.name,
            account_status="Active",
        )
        db.add_all([wallet, account])
        db.commit()
        return student, wallet, account, provider

    def _settings(self, **overrides):
        settings = {
            "CHAPA_MODE": "test",
            "CHAPA_TEST_SECRET_KEY": "test-secret",
            "CHAPA_TEST_WEBHOOK_SECRET": "webhook-secret",
            "PAYOUT_MIN_AMOUNT_ETB": "100",
            "PAYOUT_DAILY_LIMIT_ETB": "1000000",
            "PAYOUT_MAX_REQUESTS_PER_HOUR": "10",
            "PAYOUT_ADMIN_APPROVAL_THRESHOLD_ETB": "5000",
        }
        settings.update(overrides)
        return patch.dict(os.environ, settings, clear=False)

    def _withdraw(self, db=None, amount="150.00", key="withdraw-key-1"):
        return asyncio.run(main_module.withdraw_student_wallet(
            main_module.WalletWithdrawalRequest(amount=Decimal(amount), payout_account_id=self.account.id),
            authorization="Bearer test-session",
            idempotency_key=key,
            db=db or self.db,
        ))

    def _signed_webhook(self, reference, status, secret="webhook-secret"):
        body = json.dumps({
            "reference": reference,
            "transfer_id": "chapa-transfer-1",
            "status": status,
        }).encode()
        signature = main_module._compute_chapa_body_signature(secret, body)

        async def receive():
            return {"type": "http.request", "body": body, "more_body": False}

        return Request(
            {
                "type": "http",
                "method": "POST",
                "path": "/api/webhooks/payout-provider",
                "headers": [(b"x-chapa-signature", signature.encode())],
            },
            receive,
        )

    def _patch_withdraw_dependencies(self, adapter):
        return (
            patch.object(main_module, "_student_from_authorization", return_value=self.student),
            patch.object(main_module, "get_payout_adapter", return_value=adapter),
            patch.object(main_module, "_send_student_notification_email", return_value=True),
        )

    def test_success_only_after_signed_provider_confirmation(self):
        adapter = StubPayoutAdapter()
        auth, get_adapter, email = self._patch_withdraw_dependencies(adapter)
        with self._settings(), auth, get_adapter, email:
            response = self._withdraw()

            self.assertEqual(response["status"], "Processing")
            self.assertEqual(self.wallet.balance, Decimal("850.00"))
            self.assertEqual(self.wallet.held_balance, Decimal("150.00"))
            self.assertNotEqual(response["status"], "Successful")

            result = asyncio.run(main_module.handle_payout_provider_webhook(
                self._signed_webhook(response["transaction_id"], "success"),
                db=self.db,
            ))

        self.db.refresh(self.wallet)
        transaction = self.db.query(Transaction).filter_by(tx_id=response["transaction_id"]).one()
        payout = self.db.query(PayoutTransaction).filter_by(id=response["payout_id"]).one()
        self.assertEqual(result["status"], "completed")
        self.assertEqual(transaction.status, "Successful")
        self.assertEqual(self.wallet.balance, Decimal("850.00"))
        self.assertEqual(self.wallet.held_balance, Decimal("0.00"))
        self.assertTrue(payout.is_test_mode)
        self.assertTrue(self.db.query(Notification).filter_by(title="Withdraw successful").first())
        wallet_payload = main_module.get_student_payments(self.student.student_id, self.db)
        self.assertEqual(wallet_payload["held_balance"], 0.0)
        self.assertTrue(wallet_payload["transactions"][0]["test_mode"])

    def test_transfer_submission_completion_requires_successful_verification(self):
        adapter = StubPayoutAdapter(
            PayoutResult("completed", "chapa-transfer-1", "Transfer accepted."),
            PayoutResult("processing", "chapa-transfer-1", "Still processing."),
        )
        auth, get_adapter, email = self._patch_withdraw_dependencies(adapter)
        with self._settings(), auth, get_adapter, email:
            response = self._withdraw()

        self.assertEqual(response["status"], "Processing")
        self.assertEqual(self.wallet.held_balance, Decimal("150.00"))
        self.assertNotIn("Successful", response["status"])

    def test_successful_verify_endpoint_releases_hold(self):
        adapter = StubPayoutAdapter(
            PayoutResult("processing", "chapa-transfer-1", "Transfer accepted."),
            PayoutResult("completed", "chapa-transfer-1", "Chapa confirmed this payout as successful."),
        )
        auth, get_adapter, email = self._patch_withdraw_dependencies(adapter)
        with self._settings(), auth, get_adapter, email:
            response = self._withdraw()

        self.db.refresh(self.wallet)
        self.assertEqual(response["status"], "Successful")
        self.assertEqual(self.wallet.balance, Decimal("850.00"))
        self.assertEqual(self.wallet.held_balance, Decimal("0.00"))

    def test_provider_failure_releases_hold_and_writes_reversal(self):
        adapter = StubPayoutAdapter(PayoutResult("failed", "chapa-transfer-1", "Bank rejected transfer."))
        auth, get_adapter, email = self._patch_withdraw_dependencies(adapter)
        with self._settings(), auth, get_adapter, email:
            response = self._withdraw()

        self.db.refresh(self.wallet)
        self.assertEqual(response["status"], "Failed")
        self.assertEqual(self.wallet.balance, Decimal("1000.00"))
        self.assertEqual(self.wallet.held_balance, Decimal("0.00"))
        reversal = self.db.query(Transaction).filter(Transaction.tx_id.like("REVERSAL-%")).one()
        self.assertEqual(reversal.description, f"Reversal - Withdraw #{response['payout_id']}")
        self.assertEqual(reversal.amount, Decimal("150.00"))
        self.assertTrue(self.db.query(Notification).filter_by(title="Withdraw failed - reversed").first())

    def test_timeout_is_verified_before_reversing(self):
        class TimeoutThenFailedAdapter(StubPayoutAdapter):
            def create_transfer(self, **_kwargs):
                self.create_calls += 1
                raise PayoutProviderError("Transfer request timed out.", retryable=True)

            def get_transfer_status(self, reference):
                self.verified_reference = reference
                return PayoutResult("failed", "chapa-transfer-1", "Chapa confirmed transfer failure.")

        adapter = TimeoutThenFailedAdapter()
        auth, get_adapter, email = self._patch_withdraw_dependencies(adapter)
        with self._settings(), auth, get_adapter, email:
            response = self._withdraw()

        self.db.refresh(self.wallet)
        self.assertEqual(response["status"], "Failed")
        self.assertTrue(adapter.verified_reference.startswith("PAYOUT-"))
        self.assertEqual(self.wallet.balance, Decimal("1000.00"))
        self.assertEqual(self.wallet.held_balance, Decimal("0.00"))

    def test_daily_limit_rejects_before_creating_a_hold(self):
        self.db.add(PayoutTransaction(
            student_id=self.student.student_id,
            wallet_id=self.wallet.id,
            payout_account_id=self.account.id,
            provider_id=self.provider.id,
            amount=Decimal("150.00"),
            currency="ETB",
            status="failed",
            internal_reference="PAYOUT-PRIOR-REQUEST",
        ))
        self.db.commit()
        adapter = StubPayoutAdapter()
        auth, get_adapter, email = self._patch_withdraw_dependencies(adapter)
        with self._settings(PAYOUT_DAILY_LIMIT_ETB="200"), auth, get_adapter, email:
            with self.assertRaises(main_module.HTTPException) as raised:
                self._withdraw(amount="100.00")

        self.assertEqual(raised.exception.status_code, 429)
        self.assertEqual(adapter.create_calls, 0)
        self.assertEqual(self.wallet.balance, Decimal("1000.00"))
        self.assertEqual(self.wallet.held_balance, Decimal("0.00"))

    def test_live_mode_never_falls_back_to_test_or_legacy_transfer_key(self):
        with self._settings(
            CHAPA_MODE="live",
            CHAPA_TEST_SECRET_KEY="test-secret",
            CHAPA_LIVE_SECRET_KEY="live-secret",
            CHAPA_SECRET_KEY="legacy-secret",
        ):
            self.assertEqual(_chapa_secret_key(), "live-secret")

    def test_insufficient_available_balance_does_not_hold_or_call_provider(self):
        self.wallet.balance = Decimal("50.00")
        self.student.wallet_balance = Decimal("50.00")
        self.db.commit()
        adapter = StubPayoutAdapter()
        auth, get_adapter, email = self._patch_withdraw_dependencies(adapter)
        with self._settings(), auth, get_adapter, email:
            with self.assertRaises(main_module.HTTPException) as raised:
                self._withdraw(amount="100.00")

        self.assertIn("Insufficient wallet balance", raised.exception.detail)
        self.assertEqual(adapter.create_calls, 0)
        self.assertEqual(self.db.query(PayoutTransaction).count(), 0)
        self.assertEqual(self.wallet.held_balance, Decimal("0.00"))

    def test_same_idempotency_key_does_not_create_a_second_transfer(self):
        adapter = StubPayoutAdapter()
        auth, get_adapter, email = self._patch_withdraw_dependencies(adapter)
        with self._settings(), auth, get_adapter, email:
            first = self._withdraw(key="same-key")
            second = self._withdraw(key="same-key")

        self.assertEqual(first["payout_id"], second["payout_id"])
        self.assertEqual(adapter.create_calls, 1)
        self.assertEqual(self.db.query(PayoutTransaction).count(), 1)
        self.assertEqual(self.wallet.held_balance, Decimal("150.00"))

    def test_large_withdrawal_waits_for_admin_approval_before_transfer(self):
        adapter = StubPayoutAdapter()
        auth, get_adapter, email = self._patch_withdraw_dependencies(adapter)
        with self._settings(PAYOUT_ADMIN_APPROVAL_THRESHOLD_ETB="100"), auth, get_adapter, email:
            response = self._withdraw()
            self.assertEqual(response["payout_status"], "pending_approval")
            self.assertEqual(response["status"], "Pending")
            self.assertEqual(adapter.create_calls, 0)

            with patch.object(main_module, "_require_admin"):
                approval = asyncio.run(main_module.reconcile_selected_payouts(
                    main_module.PayoutRecoveryRequest(
                        payout_ids=[response["payout_id"]],
                        action="approve",
                    ),
                    authorization="Bearer admin-session",
                    db=self.db,
                ))

        self.assertEqual(adapter.create_calls, 1)
        self.assertEqual(approval["approved"][0]["status"], "Processing")
        self.assertEqual(self.wallet.held_balance, Decimal("150.00"))

    def test_mismatched_destination_name_is_rejected(self):
        self.account.account_name = "Different Person"
        self.db.commit()
        adapter = StubPayoutAdapter()
        auth, get_adapter, email = self._patch_withdraw_dependencies(adapter)
        with self._settings(), auth, get_adapter, email:
            with self.assertRaises(main_module.HTTPException) as raised:
                self._withdraw()

        self.assertIn("account name must match", raised.exception.detail)
        self.assertEqual(adapter.create_calls, 0)
        self.assertEqual(self.wallet.held_balance, Decimal("0.00"))

    def test_invalid_webhook_signature_cannot_release_held_funds(self):
        adapter = StubPayoutAdapter()
        auth, get_adapter, email = self._patch_withdraw_dependencies(adapter)
        with self._settings(), auth, get_adapter, email:
            response = self._withdraw()
            request = self._signed_webhook(response["transaction_id"], "success")
            request.scope["headers"] = [(b"x-chapa-signature", b"invalid")]
            with self.assertRaises(main_module.HTTPException) as raised:
                asyncio.run(main_module.handle_payout_provider_webhook(request, db=self.db))

        self.assertEqual(raised.exception.status_code, 401)
        self.db.refresh(self.wallet)
        self.assertEqual(self.wallet.balance, Decimal("850.00"))
        self.assertEqual(self.wallet.held_balance, Decimal("150.00"))

    def test_concurrent_submit_sends_one_transfer_and_holds_once(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            db_path = os.path.join(temp_dir, "wallet.sqlite")
            engine = create_engine(
                f"sqlite:///{db_path}",
                connect_args={"check_same_thread": False, "timeout": 10},
            )
            Base.metadata.create_all(bind=engine)
            session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
            seed_db = session_factory()
            student, wallet, account, _provider = self._seed_wallet(seed_db)
            student_id = student.student_id
            seed_db.close()

            entered = threading.Event()
            release = threading.Event()
            adapter = BlockingPayoutAdapter(entered, release)
            responses = []
            errors = []

            def submit(key):
                db = session_factory()
                try:
                    authenticated_student = db.query(Student).filter_by(student_id=student_id).one()
                    with self._settings(), patch.object(
                        main_module, "_student_from_authorization", return_value=authenticated_student
                    ), patch.object(
                        main_module, "get_payout_adapter", return_value=adapter
                    ), patch.object(
                        main_module, "_send_student_notification_email", return_value=True
                    ):
                        responses.append(self._withdraw(db=db, key=key))
                except Exception as error:
                    errors.append(error)
                finally:
                    db.close()

            first_thread = threading.Thread(target=submit, args=("concurrent-a",))
            second_thread = threading.Thread(target=submit, args=("concurrent-b",))
            first_thread.start()
            if not entered.wait(timeout=5):
                release.set()
                first_thread.join(timeout=5)
                engine.dispose()
                self.fail(f"First concurrent withdrawal did not reach Chapa: {errors}")
            second_thread.start()
            second_thread.join(timeout=5)
            release.set()
            first_thread.join(timeout=5)
            try:
                self.assertFalse(errors, errors)
                self.assertEqual(adapter.create_calls, 1)
                check_db = session_factory()
                check_wallet = check_db.query(Wallet).filter_by(student_id=student_id).one()
                self.assertEqual(check_wallet.balance, Decimal("850.00"))
                self.assertEqual(check_wallet.held_balance, Decimal("150.00"))
                self.assertEqual(check_db.query(PayoutTransaction).count(), 1)
                check_db.close()
            finally:
                release.set()
                engine.dispose()


if __name__ == "__main__":
    unittest.main()