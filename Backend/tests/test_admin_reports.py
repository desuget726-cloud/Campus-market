import asyncio
import base64
import hashlib
import hmac
import json
import os
import time
import unittest
from decimal import Decimal
from unittest.mock import patch

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["SESSION_SECRET"] = "reports-test-secret"

import httpx

from app import main as main_module
from app import database as database_module
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
from sqlalchemy import create_engine, inspect, text
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

    def test_review_is_idempotent_for_same_and_different_admins(self):
        report, _ = self.create_report()
        first = self.request(
            "POST",
            f"/api/admin/reports/{report.id}/review",
            headers=self.headers,
            json_body={},
        )
        self.db.refresh(report)
        original_reviewed_at = report.reviewed_at
        original_reviewer_id = report.reviewed_by

        second_admin = Admin(
            username="reports-admin-second",
            email="reports-admin-second@example.test",
            password_hash="test-hash",
            role="Admin",
        )
        self.db.add(second_admin)
        self.db.flush()
        second_token = _jwt(second_admin.username, "admin")
        self.db.add(AdminSession(
            admin_id=second_admin.id,
            session_token=second_token,
            is_active=True,
        ))
        self.db.commit()

        same_admin_response = self.request(
            "POST",
            f"/api/admin/reports/{report.id}/review",
            headers=self.headers,
            json_body={},
        )
        second_admin_response = self.request(
            "POST",
            f"/api/admin/reports/{report.id}/review",
            headers={"Authorization": f"Bearer {second_token}"},
            json_body={},
        )
        self.db.refresh(report)

        self.assertEqual(first.status_code, 200)
        self.assertEqual(same_admin_response.status_code, 200)
        self.assertEqual(second_admin_response.status_code, 200)
        self.assertEqual(report.reviewed_by, original_reviewer_id)
        self.assertEqual(report.reviewed_at, original_reviewed_at)

    def test_review_legacy_report_without_related_links(self):
        report = Report(
            student_id=None,
            seller_id=None,
            product_id=None,
            order_id=None,
            student_name="Legacy Reporter",
            issue="A legacy report with no linked records.",
            status="Open",
        )
        self.db.add(report)
        self.db.flush()

        response = self.request(
            "POST",
            f"/api/admin/reports/{report.id}/review",
            headers=self.headers,
            json_body={},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["seller_id"], "Not linked")
        self.assertEqual(payload["seller_name"], "Not linked")
        self.assertEqual(payload["product_name"], "Not linked")
        self.assertEqual(payload["order_name"], "Not linked")
        context = self.request(
            "GET",
            f"/api/admin/reports/{report.id}/context",
            headers=self.headers,
        )
        self.assertEqual(context.status_code, 200)
        self.assertEqual(context.json()["seller"]["seller_name"], "Not linked")
        self.assertEqual(context.json()["product"]["title"], "Not linked")
        self.assertEqual(context.json()["order"]["title"], "Not linked")

    def test_review_report_with_deleted_related_records(self):
        report, order = self.create_report(with_order=True)
        product = self.db.query(Product).filter(Product.id == report.product_id).one()
        self.db.delete(order)
        self.db.delete(product)
        self.db.delete(self.seller)
        self.db.flush()

        response = self.request(
            "POST",
            f"/api/admin/reports/{report.id}/review",
            headers=self.headers,
            json_body={},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["seller_name"], "Not linked")
        self.assertEqual(payload["product_name"], "Not linked")
        self.assertEqual(payload["order_name"], "Not linked")
        context = self.request(
            "GET",
            f"/api/admin/reports/{report.id}/context",
            headers=self.headers,
        )
        self.assertEqual(context.status_code, 200)
        self.assertEqual(context.json()["seller"]["seller_name"], "Not linked")
        self.assertEqual(context.json()["product"]["title"], "Not linked")
        self.assertEqual(context.json()["order"]["title"], "Not linked")

    def test_closed_reports_are_returned_read_only(self):
        for status in ("Resolved", "Dismissed"):
            with self.subTest(status=status):
                report, _ = self.create_report(status=status)
                original_reviewed_by = report.reviewed_by
                original_reviewed_at = report.reviewed_at
                response = self.request(
                    "POST",
                    f"/api/admin/reports/{report.id}/review",
                    headers=self.headers,
                    json_body={},
                )
                self.db.refresh(report)

                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json()["status"], status)
                self.assertEqual(report.reviewed_by, original_reviewed_by)
                self.assertEqual(report.reviewed_at, original_reviewed_at)

    def test_missing_report_returns_404_and_student_returns_403(self):
        missing_response = self.request(
            "POST",
            "/api/admin/reports/99999/review",
            headers=self.headers,
            json_body={},
        )
        student_response = self.request(
            "POST",
            "/api/admin/reports/1/review",
            headers={"Authorization": f"Bearer {self.student_token}"},
            json_body={},
        )

        self.assertEqual(missing_response.status_code, 404)
        self.assertEqual(student_response.status_code, 403)

    def test_review_succeeds_when_notification_side_effect_fails(self):
        report, _ = self.create_report()

        with self.assertLogs("app.reports", level="ERROR") as captured:
            with patch.object(
                main_module,
                "_queue_student_item_notification",
                side_effect=RuntimeError("notification service unavailable"),
            ):
                response = self.request(
                    "POST",
                    f"/api/admin/reports/{report.id}/review",
                    headers=self.headers,
                    json_body={},
                )

        self.db.refresh(report)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(report.status, "Under Review")
        self.assertIn(f"report_id={report.id}", captured.output[0])
        self.assertNotIn(report.issue, "\n".join(captured.output))

    def test_review_succeeds_when_audit_log_write_fails(self):
        report, _ = self.create_report()
        original_add = self.db.add

        def add_without_report_audit(instance):
            if isinstance(instance, AuditLog) and instance.action == "Report Status Changed":
                raise RuntimeError("audit log unavailable")
            return original_add(instance)

        with self.assertLogs("app.reports", level="ERROR") as captured:
            with patch.object(self.db, "add", side_effect=add_without_report_audit):
                response = self.request(
                    "POST",
                    f"/api/admin/reports/{report.id}/review",
                    headers=self.headers,
                    json_body={},
                )

        self.db.refresh(report)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(report.status, "Under Review")
        self.assertIn(f"report_id={report.id}", captured.output[0])

    def test_unknown_report_state_returns_409(self):
        report, _ = self.create_report(status="Archived")

        response = self.request(
            "POST",
            f"/api/admin/reports/{report.id}/review",
            headers=self.headers,
            json_body={},
        )

        self.assertEqual(response.status_code, 409)

    def test_startup_migration_is_idempotent_and_lists_no_missing_report_columns(self):
        self.db.commit()
        self.db.close()
        with self.engine.begin() as connection:
            connection.execute(text("DROP TABLE reports"))
            connection.execute(text(
                "CREATE TABLE reports ("
                "id INTEGER PRIMARY KEY, "
                "student_name VARCHAR(150) NOT NULL, "
                "issue VARCHAR(1000) NOT NULL, "
                "priority VARCHAR(20) NOT NULL DEFAULT 'Low', "
                "status VARCHAR(50) NOT NULL DEFAULT 'Open')"
            ))

        with patch.object(database_module, "engine", self.engine):
            database_module.init_db()
            database_module.init_db()
            missing_columns = database_module.missing_model_columns({"reports"})

        self.assertEqual(missing_columns, {})
        table_names = set(inspect(self.engine).get_table_names())
        self.assertTrue({"admin_item_seen", "report_messages", "support_ticket_messages"}.issubset(table_names))
        with self.engine.begin() as connection:
            connection.execute(text(
                "INSERT INTO reports (id, student_name, issue) "
                "VALUES (15, 'Legacy reporter', 'Legacy report body')"
            ))
        self.db = self.session_factory()
        response = self.request(
            "POST",
            "/api/admin/reports/15/review",
            headers=self.headers,
            json_body={},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "Under Review")

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
