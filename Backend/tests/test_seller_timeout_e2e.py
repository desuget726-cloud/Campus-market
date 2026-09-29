import asyncio
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
    Transaction,
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
        return main_module._create_session_token(
            student_id,
            "student",
            60,
            os.environ["SESSION_SECRET"],
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
        self.assertEqual(order.seller_accept_deadline, order.paid_at + timedelta(hours=24))

        expired = self._expire_now(order)
        self.assertEqual(expired.status, "Refunded")
        self.assertIsNotNone(expired.expired_at)
        self.assertEqual(expired.refund_status, "succeeded")
        self.assertEqual(self.db.query(Wallet).filter_by(student_id=self.buyer.student_id).one().balance, Decimal("500.00"))
        self.assertEqual(self.db.get(Product, self.product.id).stock, 10)
        self.assertEqual(self.seller.missed_acceptance_count, 1)

        timeout_notifications = self.db.query(Notification).filter(
            Notification.title.in_(["Seller Acceptance Timeout", "Order Expired"]),
            Notification.target.like(f'%"order_id": {order.id}%'),
        ).count()
        refund_ledger_rows = self.db.query(Transaction).filter(
            Transaction.tx_id == f"REFUND-SELLER-TIMEOUT-{order.id}"
        ).count()
        timeout_audits = self.db.query(AuditLog).filter(
            AuditLog.action == "seller_timeout",
            AuditLog.entity_id == order.id,
        ).count()
        self.assertEqual(timeout_notifications, 3)
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
        self.assertEqual(self.db.query(Transaction).filter(
            Transaction.tx_id == f"REFUND-SELLER-TIMEOUT-{order.id}"
        ).count(), 1)

    def test_accept_before_deadline_survives_later_job_run(self):
        order = self._checkout()
        response = self.client.post(
            f"/api/student/orders/{order.id}/seller-action",
            headers={"Authorization": f"Bearer {self._student_token(self.seller.student_id)}"},
            json={"action": "accept"},
        )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["status"], "Processing")

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

    def test_failed_refund_stops_after_three_attempts_and_admin_retry_credits_once(self):
        order = self._checkout()
        original_apply_transaction = main_module.apply_transaction

        def fail_refund(*args, **kwargs):
            if kwargs.get("transaction_type") == "Refund":
                raise RuntimeError("simulated wallet credit failure")
            return original_apply_transaction(*args, **kwargs)

        with patch.object(main_module, "apply_transaction", side_effect=fail_refund):
            for expected_attempt in range(1, 4):
                if expected_attempt == 1:
                    order.seller_accept_deadline = datetime.now() - timedelta(seconds=1)
                    self.db.commit()
                asyncio.run(main_module._process_seller_acceptance_deadlines())
                self.db.expire_all()
                failed_order = self.db.get(Order, order.id)
                self.assertEqual(failed_order.refund_status, "failed")
                self.assertEqual(failed_order.refund_attempts, expected_attempt)

            asyncio.run(main_module._process_seller_acceptance_deadlines())
            self.db.expire_all()
            self.assertEqual(self.db.get(Order, order.id).refund_attempts, 3)

            unauthorized = self.client.post(f"/api/admin/orders/{order.id}/retry-refund")
            self.assertEqual(unauthorized.status_code, 401)

        admin_token = self._admin_token()
        retried = self.client.post(
            f"/api/admin/orders/{order.id}/retry-refund",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        self.assertEqual(retried.status_code, 200, retried.text)
        self.db.expire_all()
        self.assertEqual(self.db.get(Order, order.id).refund_status, "succeeded")
        self.assertEqual(self.db.get(Order, order.id).refund_attempts, 4)
        self.assertEqual(self.db.get(Wallet, self.wallet.id).balance, Decimal("500.00"))
        self.assertEqual(self.db.query(Transaction).filter(
            Transaction.tx_id == f"REFUND-SELLER-TIMEOUT-{order.id}"
        ).count(), 1)

        retried_again = self.client.post(
            f"/api/admin/orders/{order.id}/retry-refund",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        self.assertEqual(retried_again.status_code, 200)
        self.db.expire_all()
        self.assertEqual(self.db.get(Wallet, self.wallet.id).balance, Decimal("500.00"))
        self.assertEqual(self.db.get(Order, order.id).refund_attempts, 4)

    def test_12_hour_and_22_hour_reminders_are_each_sent_once(self):
        order = self._checkout()
        order.paid_at = datetime.now() - timedelta(hours=13)
        order.seller_accept_deadline = order.paid_at + timedelta(hours=24)
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
        second_order.paid_at = datetime.now() - timedelta(hours=2)
        second_order.seller_accept_deadline = second_order.paid_at + timedelta(hours=24)
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
