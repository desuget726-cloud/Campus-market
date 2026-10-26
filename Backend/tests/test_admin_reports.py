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
    ReportMessage,
    Notification,
    Student,
    UserSession,
    Transaction,
    Wallet,
)
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool


def _b64(value):
    return base64.urlsafe_b64encode(value).decode().rstrip("=")


def _jwt(subject, role, session_id=None):
    header = _b64(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    payload = _b64(json.dumps({
        "sub": subject,
        "role": role,
        "exp": time.time() + 3600,
        **({"session_id": session_id} if session_id else {}),
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
        self.student_token = _jwt(
            self.reporter.student_id,
            "student",
            session_id="00000000-0000-0000-0000-000000000001",
        )
        self.seller_token = _jwt(
            self.seller.student_id,
            "student",
            session_id="00000000-0000-0000-0000-000000000002",
        )
        self.db.add(UserSession(
            id="00000000-0000-0000-0000-000000000001",
            user_id=self.reporter.student_id,
            device_name="Test device",
        ))
        self.db.add(UserSession(
            id="00000000-0000-0000-0000-000000000002",
            user_id=self.seller.student_id,
            device_name="Seller test device",
        ))
        self.db.flush()

        def override_get_db():
            yield self.db

        main_module.app.dependency_overrides[get_db] = override_get_db

    def tearDown(self):
        main_module.app.dependency_overrides.pop(get_db, None)
        self.db.close()

    def request(self, method, path, *, headers=None, json_body=None, form_data=None):
        async def send():
            transport = httpx.ASGITransport(app=main_module.app)
            async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
                return await client.request(
                    method,
                    path,
                    headers=headers,
                    json=json_body,
                    data=form_data,
                )

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

    def test_report_context_auto_links_product_seller_and_writes_audit(self):
        product = Product(
            title="Auto-linked Laptop",
            category="Test",
            price="100.00",
            seller=self.seller.name,
            seller_id=self.seller.student_id,
        )
        self.db.add(product)
        self.db.flush()
        report = Report(
            product_id=product.id,
            student_id=self.reporter.student_id,
            seller_id=None,
            student_name=self.reporter.name,
            email=self.reporter.email,
            issue="A detailed report about an unlinked seller.",
            status="Under Review",
            reviewed_by=self.admin.id,
        )
        self.db.add(report)
        self.db.flush()

        response = self.request(
            "GET",
            f"/api/admin/reports/{report.id}/context",
            headers=self.headers,
        )
        self.db.refresh(report)
        audit = self.db.query(AuditLog).filter(
            AuditLog.entity_type == "Report",
            AuditLog.entity_id == report.id,
            AuditLog.action == "Report Targets Auto-Linked",
        ).one()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(report.seller_id, self.seller.student_id)
        self.assertTrue(response.json()["auto_linked_from_product"])
        self.assertIn("from product", audit.description)

    def test_report_context_auto_links_unique_exact_legacy_student_id(self):
        product = Product(
            title="Legacy ID Laptop",
            category="Test",
            price="100.00",
            seller=self.seller.student_id,
            seller_id=None,
        )
        self.db.add(product)
        self.db.flush()
        report = Report(
            product_id=product.id,
            student_id=self.reporter.student_id,
            seller_id=None,
            student_name=self.reporter.name,
            email=self.reporter.email,
            issue="A report for a product with a legacy student ID owner.",
            status="Under Review",
            reviewed_by=self.admin.id,
        )
        self.db.add(report)
        self.db.flush()

        response = self.request(
            "GET",
            f"/api/admin/reports/{report.id}/context",
            headers=self.headers,
        )
        self.db.refresh(report)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(report.seller_id, self.seller.student_id)
        self.assertEqual(
            main_module.get_product_owner_student_id(self.db, product),
            report.seller_id,
        )
        self.assertTrue(response.json()["auto_linked_from_product"])
        self.assertEqual(self.db.query(AuditLog).filter(
            AuditLog.entity_type == "Report",
            AuditLog.entity_id == report.id,
            AuditLog.action == "Report Targets Auto-Linked",
        ).count(), 1)

    def test_new_student_report_captures_product_and_seller_links(self):
        product = Product(
            title="New Report Laptop",
            category="Test",
            price="100.00",
            seller=self.seller.name,
            seller_id=self.seller.student_id,
        )
        self.db.add(product)
        self.db.flush()

        with patch.object(main_module, "_queue_student_item_notification", return_value=None), patch.object(
            main_module, "_notify_admins", return_value=None,
        ):
            response = self.request(
                "POST",
                "/api/student/report",
                headers={"Authorization": f"Bearer {self.student_token}"},
                form_data={
                    "student_name": self.reporter.name,
                    "email": self.reporter.email,
                    "category": "Product Report",
                    "issue": "A detailed report about this product.",
                    "product_id": str(product.id),
                },
            )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["report"]["product_id"], product.id)
        self.assertEqual(response.json()["report"]["seller_id"], self.seller.student_id)

    def test_report_target_backfill_is_idempotent(self):
        product = Product(
            title="Backfill Laptop",
            category="Test",
            price="100.00",
            seller_id=self.seller.student_id,
        )
        self.db.add(product)
        self.db.flush()
        report = Report(
            product_id=product.id,
            seller_id=None,
            student_name="Legacy reporter",
            issue="A legacy report requiring safe target backfill.",
        )
        self.db.add(report)
        self.db.flush()

        first_count = main_module.backfill_report_targets(self.db)
        second_count = main_module.backfill_report_targets(self.db)

        self.assertEqual(first_count, 1)
        self.assertEqual(second_count, 0)
        self.assertEqual(report.seller_id, self.seller.student_id)
        self.assertEqual(self.db.query(AuditLog).filter(
            AuditLog.entity_type == "Report",
            AuditLog.entity_id == report.id,
            AuditLog.action == "Report Targets Auto-Linked",
        ).count(), 1)

    def test_ambiguous_legacy_display_name_does_not_auto_link_seller(self):
        second_student = Student(
            name=self.seller.name,
            student_id="seller-ambiguous",
            email="seller-ambiguous@example.test",
            password="test-password",
            college="Test College",
            department="Testing",
        )
        product = Product(
            title="Legacy Laptop",
            category="Test",
            price="100.00",
            seller=self.seller.name,
            seller_id=None,
        )
        self.db.add_all([second_student, product])
        self.db.flush()
        report = Report(
            product_id=product.id,
            student_id=self.reporter.student_id,
            seller_id=None,
            student_name=self.reporter.name,
            email=self.reporter.email,
            issue="A detailed report with an ambiguous legacy seller.",
            status="Under Review",
            reviewed_by=self.admin.id,
        )
        self.db.add(report)
        self.db.flush()

        response = self.request(
            "GET",
            f"/api/admin/reports/{report.id}/context",
            headers=self.headers,
        )
        self.db.refresh(report)

        self.assertEqual(response.status_code, 200)
        self.assertIsNone(report.seller_id)
        self.assertFalse(response.json()["auto_linked_from_product"])
        self.assertEqual(self.db.query(AuditLog).filter(
            AuditLog.entity_type == "Report",
            AuditLog.entity_id == report.id,
            AuditLog.action == "Report Targets Auto-Linked",
        ).count(), 0)

    def test_report_link_search_matches_student_email_product_and_order_buyer(self):
        _, order = self.create_report(with_order=True)

        email_response = self.request(
            "GET",
            "/api/admin/reports/link-options?q=seller%40example.test",
            headers=self.headers,
        )
        product_response = self.request(
            "GET",
            "/api/admin/reports/link-options?q=Reported%20Product",
            headers=self.headers,
        )

        self.assertEqual(email_response.status_code, 200)
        self.assertEqual(email_response.json()["sellers"][0]["student_id"], self.seller.student_id)
        self.assertEqual(product_response.status_code, 200)
        self.assertTrue(any(item["title"] == "Reported Product" for item in product_response.json()["products"]))
        self.assertTrue(any(item["id"] == order.id and item["buyer_name"] == self.reporter.name for item in product_response.json()["orders"]))

    def test_student_token_is_forbidden_from_report_link_search(self):
        response = self.request(
            "GET",
            "/api/admin/reports/link-options?q=Re",
            headers={"Authorization": f"Bearer {self.student_token}"},
        )

        self.assertEqual(response.status_code, 403)

    def test_student_moderation_notice_is_visible_only_to_owning_seller(self):
        report, _ = self.create_report(status="Under Review")
        report.student_id = self.reporter.student_id
        notice = Notification(
            student_id=self.seller.student_id,
            title="Marketplace warning",
            message="Explain the listing details accurately.",
            type="moderation_action",
            reference_id=str(report.id),
            action_label="View in UniXchange",
            action_url=f"/dashboard?tab=seller&section=warnings&item=report-{report.id}",
        )
        internal_note = ReportMessage(
            report_id=report.id,
            admin_id=self.admin.id,
            body="Private admin-only investigation note.",
            is_internal=True,
        )
        self.db.add_all([notice, internal_note])
        self.db.commit()

        owner_response = self.request(
            "GET",
            f"/api/student/moderation/notices/{report.id}",
            headers={"Authorization": f"Bearer {self.seller_token}"},
        )
        other_student_response = self.request(
            "GET",
            f"/api/student/moderation/notices/{report.id}",
            headers={"Authorization": f"Bearer {self.student_token}"},
        )

        self.assertEqual(owner_response.status_code, 200, owner_response.text)
        payload = owner_response.json()
        self.assertEqual(payload["report_id"], report.id)
        self.assertEqual(payload["reason"], notice.message)
        self.assertNotIn(self.reporter.name, owner_response.text)
        self.assertNotIn("Private admin-only", owner_response.text)
        self.assertEqual(other_student_response.status_code, 404)

    def test_student_moderation_notice_list_is_scoped_to_authenticated_seller(self):
        report, _ = self.create_report(status="Under Review")
        self.db.add(Notification(
            student_id=self.seller.student_id,
            title="Product hidden",
            message="The listing was hidden.",
            type="moderation_action",
            reference_id=str(report.id),
            action_label="View in UniXchange",
            action_url=f"/dashboard?tab=seller&section=warnings&item=report-{report.id}",
        ))
        self.db.commit()

        seller_response = self.request(
            "GET",
            "/api/student/moderation/notices",
            headers={"Authorization": f"Bearer {self.seller_token}"},
        )
        reporter_response = self.request(
            "GET",
            "/api/student/moderation/notices",
            headers={"Authorization": f"Bearer {self.student_token}"},
        )

        self.assertEqual(seller_response.status_code, 200)
        self.assertEqual(len(seller_response.json()["items"]), 1)
        self.assertEqual(reporter_response.status_code, 200)
        self.assertEqual(reporter_response.json()["items"], [])

    def test_moderation_notification_links_are_backfilled_idempotently(self):
        report, _ = self.create_report(status="Under Review")
        self.db.add_all([
            Notification(
                student_id=self.seller.student_id,
                title="Marketplace warning",
                message="Warning reason.",
                type="moderation_action",
                reference_id=str(report.id),
                action_url="/dashboard",
            ),
            Notification(
                student_id=self.seller.student_id,
                title="Account suspended",
                message="Account reason.",
                type="moderation_action",
                reference_id=str(report.id + 1),
                action_url="/dashboard",
            ),
        ])
        self.db.commit()
        with patch.object(database_module, "engine", self.engine):
            database_module.init_db()
            database_module.init_db()
        self.db.expire_all()
        migrated = self.db.query(Notification).filter(
            Notification.type == "moderation_action",
        ).order_by(Notification.id.asc()).all()

        self.assertEqual(
            [item.action_url for item in migrated],
            [
                f"/dashboard?tab=seller&section=warnings&item=report-{report.id}",
                f"/dashboard?tab=seller&section=account-notices&item=report-{report.id + 1}",
            ],
        )

    def test_manual_link_rejects_product_owned_by_different_seller(self):
        other_seller = Student(
            name="Other Seller",
            student_id="seller-2",
            email="seller-2@example.test",
            password="test-password",
            college="Test College",
            department="Testing",
        )
        self.db.add(other_seller)
        report, _ = self.create_report(status="Under Review")
        self.db.flush()

        response = self.request(
            "POST",
            f"/api/admin/reports/{report.id}/links",
            headers=self.headers,
            json_body={
                "seller_id": other_seller.student_id,
                "product_id": report.product_id,
            },
        )

        self.assertEqual(response.status_code, 409)
        detail = response.json()["detail"]
        self.assertEqual(detail["code"], "PRODUCT_OWNER_MISMATCH")
        self.assertEqual(detail["owner"]["student_id"], self.seller.student_id)
        self.assertEqual(detail["selected_seller"]["student_id"], other_seller.student_id)
        self.assertIn(self.seller.name, detail["message"])
        self.assertIn(other_seller.name, detail["message"])

    def test_manual_link_and_auto_link_use_same_verified_legacy_owner(self):
        product = Product(
            title="Shared Rule Laptop",
            category="Test",
            price="100.00",
            seller=self.seller.student_id,
            seller_id=None,
        )
        self.db.add(product)
        self.db.flush()
        report = Report(
            product_id=product.id,
            student_id=self.reporter.student_id,
            seller_id=None,
            student_name=self.reporter.name,
            email=self.reporter.email,
            issue="Validate shared product ownership.",
            status="Under Review",
            reviewed_by=self.admin.id,
        )
        self.db.add(report)
        self.db.flush()

        auto_link_owner = main_module.get_product_owner_student_id(self.db, product)
        response = self.request(
            "POST",
            f"/api/admin/reports/{report.id}/links",
            headers=self.headers,
            json_body={
                "seller_id": self.seller.student_id,
                "product_id": product.id,
            },
        )
        self.db.refresh(report)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(report.seller_id, auto_link_owner)
        self.assertEqual(report.seller_id, self.seller.student_id)

    def test_manual_link_requires_confirmation_for_product_without_verified_owner(self):
        report, _ = self.create_report(status="Under Review")
        product = self.db.query(Product).filter(Product.id == report.product_id).one()
        product.seller = "Legacy display name"
        product.seller_id = None
        report.seller_id = None
        self.db.flush()

        request_body = {
            "seller_id": self.seller.student_id,
            "product_id": product.id,
        }
        self.db.commit()
        confirmation_response = self.request(
            "POST",
            f"/api/admin/reports/{report.id}/links",
            headers=self.headers,
            json_body=request_body,
        )

        self.assertEqual(confirmation_response.status_code, 409)
        self.assertEqual(
            confirmation_response.json()["detail"]["code"],
            "PRODUCT_OWNER_CONFIRMATION_REQUIRED",
        )
        self.assertIn("no verified owner", confirmation_response.json()["detail"]["message"])
        self.assertIsNone(product.seller_id)

        save_response = self.request(
            "POST",
            f"/api/admin/reports/{report.id}/links",
            headers=self.headers,
            json_body={**request_body, "confirm_product_owner": True},
        )
        self.db.refresh(product)
        self.db.refresh(report)
        owner_audit = self.db.query(AuditLog).filter(
            AuditLog.entity_type == "Product",
            AuditLog.entity_id == product.id,
            AuditLog.action == "Product Owner Set From Report",
        ).one()

        self.assertEqual(save_response.status_code, 200)
        self.assertEqual(product.seller_id, self.seller.student_id)
        self.assertEqual(report.seller_id, self.seller.student_id)
        self.assertEqual(
            main_module.get_product_owner_student_id(self.db, product),
            report.seller_id,
        )
        self.assertIn(self.seller.student_id, owner_audit.description)

    def test_manual_link_rejects_product_with_missing_verified_owner(self):
        report, _ = self.create_report(status="Under Review")
        product = self.db.query(Product).filter(Product.id == report.product_id).one()
        product.seller = "Unverified seller label"
        product.seller_id = None
        report.seller_id = None
        self.db.flush()

        response = self.request(
            "POST",
            f"/api/admin/reports/{report.id}/links",
            headers=self.headers,
            json_body={"product_id": product.id},
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["detail"]["code"], "PRODUCT_OWNER_UNVERIFIED")
        self.assertIn("no verified owner", response.json()["detail"]["message"])

    def test_manual_link_rejects_order_with_different_buyer(self):
        report, _ = self.create_report(status="Under Review")
        order = Order(
            student_id=self.seller.student_id,
            product_id=report.product_id,
            title="Reported Product",
            price="100.00",
            quantity=1,
            seller_id=self.seller.student_id,
            payment_status="Successful",
        )
        self.db.add(order)
        self.db.flush()

        response = self.request(
            "POST",
            f"/api/admin/reports/{report.id}/links",
            headers=self.headers,
            json_body={
                "seller_id": self.seller.student_id,
                "product_id": report.product_id,
                "order_id": order.id,
            },
        )

        self.assertEqual(response.status_code, 409)
        self.assertIn("buyer does not match", response.json()["detail"]["message"])

    def test_linked_report_allows_moderation_decisions_on_server(self):
        for decision in ("warn", "hide_product", "suspend", "deactivate"):
            with self.subTest(decision=decision):
                report, _ = self.create_report(status="Under Review")
                report.seller_id = None
                report.reviewed_by = self.admin.id
                self.db.flush()
                link_response = self.request(
                    "POST",
                    f"/api/admin/reports/{report.id}/links",
                    headers=self.headers,
                    json_body={
                        "seller_id": self.seller.student_id,
                        "product_id": report.product_id,
                    },
                )
                self.assertEqual(link_response.status_code, 200)
                context_response = self.request(
                    "GET",
                    f"/api/admin/reports/{report.id}/context",
                    headers=self.headers,
                )
                self.assertTrue(context_response.json()["decision_availability"][decision]["enabled"])
                resolve_response = self.request(
                    "POST",
                    f"/api/admin/reports/{report.id}/resolve",
                    headers=self.headers,
                    json_body={
                        "decision": decision,
                        "reason": "Confirmed after validating the linked target.",
                    },
                )
                self.assertEqual(resolve_response.status_code, 200)
                moderation_notice = self.db.query(Notification).filter(
                    Notification.student_id == self.seller.student_id,
                    Notification.type == "moderation_action",
                    Notification.reference_id == str(report.id),
                ).one()
                notice_section = (
                    "warnings"
                    if decision in {"warn", "hide_product"}
                    else "account-notices"
                )
                self.assertEqual(
                    moderation_notice.action_url,
                    f"/dashboard?tab=seller&section={notice_section}&item=report-{report.id}",
                )

    def test_escalation_keeps_report_under_review_and_hides_internal_note_from_student(self):
        report, _ = self.create_report(status="Under Review")
        response = self.request(
            "POST",
            f"/api/admin/reports/{report.id}/resolve",
            headers=self.headers,
            json_body={
                "decision": "escalate",
                "reason": "Need internal follow-up on submitted evidence.",
                "reporter_message": "Please provide a clearer photo.",
                "review_by": "2000-01-01",
            },
        )
        self.db.refresh(report)

        context_response = self.request(
            "GET",
            f"/api/admin/reports/{report.id}/context",
            headers=self.headers,
        )
        student_response = self.request(
            "GET",
            f"/api/student/reports/{report.id}",
            headers={"Authorization": f"Bearer {self.student_token}"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(report.status, "Under Review")
        self.assertEqual(report.decision, "escalate")
        self.assertTrue(context_response.json()["review_overdue"])
        self.assertEqual(context_response.json()["review_by"], "2000-01-01")
        self.assertEqual(self.db.query(ReportMessage).filter(
            ReportMessage.report_id == report.id,
            ReportMessage.is_internal.is_(True),
        ).one().body, "Need internal follow-up on submitted evidence.")
        self.assertNotIn("Need internal follow-up", student_response.text)
        self.assertIn(
            "Please provide a clearer photo.",
            [message["body"] for message in student_response.json()["messages"]],
        )

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
            AuditLog.action == "Report Dismissed",
        ).one()
        self.assertEqual(audit.admin_id, self.admin.id)
        self.assertIn("Evidence does not support the complaint.", audit.description)


if __name__ == "__main__":
    unittest.main()
