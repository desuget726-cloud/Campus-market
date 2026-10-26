import asyncio
import base64
import hashlib
import hmac
import json
import os
import time
import unittest
import uuid
from unittest.mock import patch

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["SESSION_SECRET"] = "support-communication-test-secret"

import httpx
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import main as main_module
from app.database import Base, get_db
from app.models import (
    Admin,
    AdminNotification,
    AdminSession,
    AuditLog,
    EmailOutbox,
    Notification,
    Order,
    Product,
    Report,
    Student,
    SupportTicket,
    SupportTicketMessage,
    UserSession,
)


def _b64(value):
    return base64.urlsafe_b64encode(value).decode().rstrip("=")


def _jwt(subject, role, **claims):
    header = _b64(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    payload = _b64(json.dumps({
        "sub": subject,
        "role": role,
        "exp": time.time() + 3600,
        **claims,
    }).encode())
    unsigned = f"{header}.{payload}"
    signature = hmac.new(
        os.environ["SESSION_SECRET"].encode(),
        unsigned.encode(),
        hashlib.sha256,
    ).digest()
    return f"{unsigned}.{_b64(signature)}"


class SupportCommunicationLoopTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.original_engine = main_module.engine
        cls.original_session_local = main_module.SessionLocal
        cls.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        cls.session_factory = sessionmaker(bind=cls.engine, autoflush=False, autocommit=False)
        main_module.engine = cls.engine
        main_module.SessionLocal = cls.session_factory
        Base.metadata.create_all(bind=cls.engine)

    @classmethod
    def tearDownClass(cls):
        main_module.engine = cls.original_engine
        main_module.SessionLocal = cls.original_session_local
        cls.engine.dispose()

    def setUp(self):
        Base.metadata.drop_all(bind=self.engine)
        Base.metadata.create_all(bind=self.engine)
        self.db = self.session_factory()
        self.admin = Admin(
            username="support-admin",
            email="admin@example.test",
            password_hash="test-hash",
            role="Admin",
        )
        self.reporter = self._student("reporter-1", "Reporter")
        self.other_student = self._student("other-1", "Other Student")
        self.seller = self._student("seller-1", "Reported Seller")
        self.db.add_all([self.admin, self.reporter, self.other_student, self.seller])
        self.db.flush()

        self.admin_token = _jwt(self.admin.username, "admin")
        self.db.add(AdminSession(
            admin_id=self.admin.id,
            session_token=self.admin_token,
            is_active=True,
        ))
        self.tokens = {}
        for student in (self.reporter, self.other_student, self.seller):
            session_id = str(uuid.uuid4())
            self.db.add(UserSession(
                id=session_id,
                user_id=student.student_id,
                device_name="Test device",
            ))
            self.tokens[student.student_id] = _jwt(
                student.student_id,
                "student",
                session_id=session_id,
            )
        self.db.commit()

        def override_get_db():
            yield self.db

        main_module.app.dependency_overrides[get_db] = override_get_db
        self.sent_emails = []
        self.mailer = lambda recipient, subject, body: self.sent_emails.append((recipient, subject, body))
        self.mailer_patch = patch.object(main_module, "_send_outbox_email", side_effect=self.mailer)
        self.mailer_patch.start()
        self.sleep_patch = patch.object(main_module, "time_sleep", return_value=None)
        self.sleep_patch.start()

    def tearDown(self):
        self.mailer_patch.stop()
        self.sleep_patch.stop()
        main_module.app.dependency_overrides.pop(get_db, None)
        self.db.close()

    def _student(self, student_id, name):
        return Student(
            name=name,
            student_id=student_id,
            email=f"{student_id}@example.test",
            password="test-password",
            college="Test College",
            department="Testing",
        )

    def _headers(self, student_id):
        return {"Authorization": f"Bearer {self.tokens[student_id]}"}

    def _admin_headers(self):
        return {"Authorization": f"Bearer {self.admin_token}"}

    def _request(self, method, path, *, headers=None, json_body=None, data=None, files=None):
        async def send():
            transport = httpx.ASGITransport(app=main_module.app)
            async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
                return await client.request(
                    method,
                    path,
                    headers=headers,
                    json=json_body,
                    data=data,
                    files=files,
                )
        return asyncio.run(send())

    def _create_ticket(self):
        return self._request(
            "POST",
            "/support/tickets",
            headers=self._headers(self.reporter.student_id),
            data={
                "subject": "Wallet question",
                "category": "Payment Problem",
                "message": "I need help understanding a wallet transfer.",
            },
        )

    def _create_report(self):
        return self._request(
            "POST",
            "/api/student/report",
            headers=self._headers(self.reporter.student_id),
            data={
                "student_name": self.reporter.name,
                "email": self.reporter.email,
                "category": "Product Report",
                "issue": "This product listing has a misleading description.",
                "seller_id": self.seller.student_id,
            },
        )

    def test_ticket_creation_ack_is_private_and_sends_short_email(self):
        response = self._create_ticket()
        self.assertEqual(response.status_code, 201, response.text)
        ticket = response.json()["ticket"]
        self.assertEqual(ticket["ticket_number"], "SUP-0001")
        self.assertIn("section=reports-support&item=support-1", response.json()["ticket"]["id"] and
                      self.db.query(Notification).filter(Notification.type == "support").first().action_url)
        self.assertEqual(self.db.query(Notification).filter(Notification.student_id == self.reporter.student_id).count(), 1)
        self.assertEqual(self.db.query(Notification).filter(Notification.student_id == self.seller.student_id).count(), 0)
        self.assertGreater(self.db.query(AdminNotification).filter(AdminNotification.reference_type == "support").count(), 0)
        self.assertEqual(len(self.sent_emails), 1)
        self.assertIn("SUP-0001", self.sent_emails[0][2])
        self.assertNotIn("wallet transfer", self.sent_emails[0][2])

    def test_report_is_readable_only_by_reporter_and_admin_and_only_admin_replies(self):
        response = self._create_report()
        self.assertEqual(response.status_code, 201, response.text)
        report_id = response.json()["report"]["id"]
        self.assertEqual(self.db.query(AdminNotification).filter(AdminNotification.reference_type == "report").count(), 1)
        own = self._request(
            "GET", f"/api/student/reports/{report_id}",
            headers=self._headers(self.reporter.student_id),
        )
        self.assertEqual(own.status_code, 200)
        self.assertEqual(own.json()["issue"], "This product listing has a misleading description.")
        for student in (self.other_student, self.seller):
            for path in (
                f"/api/student/reports/{report_id}",
                f"/api/student/reports/{report_id}/evidence",
                f"/api/student/reports/participating",
            ):
                denied = self._request("GET", path, headers=self._headers(student.student_id))
                if path.endswith("participating"):
                    self.assertEqual(denied.status_code, 200)
                    self.assertEqual(denied.json(), [])
                else:
                    self.assertEqual(denied.status_code, 404)
        seller_reply = self._request(
            "POST", f"/api/student/reports/{report_id}/response",
            headers=self._headers(self.seller.student_id),
            data={"text": "Here is my explanation."},
        )
        self.assertEqual(seller_reply.status_code, 404)
        private_logs = self._request(
            "GET", f"/api/admin/reports/{report_id}/conversation-logs",
            headers=self._headers(self.reporter.student_id),
        )
        self.assertEqual(private_logs.status_code, 403)
        student_admin_action = self._request(
            "POST", f"/api/admin/reports/{report_id}/review",
            headers=self._headers(self.reporter.student_id),
            json_body={},
        )
        self.assertEqual(student_admin_action.status_code, 403)

    def test_report_appeal_is_one_time_and_minimum_length(self):
        created = self._create_report()
        report = self.db.query(Report).filter(Report.id == created.json()["report"]["id"]).first()
        report.status = "Resolved"
        self.db.commit()
        short = self._request(
            "POST", f"/api/student/reports/{report.id}/appeal",
            headers=self._headers(self.reporter.student_id),
            json_body={"text": "too short"},
        )
        self.assertEqual(short.status_code, 422)
        first = self._request(
            "POST", f"/api/student/reports/{report.id}/appeal",
            headers=self._headers(self.reporter.student_id),
            json_body={"text": "I have additional evidence for this decision."},
        )
        second = self._request(
            "POST", f"/api/student/reports/{report.id}/appeal",
            headers=self._headers(self.reporter.student_id),
            json_body={"text": "A second appeal must not be accepted."},
        )
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 409)
        self.assertEqual(self.db.query(AdminNotification).filter(AdminNotification.reference_type == "report").count(), 2)

    def test_report_decision_email_is_critical_but_review_update_respects_preferences(self):
        self.reporter.notif_msg_email = False
        self.db.commit()
        created = self._create_report()
        self.assertEqual(created.status_code, 201, created.text)
        report_id = created.json()["report"]["id"]

        review = self._request(
            "POST", f"/api/admin/reports/{report_id}/review",
            headers={"Authorization": f"Bearer {self.admin_token}"},
            json_body={},
        )
        self.assertEqual(review.status_code, 200, review.text)
        self.assertEqual(self.db.query(EmailOutbox).count(), 1)
        self.assertIn("RPT-0001", self.sent_emails[0][2])

        decision = self._request(
            "POST", f"/api/admin/reports/{report_id}/resolve",
            headers={"Authorization": f"Bearer {self.admin_token}"},
            json_body={
                "decision": "Reject",
                "reason": "The submitted report does not establish a policy violation.",
            },
        )
        self.assertEqual(decision.status_code, 200, decision.text)
        self.assertEqual(self.db.query(EmailOutbox).count(), 2)
        self.assertIn("Dismissed", self.sent_emails[-1][2])
        self.assertNotIn("policy violation", self.sent_emails[-1][2])

    def test_admin_ticket_reply_notifies_and_queues_email_without_reply_or_note_body(self):
        ticket_response = self._create_ticket()
        ticket_id = ticket_response.json()["ticket"]["id"]
        internal = self._request(
            "POST", f"/support/tickets/{ticket_id}/messages",
            headers={"Authorization": f"Bearer {self.admin_token}"},
            json_body={"body": "Internal account review note.", "is_internal": True, "revision": 1},
        )
        self.assertEqual(internal.status_code, 200, internal.text)
        detail = self._request(
            "GET", f"/api/student/support/tickets/{ticket_id}",
            headers=self._headers(self.reporter.student_id),
        )
        self.assertEqual(detail.status_code, 200)
        self.assertFalse(any(message.get("is_internal") for message in detail.json()["messages"]))
        revision = detail.json()["revision"]
        reply_body = "Please confirm the transaction reference in your account."
        reply = self._request(
            "POST", f"/support/tickets/{ticket_id}/messages",
            headers={"Authorization": f"Bearer {self.admin_token}"},
            json_body={"body": reply_body, "revision": revision},
        )
        self.assertEqual(reply.status_code, 200, reply.text)
        self.assertEqual(self.db.query(AuditLog).filter(AuditLog.action == "Support Public Reply").count(), 1)
        self.assertEqual(self.db.query(AuditLog).filter(AuditLog.action == "Support Internal Note Added").count(), 1)
        self.assertTrue(any(notification.type == "support_reply" for notification in self.db.query(Notification).all()))
        sent = self.sent_emails[-1][2]
        self.assertIn("SUP-0001", sent)
        self.assertNotIn(reply_body, sent)
        self.assertNotIn("Internal account review note", sent)

    def test_email_failure_is_retried_and_does_not_undo_admin_reply(self):
        ticket_id = self._create_ticket().json()["ticket"]["id"]

        def fail_mail(*_args):
            raise RuntimeError("smtp unavailable")

        with patch.object(main_module, "_send_outbox_email", side_effect=fail_mail):
            response = self._request(
                "POST", f"/support/tickets/{ticket_id}/messages",
                headers={"Authorization": f"Bearer {self.admin_token}"},
                json_body={"body": "A private admin reply for the account."},
            )
        self.assertEqual(response.status_code, 200, response.text)
        outbox = self.db.query(EmailOutbox).filter(EmailOutbox.subject.like("%SUP-0001%")).order_by(EmailOutbox.id.desc()).first()
        self.assertEqual(outbox.status, "failed")
        self.assertEqual(outbox.attempts, 3)
        self.assertEqual(self.db.query(Notification).filter(Notification.type == "support_reply").count(), 1)
        self.assertEqual(self.db.query(SupportTicketMessage).filter(SupportTicketMessage.sender_type == "admin").count(), 1)

    def test_student_ticket_replies_closed_tickets_and_one_reopen(self):
        ticket_id = self._create_ticket().json()["ticket"]["id"]
        reply = self._request(
            "POST", f"/api/student/support/tickets/{ticket_id}/messages",
            headers=self._headers(self.reporter.student_id),
            json_body={"body": "This is additional useful information."},
        )
        self.assertEqual(reply.status_code, 201)
        ticket = self.db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
        ticket.status = "Resolved"
        self.db.commit()
        reopened = self._request(
            "POST", f"/api/student/support/tickets/{ticket_id}/reopen",
            headers=self._headers(self.reporter.student_id),
        )
        twice = self._request(
            "POST", f"/api/student/support/tickets/{ticket_id}/reopen",
            headers=self._headers(self.reporter.student_id),
        )
        self.assertEqual(reopened.status_code, 200)
        self.assertEqual(twice.status_code, 409)
        ticket.status = "Closed"
        self.db.commit()
        denied = self._request(
            "POST", f"/api/student/support/tickets/{ticket_id}/messages",
            headers=self._headers(self.reporter.student_id),
            json_body={"body": "A closed ticket must reject this message."},
        )
        self.assertEqual(denied.status_code, 409)

    def test_ticket_assignment_and_status_changes_are_audited(self):
        ticket_id = self._create_ticket().json()["ticket"]["id"]
        assignment = self._request(
            "PATCH", f"/api/admin/support/{ticket_id}/assign",
            headers={"Authorization": f"Bearer {self.admin_token}"},
            json_body={"admin_id": self.admin.id},
        )
        status = self._request(
            "PATCH", f"/support/tickets/{ticket_id}",
            headers={"Authorization": f"Bearer {self.admin_token}"},
            json_body={"status": "In Progress"},
        )
        self.assertEqual(assignment.status_code, 200, assignment.text)
        self.assertEqual(status.status_code, 200, status.text)
        actions = {item.action for item in self.db.query(AuditLog).all()}
        self.assertIn("Support Ticket Assigned", actions)
        self.assertIn("Support Ticket Status Changed", actions)

    def test_repeated_ticket_status_changes_refresh_the_existing_notification(self):
        ticket_id = self._create_ticket().json()["ticket"]["id"]
        headers = self._admin_headers()
        first = self._request(
            "PATCH", f"/support/tickets/{ticket_id}",
            headers=headers,
            json_body={"status": "In Progress"},
        )
        notification = self.db.query(Notification).filter(
            Notification.type == "support_status",
            Notification.reference_id == str(ticket_id),
        ).one()
        notification.is_read = True
        self.db.commit()

        second = self._request(
            "PATCH", f"/support/tickets/{ticket_id}",
            headers=headers,
            json_body={"status": "Closed"},
        )

        self.assertEqual(first.status_code, 200, first.text)
        self.assertEqual(second.status_code, 200, second.text)
        self.assertEqual(
            self.db.query(Notification).filter(
                Notification.type == "support_status",
                Notification.reference_id == str(ticket_id),
            ).count(),
            1,
        )
        self.db.refresh(notification)
        self.assertIn("now Closed", notification.message)
        self.assertFalse(notification.is_read)

    def test_order_detail_is_limited_to_buyer_or_product_seller(self):
        product = Product(
            title="Test item",
            category="Books",
            price="20.00",
            seller=self.seller.student_id,
            seller_id=self.seller.student_id,
            status="Approved",
        )
        self.db.add(product)
        self.db.flush()
        order = Order(
            student_id=self.reporter.student_id,
            product_id=product.id,
            title=product.title,
            price=product.price,
            seller_id=self.seller.student_id,
            seller_name=self.seller.name,
        )
        self.db.add(order)
        self.db.commit()

        buyer_view = self._request(
            "GET", f"/api/student/orders/detail/{order.id}",
            headers=self._headers(self.reporter.student_id),
        )
        seller_view = self._request(
            "GET", f"/api/student/orders/detail/{order.id}",
            headers=self._headers(self.seller.student_id),
        )
        other_buyer_view = self._request(
            "GET", f"/api/student/orders/detail/{order.id}",
            headers=self._headers(self.other_student.student_id),
        )
        self.assertEqual(buyer_view.status_code, 200, buyer_view.text)
        self.assertEqual(seller_view.status_code, 200, seller_view.text)
        self.assertEqual(other_buyer_view.status_code, 403)

    def test_admin_directory_is_private_and_never_returns_secrets(self):
        response = self._request(
            "GET", "/api/admin/admin-users?search=support",
            headers=self._admin_headers(),
        )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(response.json()[0]["username"], self.admin.username)
        self.assertNotIn("password_hash", response.text)
        self.assertNotIn("two_factor_secret", response.text)
        self.assertNotIn("backup_codes", response.text)

        denied = self._request(
            "GET", "/api/admin/admin-users",
            headers=self._headers(self.reporter.student_id),
        )
        self.assertEqual(denied.status_code, 403)

    def test_admin_reviews_are_listed_without_student_access(self):
        product = Product(
            title="Reviewed item",
            category="Books",
            price="15.00",
            seller=self.seller.student_id,
            seller_id=self.seller.student_id,
            status="Approved",
        )
        self.db.add(product)
        self.db.flush()
        order = Order(
            student_id=self.reporter.student_id,
            product_id=product.id,
            title=product.title,
            price=product.price,
            seller_id=self.seller.student_id,
        )
        self.db.add(order)
        self.db.flush()
        from app.models import Review
        self.db.add(Review(
            order_id=order.id,
            student_id=self.reporter.student_id,
            rating=4,
            comment="Good condition and quick handover.",
        ))
        self.db.commit()

        response = self._request("GET", "/api/admin/reviews", headers=self._admin_headers())
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()[0]["product"], "Reviewed item")
        self.assertEqual(response.json()[0]["reviewer_id"], self.reporter.student_id)
        denied = self._request(
            "GET", "/api/admin/reviews",
            headers=self._headers(self.reporter.student_id),
        )
        self.assertEqual(denied.status_code, 403)

    def test_sidebar_counts_include_unseen_reports_support_overdue_and_unread(self):
        old_ticket = SupportTicket(
            user_id=self.reporter.student_id,
            requester_name=self.reporter.name,
            requester_email=self.reporter.email,
            subject="Old unresolved ticket",
            category="Other",
            message="This ticket has not received a response.",
            status="Open",
            created_at=main_module.datetime.now(main_module.timezone.utc).replace(tzinfo=None)
            - main_module.timedelta(days=3),
        )
        in_progress = SupportTicket(
            user_id=self.reporter.student_id,
            requester_name=self.reporter.name,
            requester_email=self.reporter.email,
            subject="Recent ticket",
            category="Other",
            message="This ticket is still within the response window.",
            status="In Progress",
        )
        self.db.add_all([old_ticket, in_progress])
        self.db.add_all([
            Report(
                student_id=self.reporter.student_id,
                student_name=self.reporter.name,
                issue="First open report.",
                status="Open",
            ),
            Report(
                student_id=self.reporter.student_id,
                student_name=self.reporter.name,
                issue="Report being reviewed.",
                status="Under Review",
            ),
        ])
        self.db.add(AdminNotification(
            admin_id=self.admin.id,
            title="New request",
            message="A request needs review.",
            reference_type="support",
            reference_id="1",
            action_url="/support",
            is_read=False,
        ))
        self.db.commit()

        response = self._request(
            "GET", "/api/admin/sidebar-counts",
            headers=self._admin_headers(),
        )
        self.assertEqual(response.status_code, 200, response.text)
        counts = response.json()
        self.assertEqual(counts["unseenReports"], 2)
        self.assertEqual(counts["unseenSupport"], 2)
        self.assertEqual(counts["supportOverdue"], 1)
        self.assertEqual(counts["unreadNotifications"], 1)

        denied = self._request(
            "GET", "/api/admin/sidebar-counts",
            headers=self._headers(self.reporter.student_id),
        )
        self.assertEqual(denied.status_code, 403)

    def test_support_assignment_lists_only_safe_active_admin_fields(self):
        inactive_admin = Admin(
            username="inactive-support-admin",
            email="inactive@example.test",
            password_hash="private-hash",
            role="Admin",
            status="Inactive",
        )
        self.db.add(inactive_admin)
        self.db.commit()

        response = self._request(
            "GET",
            "/api/admin/support/admins",
            headers=self._admin_headers(),
        )

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["current_admin_id"], self.admin.id)
        self.assertEqual(
            response.json()["items"],
            [{
                "id": self.admin.id,
                "name": self.admin.username,
                "username": self.admin.username,
            }],
        )
        self.assertNotIn("password_hash", response.text)
        denied = self._request(
            "GET",
            "/api/admin/support/admins",
            headers=self._headers(self.reporter.student_id),
        )
        self.assertEqual(denied.status_code, 403)

    def test_admin_can_assign_reassign_and_unassign_support_ticket(self):
        ticket_id = self._create_ticket().json()["ticket"]["id"]
        next_admin = Admin(
            username="second-support-admin",
            email="second-admin@example.test",
            password_hash="test-hash",
            role="Admin",
            status="Active",
        )
        self.db.add(next_admin)
        self.db.commit()

        first_assignment = self._request(
            "PATCH",
            f"/api/admin/support/{ticket_id}/assign",
            headers=self._admin_headers(),
            json_body={"admin_id": self.admin.id},
        )
        second_assignment = self._request(
            "PATCH",
            f"/api/admin/support/{ticket_id}/assign",
            headers=self._admin_headers(),
            json_body={"admin_id": next_admin.id},
        )
        unassignment = self._request(
            "PATCH",
            f"/api/admin/support/{ticket_id}/assign",
            headers=self._admin_headers(),
            json_body={"admin_id": None},
        )

        self.assertEqual(first_assignment.status_code, 200, first_assignment.text)
        self.assertEqual(first_assignment.json()["ticket"]["assigned_admin_id"], self.admin.id)
        self.assertEqual(first_assignment.json()["ticket"]["assigned_admin"]["username"], self.admin.username)
        self.assertEqual(second_assignment.status_code, 200, second_assignment.text)
        self.assertEqual(second_assignment.json()["ticket"]["assigned_admin_id"], next_admin.id)
        self.assertEqual(unassignment.status_code, 200, unassignment.text)
        self.assertIsNone(unassignment.json()["ticket"]["assigned_admin_id"])
        self.assertIsNone(unassignment.json()["ticket"]["assigned_admin"])

        logs = self.db.query(AuditLog).filter(
            AuditLog.action == "Support Ticket Assigned",
            AuditLog.entity_id == ticket_id,
        ).order_by(AuditLog.id).all()
        self.assertEqual(len(logs), 3)
        self.assertTrue(all(log.admin_id == self.admin.id for log in logs))
        self.assertIn(f"none -> {self.admin.id}", logs[0].description)
        self.assertIn(f"{self.admin.id} -> {next_admin.id}", logs[1].description)
        self.assertIn(f"{next_admin.id} -> none", logs[2].description)

        assigned_notification = self.db.query(AdminNotification).filter(
            AdminNotification.admin_id == next_admin.id,
            AdminNotification.reference_type == "support",
            AdminNotification.reference_id == str(ticket_id),
        ).one()
        self.assertIn(f"SUP-{ticket_id:04d}", assigned_notification.message)
        self.assertEqual(assigned_notification.action_url, f"/admin/support?ticket={ticket_id}")

    def test_support_assignment_rejects_unknown_ticket_invalid_admin_and_students(self):
        ticket_id = self._create_ticket().json()["ticket"]["id"]
        inactive_admin = Admin(
            username="inactive-assignee",
            email="inactive-assignee@example.test",
            password_hash="test-hash",
            role="Admin",
            status="Inactive",
        )
        self.db.add(inactive_admin)
        self.db.commit()

        unknown_admin = self._request(
            "PATCH",
            f"/api/admin/support/{ticket_id}/assign",
            headers=self._admin_headers(),
            json_body={"admin_id": 99999},
        )
        inactive_assignee = self._request(
            "PATCH",
            f"/api/admin/support/{ticket_id}/assign",
            headers=self._admin_headers(),
            json_body={"admin_id": inactive_admin.id},
        )
        missing_admin_id = self._request(
            "PATCH",
            f"/api/admin/support/{ticket_id}/assign",
            headers=self._admin_headers(),
            json_body={},
        )
        unknown_ticket = self._request(
            "PATCH",
            "/api/admin/support/99999/assign",
            headers=self._admin_headers(),
            json_body={"admin_id": None},
        )
        student_request = self._request(
            "PATCH",
            f"/api/admin/support/{ticket_id}/assign",
            headers=self._headers(self.reporter.student_id),
            json_body={"admin_id": self.admin.id},
        )

        self.assertEqual(unknown_admin.status_code, 404)
        self.assertEqual(inactive_assignee.status_code, 404)
        self.assertEqual(missing_admin_id.status_code, 422)
        self.assertEqual(unknown_ticket.status_code, 404)
        self.assertEqual(student_request.status_code, 403)


if __name__ == "__main__":
    unittest.main()
