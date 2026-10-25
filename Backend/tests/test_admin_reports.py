import asyncio
import base64
import hashlib
import hmac
import json
import os
import time
import unittest
from decimal import Decimal

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["SESSION_SECRET"] = "reports-test-secret"

import httpx

from app import main as main_module
from app.database import Base, get_db
from app.models import (
    Admin,
    AdminSession,
    AuditLog,
    Dispute,
    Order,
    Product,
    Report,
    Student,
    Transaction,
    Wallet,
)
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool


def _b64(value):
    return base64.urlsafe_b64encode(value).decode().rstrip("=")


def _jwt(subject, role):
    header = _b64(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    payload = _b64(json.dumps({
        "sub": subject,
        "role": role,
        "exp": time.time() + 3600,
    }).encode())
    unsigned = f"{header}.{payload}"
    signature = hmac.new(
        os.environ["SESSION_SECRET"].encode(),
        unsigned.encode(),
        hashlib.sha256,
    ).digest()
    return f"{unsigned}.{_b64(signature)}"


class AdminReportEndpointTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        cls.session_factory = sessionmaker(bind=cls.engine, autoflush=False, autocommit=False)
        Base.metadata.create_all(bind=cls.engine)

    @classmethod
    def tearDownClass(cls):
        cls.engine.dispose()

    def setUp(self):
        Base.metadata.drop_all(bind=self.engine)
        Base.metadata.create_all(bind=self.engine)
        self.db = self.session_factory()
        self.admin = Admin(
            username="reports-admin",
            email="reports-admin@example.test",
            password_hash="test-hash",
            role="Admin",
        )
        self.reporter = Student(
            name="Reporter",
            student_id="reporter-1",
            email="reporter@example.test",
            password="test-hash",
            college="Test College",
            department="Testing",
            is_verified=True,
        )
        self.seller = Student(
            name="Reported Seller",
            student_id="seller-1",
            email="seller@example.test",
            password="test-hash",
            college="Test College",
            department="Testing",
        )
        self.db.add_all([self.admin, self.reporter, self.seller])
        self.db.flush()
        self.admin_token = _jwt(self.admin.username, "admin")
        self.db.add(AdminSession(
            admin_id=self.admin.id,
            session_token=self.admin_token,
            is_active=True,
        ))
        self.db.flush()
        self.headers = {"Authorization": f"Bearer {self.admin_token}"}
        self.student_token = _jwt(self.reporter.student_id, "student")

        def override_get_db():
            yield self.db

        main_module.app.dependency_overrides[get_db] = override_get_db

    def tearDown(self):
        main_module.app.dependency_overrides.pop(get_db, None)
        self.db.close()

    def request(self, method, path, *, headers=None, json_body=None):
        async def send():
            transport = httpx.ASGITransport(app=main_module.app)
            async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
                return await client.request(method, path, headers=headers, json=json_body)

        return asyncio.run(send())

    def create_report(self, *, status="Open", with_order=False):
        order = None
        product = Product(
            title="Reported Product",
            category="Test",
            price="100.00",
            seller=self.seller.student_id,
            seller_id=self.seller.student_id,
        )
        self.db.add(product)
        self.db.flush()
        if with_order:
            order = Order(
                student_id=self.reporter.student_id,
                product_id=product.id,
                title=product.title,
                price="100.00",
                quantity=1,
                seller_id=self.seller.student_id,
                payment_status="Successful",
            )
            self.db.add(order)
            self.db.flush()
        report = Report(
            product_id=product.id,
            order_id=order.id if order else None,
            student_id=self.reporter.student_id,
            seller_id=self.seller.student_id,
            student_name=self.reporter.name,
            email=self.reporter.email,
            category="Product Report",
            issue="A detailed report about this product.",
            status=status,
            reviewed_by=self.admin.id if status == "Under Review" else None,
        )
        self.db.add(report)
        self.db.flush()
        return report, order

    def prepare_order_wallets_and_payment(self, order):
        buyer_wallet = Wallet(student_id=self.reporter.student_id, balance=Decimal("100.00"))
        seller_wallet = Wallet(student_id=self.seller.student_id, balance=Decimal("500.00"))
        self.db.add_all([buyer_wallet, seller_wallet])
        self.db.flush()
        self.db.add(Transaction(
            student_id=self.reporter.student_id,
            wallet_id=buyer_wallet.id,
            tx_id=f"ORDER-PAY-{order.id}",
            type="Product Purchase",
            amount=Decimal("100.00"),
            description=f"Payment for order #{order.id}",
            status="Successful",
        ))
        self.db.flush()

    def test_resolve_without_reason_returns_422(self):
        report, _ = self.create_report(status="Under Review")

        response = self.request(
            "POST",
            f"/api/admin/reports/{report.id}/resolve",
            headers=self.headers,
            json_body={"decision": "Reject"},
        )

        self.assertEqual(response.status_code, 422)

    def test_admin_review_claims_open_report(self):
        report, _ = self.create_report()

        response = self.request(
            "POST",
            f"/api/admin/reports/{report.id}/review",
            headers=self.headers,
            json_body={},
        )
        self.db.refresh(report)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(report.status, "Under Review")
        self.assertEqual(report.reviewed_by, self.admin.id)
        self.assertIsNotNone(report.reviewed_at)

    def test_non_admin_is_forbidden(self):
        response = self.request(
            "GET",
            "/api/admin/reports",
            headers={"Authorization": f"Bearer {self.student_token}"},
        )

        self.assertEqual(response.status_code, 403)

    def test_refund_above_paid_amount_is_rejected(self):
        report, order = self.create_report(status="Under Review", with_order=True)
        self.prepare_order_wallets_and_payment(order)

        response = self.request(
            "POST",
            f"/api/admin/reports/{report.id}/resolve",
            headers=self.headers,
            json_body={
                "decision": "Refund",
                "reason": "Refund amount is not allowed.",
                "refund_amount": "100.01",
            },
        )

        self.assertEqual(response.status_code, 422)
        self.assertEqual(self.db.query(Transaction).filter(Transaction.type == "Refund").count(), 0)

    def test_report_cannot_be_refunded_twice(self):
        report, order = self.create_report(status="Under Review", with_order=True)
        self.prepare_order_wallets_and_payment(order)
        payload = {
            "decision": "Refund",
            "reason": "Refund the order payment.",
            "refund_amount": "25.00",
        }

        first = self.request(
            "POST",
            f"/api/admin/reports/{report.id}/resolve",
            headers=self.headers,
            json_body=payload,
        )
        self.assertEqual(first.status_code, 200)
        self.assertEqual(self.db.query(Transaction).filter(Transaction.type == "Refund").count(), 1)
        self.assertEqual(self.db.query(Transaction).filter(Transaction.type == "Seller Payout").count(), 1)

        second = self.request(
            "POST",
            f"/api/admin/reports/{report.id}/resolve",
            headers=self.headers,
            json_body=payload,
        )
        self.assertEqual(second.status_code, 409)
        self.assertEqual(self.db.query(Transaction).filter(Transaction.type == "Refund").count(), 1)

    def test_refund_can_use_funds_frozen_for_the_order_dispute(self):
        report, order = self.create_report(status="Under Review", with_order=True)
        self.prepare_order_wallets_and_payment(order)
        seller_wallet = self.db.query(Wallet).filter_by(student_id=self.seller.student_id).one()
        seller_wallet.balance = Decimal("0.00")
        seller_wallet.frozen_balance = Decimal("100.00")
        dispute = Dispute(
            order_id=order.id,
            buyer_id=self.reporter.student_id,
            seller_id=self.seller.student_id,
            reason="Order issue",
            description="Funds are held pending review.",
            previous_order_status="Delivered",
            frozen_amount=Decimal("100.00"),
        )
        self.db.add(dispute)
        self.db.flush()

        response = self.request(
            "POST",
            f"/api/admin/reports/{report.id}/resolve",
            headers=self.headers,
            json_body={
                "decision": "Refund",
                "reason": "The order issue is supported by evidence.",
                "refund_amount": "50.00",
            },
        )

        self.db.refresh(seller_wallet)
        self.db.refresh(dispute)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(seller_wallet.balance, Decimal("0.00"))
        self.assertEqual(seller_wallet.frozen_balance, Decimal("50.00"))
        self.assertEqual(dispute.frozen_amount, Decimal("50.00"))
        self.assertEqual(
            self.db.query(Transaction).filter(Transaction.type == "Dispute Release").one().amount,
            Decimal("50.00"),
        )

    def test_decision_writes_admin_audit_log(self):
        report, _ = self.create_report(status="Under Review")

        response = self.request(
            "POST",
            f"/api/admin/reports/{report.id}/resolve",
            headers=self.headers,
            json_body={
                "decision": "Reject",
                "reason": "Evidence does not support the complaint.",
            },
        )

        self.assertEqual(response.status_code, 200)
        audit = self.db.query(AuditLog).filter(
            AuditLog.entity_type == "Report",
            AuditLog.entity_id == report.id,
            AuditLog.action == "Report Resolved",
        ).one()
        self.assertEqual(audit.admin_id, self.admin.id)
        self.assertIn("Evidence does not support the complaint.", audit.description)


if __name__ == "__main__":
    unittest.main()
