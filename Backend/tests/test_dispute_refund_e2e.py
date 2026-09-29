import os
import unittest
from datetime import datetime, timedelta
from decimal import Decimal
from unittest.mock import patch

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["SESSION_SECRET"] = "dispute-refund-e2e-test-secret"

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
    Dispute,
    Notification,
    Order,
    Product,
    Student,
    Transaction,
    Wallet,
)


class DisputeRefundE2ETests(unittest.TestCase):
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
        cls.original_init_db = main_module.init_db
        main_module.init_db = lambda: Base.metadata.create_all(bind=cls.engine)
        Base.metadata.create_all(bind=cls.engine)

    @classmethod
    def tearDownClass(cls):
        cls.client.close()
        main_module.app.dependency_overrides.pop(main_module.get_db, None)
        main_module.SessionLocal = cls.original_session_local
        main_module.init_db = cls.original_init_db
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
            name="Dispute Buyer",
            student_id="dispute-buyer",
            email="dispute-buyer@example.test",
            password="test-password",
            college="Test College",
            department="Testing",
            wallet_balance=Decimal("0.00"),
            notif_order_inapp=True,
            notif_order_email=False,
        )
        self.other_student = Student(
            name="Other Buyer",
            student_id="other-buyer",
            email="other-buyer@example.test",
            password="test-password",
            college="Test College",
            department="Testing",
            wallet_balance=Decimal("0.00"),
            notif_order_inapp=True,
            notif_order_email=False,
        )
        self.seller = Student(
            name="Dispute Seller",
            student_id="dispute-seller",
            email="dispute-seller@example.test",
            password="test-password",
            college="Test College",
            department="Testing",
            wallet_balance=Decimal("0.00"),
            notif_order_inapp=True,
            notif_order_email=False,
        )
        self.admin = Admin(
            username="dispute-admin",
            email="dispute-admin@example.test",
            password_hash="unused-test-hash",
            role="Admin",
            status="Active",
        )
        self.product = Product(
            title="Dispute Test Item",
            category="Test",
            price="100.00",
            stock=1,
            seller=self.seller.student_id,
            status="Approved",
        )
        self.wallet = Wallet(student_id=self.buyer.student_id, balance=Decimal("0.00"))
        self.db.add_all([self.buyer, self.other_student, self.seller, self.admin, self.product, self.wallet])
        self.db.flush()
        self.admin_token = main_module._create_session_token(
            self.admin.username,
            "admin",
            60,
            os.environ["SESSION_SECRET"],
        )
        self.db.add(AdminSession(admin_id=self.admin.id, session_token=self.admin_token, is_active=True))
        self.order = Order(
            student_id=self.buyer.student_id,
            product_id=self.product.id,
            title=self.product.title,
            price=self.product.price,
            seller_id=self.seller.student_id,
            seller_name=self.seller.name,
            buyer_name=self.buyer.name,
            quantity=1,
            status="Expired",
            pickup_code=1234,
            payment_status="Successful",
            paid_at=datetime.now() - timedelta(hours=25),
            seller_accept_deadline=datetime.now() - timedelta(hours=1),
            expired_at=datetime.now() - timedelta(minutes=20),
            refund_status="failed",
            refund_attempts=1,
            refund_reference="REFUND-SELLER-TIMEOUT-1",
        )
        self.db.add(self.order)
        self.db.flush()
        self.order.refund_reference = f"REFUND-SELLER-TIMEOUT-{self.order.id}"
        self.db.add(Transaction(
            student_id=self.buyer.student_id,
            wallet_id=self.wallet.id,
            tx_id=f"ESCROW-HOLD-{self.order.id}",
            type="Escrow Hold",
            amount=Decimal("100.00"),
            description=f"Escrow hold for order #{self.order.id}",
            status="Successful",
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

    def _open_refund_dispute(self, student_id=None):
        owner = student_id or self.buyer.student_id
        return self.client.post(
            f"/api/student/orders/{self.order.id}/dispute",
            headers={"Authorization": f"Bearer {self._student_token(owner)}"},
            json={
                "reason": "refund_not_received",
                "description": "The seller timeout refund has not arrived in my wallet.",
            },
        )

    def _admin_headers(self):
        return {"Authorization": f"Bearer {self.admin_token}"}

    def test_buyer_can_open_dispute_for_expired_failed_refund(self):
        response = self._open_refund_dispute()
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["dispute"]["reason"], "refund_not_received")
        self.assertEqual(response.json()["status"], "Disputed")
        self.db.expire_all()
        dispute = self.db.query(Dispute).one()
        self.assertEqual(dispute.buyer_id, self.buyer.student_id)
        self.assertEqual(dispute.previous_order_status, "Expired")

    def test_buyer_cannot_dispute_already_succeeded_refund(self):
        self.order.refund_status = "succeeded"
        self.db.commit()
        response = self._open_refund_dispute()
        self.assertEqual(response.status_code, 409)
        self.assertEqual(self.db.query(Dispute).count(), 0)

    def test_pending_refund_is_disputable_after_timeout_window(self):
        self.order.refund_status = "pending"
        self.db.commit()
        response = self._open_refund_dispute()
        self.assertEqual(response.status_code, 200, response.text)

    def test_failed_admin_retry_of_pending_refund_records_attempt(self):
        self.order.refund_status = "pending"
        self.db.commit()
        opened = self._open_refund_dispute()
        self.assertEqual(opened.status_code, 200, opened.text)

        with patch.object(main_module, "apply_transaction", side_effect=RuntimeError("wallet unavailable")):
            retried = self.client.post(
                f"/api/admin/orders/{self.order.id}/retry-refund",
                headers=self._admin_headers(),
            )
        self.assertEqual(retried.status_code, 502)
        self.db.expire_all()
        self.assertEqual(self.db.get(Order, self.order.id).refund_status, "failed")
        self.assertEqual(self.db.get(Order, self.order.id).refund_attempts, 2)

    def test_refund_problem_cannot_be_reported_before_15_minutes(self):
        self.order.expired_at = datetime.now() - timedelta(minutes=14, seconds=59)
        self.db.commit()
        response = self._open_refund_dispute()
        self.assertEqual(response.status_code, 409)
        self.assertEqual(self.db.query(Dispute).count(), 0)

    def test_second_active_dispute_for_order_is_rejected(self):
        first = self._open_refund_dispute()
        self.assertEqual(first.status_code, 200, first.text)
        second = self._open_refund_dispute()
        self.assertEqual(second.status_code, 409)
        self.assertEqual(self.db.query(Dispute).count(), 1)

    def test_another_student_cannot_dispute_order(self):
        unauthenticated = self.client.post(
            f"/api/student/orders/{self.order.id}/dispute",
            json={
                "reason": "refund_not_received",
                "description": "The seller timeout refund has not arrived in my wallet.",
            },
        )
        self.assertEqual(unauthenticated.status_code, 401)
        response = self._open_refund_dispute(self.other_student.student_id)
        self.assertEqual(response.status_code, 403)
        self.assertEqual(self.db.query(Dispute).count(), 0)

    def test_admin_retry_credits_once_and_closes_dispute(self):
        opened = self._open_refund_dispute()
        self.assertEqual(opened.status_code, 200, opened.text)

        for _ in range(2):
            retried = self.client.post(
                f"/api/admin/orders/{self.order.id}/retry-refund",
                headers=self._admin_headers(),
            )
            self.assertEqual(retried.status_code, 200, retried.text)

        self.db.expire_all()
        order = self.db.get(Order, self.order.id)
        dispute = self.db.query(Dispute).one()
        self.assertEqual(order.refund_status, "succeeded")
        self.assertEqual(order.status, "Refunded")
        self.assertEqual(dispute.status, "RESOLVED")
        self.assertEqual(dispute.resolution, "REFUNDED")
        self.assertEqual(self.db.get(Wallet, self.wallet.id).balance, Decimal("100.00"))
        self.assertEqual(self.db.query(Transaction).filter(
            Transaction.tx_id == f"REFUND-SELLER-TIMEOUT-{self.order.id}",
            Transaction.type == "Refund",
            Transaction.status == "Successful",
        ).count(), 1)
        self.assertGreaterEqual(self.db.query(Notification).filter(
            Notification.student_id == self.buyer.student_id,
            Notification.title == "Dispute Resolved",
        ).count(), 1)
        self.assertGreaterEqual(self.db.query(AuditLog).filter(
            AuditLog.action == "Dispute Resolved",
            AuditLog.entity_id == self.order.id,
        ).count(), 1)

    def test_admin_buyer_resolution_uses_timeout_reference_once_and_is_idempotent(self):
        opened = self._open_refund_dispute()
        self.assertEqual(opened.status_code, 200, opened.text)
        dispute_id = opened.json()["dispute"]["id"]

        for _ in range(2):
            resolved = self.client.patch(
                f"/api/admin/disputes/{dispute_id}/resolve",
                headers=self._admin_headers(),
                json={"decision": "BUYER"},
            )
            self.assertEqual(resolved.status_code, 200, resolved.text)

        self.db.expire_all()
        dispute = self.db.get(Dispute, dispute_id)
        order = self.db.get(Order, self.order.id)
        self.assertEqual(dispute.status, "RESOLVED")
        self.assertEqual(order.refund_status, "succeeded")
        self.assertEqual(order.refund_reference, f"REFUND-SELLER-TIMEOUT-{self.order.id}")
        self.assertEqual(self.db.get(Wallet, self.wallet.id).balance, Decimal("100.00"))
        self.assertEqual(self.db.query(Transaction).filter(
            Transaction.tx_id == f"REFUND-SELLER-TIMEOUT-{self.order.id}"
        ).count(), 1)


if __name__ == "__main__":
    unittest.main()
