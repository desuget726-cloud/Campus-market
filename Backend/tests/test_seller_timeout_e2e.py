import asyncio
import json
import os
import unittest
from datetime import datetime, timedelta
from decimal import Decimal
from unittest.mock import patch

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["SESSION_SECRET"] = "seller-timeout-e2e-test-secret"

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import main as main_module
from app.database import Base
from app.models import (
    Admin,
    AdminSession,
    AuditLog,
    CartItem,
    Notification,
    Order,
    Product,
    SellerPaymentAccount,
    Student,
    SystemSetting,
    Transaction,
    UserSession,
    Wallet,
)


class SellerAcceptanceTimeoutE2ETests(unittest.TestCase):
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
        main_module.app.dependency_overrides[main_module.get_db] = cls._override_get_db
        cls.client = TestClient(main_module.app)
        Base.metadata.create_all(bind=cls.engine)

    @classmethod
    def tearDownClass(cls):
        cls.client.close()
        main_module.app.dependency_overrides.pop(main_module.get_db, None)
        main_module.SessionLocal = cls.original_session_local
        cls.engine.dispose()

    @classmethod
    def _override_get_db(cls):
        db = cls.session_factory()
        try:
            yield db
        finally:
            db.close()

    def setUp(self):
        Base.metadata.drop_all(bind=self.engine)
        Base.metadata.create_all(bind=self.engine)
        self.db = self.session_factory()
        self.buyer = Student(
            name="Test Buyer",
            student_id="buyer-e2e",
            email="buyer-e2e@example.test",
            password="test-password",
            college="Test College",
            department="Testing",
            wallet_balance=Decimal("500.00"),
            is_verified=True,
            notif_order_inapp=True,
            notif_order_email=False,
            notif_pay_inapp=True,
            notif_pay_email=False,
        )
        self.seller = Student(
            name="Test Seller",
            student_id="seller-e2e",
            email="seller-e2e@example.test",
            password="test-password",
            college="Test College",
            department="Testing",
            wallet_balance=Decimal("0.00"),
            notif_order_inapp=True,
            notif_order_email=False,
        )
        self.product = Product(
            title="E2E Test Item",
            category="Test",
            price="100.00",
            stock=10,
            seller=self.seller.student_id,
            status="Approved",
        )
        self.seller_account = SellerPaymentAccount(
            student_id=self.seller.student_id,
            chapa_sub_account_id="test-sub-account",
            business_name="Test Seller",
            bank_code="TEST",
            account_name="Test Seller",
            account_status="Active",
        )
        self.wallet = Wallet(student_id=self.buyer.student_id, balance=Decimal("500.00"))
        self.db.add_all([
            self.buyer,
            self.seller,
            self.product,
            self.seller_account,
            self.wallet,
        ])
        self.db.flush()
        self.db.add(CartItem(
            student_id=self.buyer.student_id,
            product_id=self.product.id,
            quantity=1,
        ))
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def _student_token(self, student_id):
        user_session = UserSession(
            user_id=student_id,
            device_name="Test device",
        )
        self.db.add(user_session)
        self.db.flush()
        return main_module._create_session_token(
            student_id,
            "student",
            60,
            os.environ["SESSION_SECRET"],
            session_id=user_session.id,
        )

    def _admin_token(self):
        admin = Admin(
            username="timeout-admin",
            email="timeout-admin@example.test",
            password_hash="unused-test-hash",
            role="Admin",
            status="Active",
        )
        token = main_module._create_session_token(
            admin.username,
            "admin",
            60,
            os.environ["SESSION_SECRET"],
        )
        self.db.add(admin)
        self.db.flush()
        self.db.add(AdminSession(admin_id=admin.id, session_token=token, is_active=True))
        self.db.commit()
        return token

    def _checkout(self):
        response = self.client.post(
            "/api/student/cart/checkout",
            headers={"Authorization": f"Bearer {self._student_token(self.buyer.student_id)}"},
            json={"student_id": self.buyer.student_id},
        )
        self.assertEqual(response.status_code, 200, response.text)
        self.db.expire_all()
        order = self.db.query(Order).order_by(Order.id.desc()).first()
        return order

    def _reject_order(self, order, *, student_id=None, reason="out_of_stock", note=None):
        return self.client.post(
            f"/api/student/orders/{order.id}/reject",
            headers={"Authorization": f"Bearer {self._student_token(student_id or self.seller.student_id)}"},
            json={"reason": reason, "note": note},
        )

    def _place_additional_order(self):
        self.db.add(CartItem(
            student_id=self.buyer.student_id,
            product_id=self.product.id,
            quantity=1,
        ))
        self.db.commit()
        return self._checkout()

    def _expire_now(self, order):
        order.seller_accept_deadline = datetime.now() - timedelta(seconds=1)
        self.db.commit()
        asyncio.run(main_module._process_seller_acceptance_deadlines())
        self.db.expire_all()
        return self.db.query(Order).filter(Order.id == order.id).one()

    def test_checkout_expiry_refund_and_job_idempotency(self):
        order = self._checkout()
        self.assertIsNotNone(order.paid_at)
        self.assertIsNotNone(order.seller_accept_deadline)
        self.assertEqual(order.status, "Pending")
        self.assertEqual(order.seller_accept_deadline, order.paid_at + timedelta(hours=48))
        asyncio.run(main_module._process_seller_acceptance_deadlines())
        self.db.expire_all()
        self.assertEqual(self.db.get(Order, order.id).status, "Pending")
        self.assertEqual(self.db.get(Wallet, self.wallet.id).balance, Decimal("399.00"))

        expired = self._expire_now(order)
        self.assertEqual(expired.status, "Expired")
        self.assertIsNotNone(expired.expired_at)
        self.assertEqual(expired.refund_status, "succeeded")
        self.assertEqual(expired.payment_status, "Refunded")
        self.assertEqual(self.db.query(Wallet).filter_by(student_id=self.buyer.student_id).one().balance, Decimal("500.00"))
        self.assertEqual(self.db.get(Product, self.product.id).stock, 10)
        self.assertEqual(self.seller.missed_acceptance_count, 1)

        timeout_notifications = self.db.query(Notification).filter(
            Notification.title.in_(["Seller Acceptance Timeout", "Order Expired"]),
            Notification.target.like(f'%"order_id": {order.id}%'),
        ).count()
        refund_ledger_rows = self.db.query(Transaction).filter(
            Transaction.tx_id == f"REFUND-{order.id}",
            Transaction.description == f"Refund - Order #{order.id}",
        ).count()
        timeout_audits = self.db.query(AuditLog).filter(
            AuditLog.action == "seller_timeout",
            AuditLog.entity_id == order.id,
        ).count()
        self.assertEqual(timeout_notifications, 2)
        self.assertEqual(self.db.query(Notification).filter(
            Notification.student_id == self.buyer.student_id,
            Notification.title == "Order Expired",
            Notification.target.like(f'%"order_id": {order.id}%'),
        ).count(), 1)
        self.assertEqual(self.db.query(Notification).filter(
            Notification.student_id == self.seller.student_id,
            Notification.title == "Seller Acceptance Timeout",
            Notification.target.like(f'%"order_id": {order.id}%'),
        ).count(), 1)
        self.assertEqual(refund_ledger_rows, 1)
        self.assertEqual(timeout_audits, 1)
        seller_timeout_message = self.db.query(Notification).filter(
            Notification.student_id == self.seller.student_id,
            Notification.title == "Seller Acceptance Timeout",
        ).one().message
        self.assertIn("Warning", seller_timeout_message)

        before_retry_notifications = self.db.query(Notification).count()
        for _ in range(2):
            asyncio.run(main_module._process_seller_acceptance_deadlines())
        self.db.expire_all()
        self.assertEqual(self.db.query(Wallet).filter_by(student_id=self.buyer.student_id).one().balance, Decimal("500.00"))
        self.assertEqual(self.db.query(Notification).count(), before_retry_notifications)
        self.assertEqual(self.db.get(Student, self.seller.id).missed_acceptance_count, 1)
        expired_receipt = self.client.get(
            f"/api/student/orders/{order.id}/receipt",
            headers={"Authorization": f"Bearer {self._student_token(self.buyer.student_id)}"},
        )
        self.assertEqual(expired_receipt.status_code, 409)
        self.assertIn("refunded orders", expired_receipt.json()["detail"])
        self.assertEqual(self.db.query(Transaction).filter(
            Transaction.tx_id == f"REFUND-{order.id}"
        ).count(), 1)

    def test_student_verification_settings_save_reload_and_normalize_legacy_keys(self):
        saved = self.client.put("/api/admin/settings", json={
            "studentVerification": {
                "allowed_email_domain": "Mail.University.edu.et",
                "require_university_email": False,
                "auto_approve_students": True,
            },
        })
        self.assertEqual(saved.status_code, 200, saved.text)
        self.assertEqual(saved.json()["settings"]["studentVerification"], {
            "allowedEmailDomain": "mail.university.edu.et",
            "requireUniversityEmail": False,
            "autoApproveStudents": True,
        })

        reloaded = self.client.get("/api/admin/settings")
        self.assertEqual(reloaded.status_code, 200, reloaded.text)
        self.assertEqual(reloaded.json()["studentVerification"]["allowedEmailDomain"], "mail.university.edu.et")
        self.assertFalse(reloaded.json()["studentVerification"]["requireUniversityEmail"])
        self.assertTrue(reloaded.json()["studentVerification"]["autoApproveStudents"])

        camel_case_saved = self.client.put("/api/admin/settings", json={
            "studentVerification": {
                "allowedEmailDomain": "Students.Campus.edu.et",
                "requireUniversityEmail": True,
                "autoApproveStudents": False,
            },
        })
        self.assertEqual(camel_case_saved.status_code, 200, camel_case_saved.text)
        camel_case_reloaded = self.client.get("/api/admin/settings")
        self.assertEqual(camel_case_reloaded.json()["studentVerification"], {
            "allowedEmailDomain": "students.campus.edu.et",
            "requireUniversityEmail": True,
            "autoApproveStudents": False,
        })

        stored = self.db.query(SystemSetting).filter_by(key="studentVerification").one()
        stored.value = json.dumps({
            "allowed_email_domain": "Legacy.University.edu.et",
            "require_university_email": True,
            "auto_approve_students": False,
        })
        self.db.commit()
        legacy_reloaded = self.client.get("/api/admin/settings")
        self.assertEqual(legacy_reloaded.status_code, 200, legacy_reloaded.text)
        self.assertEqual(legacy_reloaded.json()["studentVerification"], {
            "allowedEmailDomain": "legacy.university.edu.et",
            "requireUniversityEmail": True,
            "autoApproveStudents": False,
        })

        invalid = self.client.put("/api/admin/settings", json={
            "studentVerification": {
                "allowedEmailDomain": "",
                "requireUniversityEmail": True,
                "autoApproveStudents": False,
            },
        })
        self.assertEqual(invalid.status_code, 400)
        self.assertIn("valid domain", invalid.json()["detail"])

    def test_health_and_public_products_are_available_to_vercel_guests(self):
        origin = "https://campus-market-gamma-eight.vercel.app"
        headers = {"Origin": origin}

        health = self.client.get("/health", headers=headers)
        self.assertEqual(health.status_code, 200, health.text)
        self.assertEqual(health.json(), {"status": "ok"})
        self.assertEqual(health.headers.get("access-control-allow-origin"), origin)

        products = self.client.get("/api/products", headers=headers)
        self.assertEqual(products.status_code, 200, products.text)
        self.assertTrue(isinstance(products.json(), list))
        self.assertEqual(products.headers.get("access-control-allow-origin"), origin)

    def test_successful_seller_reject_refunds_full_amount_and_notifies_buyer(self):
        order = self._checkout()
        self.buyer.notif_order_email = True
        self.db.commit()
        amount = Decimal(str(order.price)) * order.quantity + Decimal(str(order.platform_fee))

        with patch.object(main_module, "_send_student_notification_email", return_value=True) as send_email:
            response = self._reject_order(order, reason="other", note="Supplier stock was unavailable.")

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["status"], "Rejected")
        self.assertEqual(Decimal(str(response.json()["refund_amount"])), amount)
        send_email.assert_called_once()
        self.db.expire_all()
        rejected = self.db.get(Order, order.id)
        self.assertEqual(rejected.payment_status, "Refunded")
        self.assertEqual(rejected.rejection_reason, "other")
        self.assertEqual(rejected.rejection_note, "Supplier stock was unavailable.")
        self.assertEqual(self.db.get(Wallet, self.wallet.id).balance, Decimal("500.00"))
        self.assertEqual(self.db.get(Product, self.product.id).stock, 10)
        refund = self.db.query(Transaction).filter(Transaction.tx_id == f"REFUND-{order.id}").one()
        self.assertEqual(refund.description, f"Refund - Order #{order.id}")
        self.assertEqual(refund.amount, amount)
        escrow = self.db.query(Transaction).filter(
            Transaction.description == f"Escrow hold for order #{order.id}"
        ).one()
        self.assertEqual(escrow.status, "Refunded")
        notification = self.db.query(Notification).filter(
            Notification.student_id == self.buyer.student_id,
            Notification.title == "Order Rejected",
        ).one()
        self.assertIn("The seller declined your order.", notification.message)
        self.assertIn("has been refunded to your wallet.", notification.message)
        self.assertNotIn("receipt", notification.message.lower())
        receipt_response = self.client.get(
            f"/api/student/orders/{order.id}/receipt",
            headers={"Authorization": f"Bearer {self._student_token(self.buyer.student_id)}"},
        )
        self.assertEqual(receipt_response.status_code, 409)
        self.assertIn("refund confirmation", receipt_response.json()["detail"].lower())
        self.assertNotIn("receipt_number", receipt_response.json())

    def test_double_reject_does_not_credit_twice(self):
        order = self._checkout()
        first = self._reject_order(order)
        self.assertEqual(first.status_code, 200, first.text)

        second = self._reject_order(order)

        self.assertEqual(second.status_code, 409)
        self.db.expire_all()
        self.assertEqual(self.db.get(Wallet, self.wallet.id).balance, Decimal("500.00"))
        self.assertEqual(self.db.get(Product, self.product.id).stock, 10)
        self.assertEqual(self.db.query(Transaction).filter(Transaction.tx_id == f"REFUND-{order.id}").count(), 1)

    def test_reject_after_accept_is_blocked(self):
        order = self._checkout()
        accepted = self.client.post(
            f"/api/student/orders/{order.id}/seller-action",
            headers={"Authorization": f"Bearer {self._student_token(self.seller.student_id)}"},
            json={"action": "accept"},
        )
        self.assertEqual(accepted.status_code, 200, accepted.text)

        rejected = self._reject_order(order)

        self.assertEqual(rejected.status_code, 409)
        self.db.expire_all()
        self.assertEqual(self.db.get(Order, order.id).status, "Processing")
        self.assertEqual(self.db.get(Wallet, self.wallet.id).balance, Decimal("399.00"))
        self.assertEqual(self.db.get(Product, self.product.id).stock, 9)

    def test_non_seller_cannot_reject_order(self):
        order = self._checkout()

        response = self._reject_order(order, student_id=self.buyer.student_id)

        self.assertEqual(response.status_code, 403)
        self.db.expire_all()
        self.assertEqual(self.db.get(Order, order.id).status, "Pending")
        self.assertEqual(self.db.get(Wallet, self.wallet.id).balance, Decimal("399.00"))
        self.assertEqual(self.db.query(Transaction).filter(Transaction.tx_id == f"REFUND-{order.id}").count(), 0)

    def test_accept_before_deadline_survives_later_job_run(self):
        order = self._checkout()
        response = self.client.post(
            f"/api/student/orders/{order.id}/seller-action",
            headers={"Authorization": f"Bearer {self._student_token(self.seller.student_id)}"},
            json={"action": "accept"},
        )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["status"], "Processing")
        receipt_response = self.client.get(
            f"/api/student/orders/{order.id}/receipt",
            headers={"Authorization": f"Bearer {self._student_token(self.buyer.student_id)}"},
        )
        self.assertEqual(receipt_response.status_code, 200, receipt_response.text)
        receipt = receipt_response.json()
        self.assertEqual(receipt["payment_status"], "Successful")
        expected_percent = float(Decimal(str(order.platform_fee)) * Decimal("100") / Decimal(str(order.price)))
        self.assertEqual(receipt["platform_commission_percent"], expected_percent)
        self.assertIn(f"({expected_percent:g}%", receipt["platform_commission_label"])

        order = self.db.get(Order, order.id)
        order.seller_accept_deadline = datetime.now() - timedelta(seconds=1)
        self.db.commit()
        asyncio.run(main_module._process_seller_acceptance_deadlines())
        self.db.expire_all()
        self.assertEqual(self.db.get(Order, order.id).status, "Processing")
        self.assertEqual(self.db.get(Student, self.seller.id).missed_acceptance_count, 0)

    def test_accept_after_deadline_returns_conflict_without_changing_status(self):
        order = self._checkout()
        order.seller_accept_deadline = datetime.now() - timedelta(seconds=1)
        self.db.commit()

        response = self.client.post(
            f"/api/student/orders/{order.id}/seller-action",
            headers={"Authorization": f"Bearer {self._student_token(self.seller.student_id)}"},
            json={"action": "accept"},
        )
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["detail"], "Order expired or already handled")
        self.db.expire_all()
        self.assertEqual(self.db.get(Order, order.id).status, "Pending")

    def test_failed_expiry_refund_rolls_back_and_retries_cleanly(self):
        order = self._checkout()
        order.seller_accept_deadline = datetime.now() - timedelta(seconds=1)
        self.db.commit()
        original_apply_transaction = main_module.apply_transaction

        def fail_refund(*args, **kwargs):
            if kwargs.get("transaction_type") == "Refund":
                raise RuntimeError("simulated wallet credit failure")
            return original_apply_transaction(*args, **kwargs)

        with patch.object(main_module, "apply_transaction", side_effect=fail_refund):
            asyncio.run(main_module._process_seller_acceptance_deadlines())
            self.db.expire_all()
            self.assertEqual(self.db.get(Order, order.id).status, "Pending")
            self.assertEqual(self.db.get(Order, order.id).payment_status, "Successful")
            self.assertEqual(self.db.get(Order, order.id).refund_status, "none")
            self.assertEqual(self.db.get(Wallet, self.wallet.id).balance, Decimal("399.00"))
            self.assertEqual(self.db.get(Product, self.product.id).stock, 9)
            self.assertEqual(self.db.query(Transaction).filter(
                Transaction.tx_id == f"REFUND-{order.id}"
            ).count(), 0)

        asyncio.run(main_module._process_seller_acceptance_deadlines())
        self.db.expire_all()
        self.assertEqual(self.db.get(Order, order.id).status, "Expired")
        self.assertEqual(self.db.get(Order, order.id).refund_status, "succeeded")
        self.assertEqual(self.db.get(Wallet, self.wallet.id).balance, Decimal("500.00"))
        self.assertEqual(self.db.get(Product, self.product.id).stock, 10)
        self.assertEqual(self.db.query(Transaction).filter(
            Transaction.tx_id == f"REFUND-{order.id}"
        ).count(), 1)

    def test_12_hour_and_22_hour_reminders_are_each_sent_once(self):
        order = self._checkout()
        order.paid_at = datetime.now() - timedelta(hours=37)
        order.seller_accept_deadline = order.paid_at + timedelta(hours=48)
        self.db.commit()
        asyncio.run(main_module._process_seller_acceptance_deadlines())
        self.db.expire_all()
        self.assertTrue(self.db.get(Order, order.id).seller_reminder_12h_sent)
        reminder_count = self.db.query(Notification).filter(
            Notification.student_id == self.seller.student_id,
            Notification.title == "Order Acceptance Reminder",
        ).count()
        self.assertEqual(reminder_count, 1)
        asyncio.run(main_module._process_seller_acceptance_deadlines())
        self.db.expire_all()
        self.assertEqual(self.db.query(Notification).filter(
            Notification.student_id == self.seller.student_id,
            Notification.title == "Order Acceptance Reminder",
        ).count(), 1)

        second_order = self._place_additional_order()
        second_order.paid_at = datetime.now() - timedelta(hours=27)
        second_order.seller_accept_deadline = second_order.paid_at + timedelta(hours=48)
        self.db.commit()
        asyncio.run(main_module._process_seller_acceptance_deadlines())
        self.db.expire_all()
        self.assertTrue(self.db.get(Order, second_order.id).seller_reminder_22h_sent)
        self.assertEqual(self.db.query(Notification).filter(
            Notification.student_id == self.seller.student_id,
            Notification.title == "Order Acceptance Reminder",
        ).count(), 2)
        asyncio.run(main_module._process_seller_acceptance_deadlines())
        self.db.expire_all()
        self.assertEqual(self.db.query(Notification).filter(
            Notification.student_id == self.seller.student_id,
            Notification.title == "Order Acceptance Reminder",
        ).count(), 2)

    def test_third_timeout_suspends_seller_for_seven_days(self):
        for expected_count in range(1, 4):
            order = self._checkout() if expected_count == 1 else self._place_additional_order()
            expired = self._expire_now(order)
            self.assertEqual(expired.refund_status, "succeeded")
            self.db.expire_all()
            seller = self.db.get(Student, self.seller.id)
            self.assertEqual(seller.missed_acceptance_count, expected_count)

        self.assertIsNotNone(seller.suspended_until)
        self.assertGreaterEqual(seller.suspended_until, datetime.now() + timedelta(days=7) - timedelta(seconds=2))
        self.assertIn("suspended", seller.restriction_reason.lower())


if __name__ == "__main__":
    unittest.main()
