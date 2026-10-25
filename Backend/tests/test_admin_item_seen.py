import asyncio
import base64
import hashlib
import hmac
import json
import os
import time
import uuid
from datetime import datetime, timedelta, timezone

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SESSION_SECRET", "admin-item-seen-test-secret")

import httpx
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import main as main_module
from app.database import Base, get_db
from app.models import (
    Admin,
    AdminItemSeen,
    AdminNotification,
    AdminSession,
    Report,
    ReportMessage,
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


class TestAdminItemSeen:
    @classmethod
    def setup_class(cls):
        cls.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        cls.session_factory = sessionmaker(bind=cls.engine, autoflush=False, autocommit=False)
        Base.metadata.create_all(bind=cls.engine)

    @classmethod
    def teardown_class(cls):
        cls.engine.dispose()

    def setup_method(self):
        Base.metadata.drop_all(bind=self.engine)
        Base.metadata.create_all(bind=self.engine)
        self.db = self.session_factory()
        self.admin_a = self._admin("admin-a")
        self.admin_b = self._admin("admin-b")
        self.student = Student(
            name="Seen Test Student",
            student_id="seen-student",
            email="seen-student@example.test",
            password="test-password",
            college="Test College",
            department="Testing",
            is_verified=True,
        )
        self.db.add(self.student)
        self.db.flush()
        self.tokens = {
            self.admin_a.id: _jwt(self.admin_a.username, "admin"),
            self.admin_b.id: _jwt(self.admin_b.username, "admin"),
        }
        self.db.add_all([
            AdminSession(admin_id=self.admin_a.id, session_token=self.tokens[self.admin_a.id], is_active=True),
            AdminSession(admin_id=self.admin_b.id, session_token=self.tokens[self.admin_b.id], is_active=True),
        ])
        self.student_session_id = str(uuid.uuid4())
        self.student_token = _jwt(
            self.student.student_id,
            "student",
            session_id=self.student_session_id,
        )
        self.db.add(UserSession(
            id=self.student_session_id,
            user_id=self.student.student_id,
            device_name="Seen test device",
        ))
        self.db.commit()

        def override_get_db():
            yield self.db

        main_module.app.dependency_overrides[get_db] = override_get_db

    def teardown_method(self):
        main_module.app.dependency_overrides.pop(get_db, None)
        self.db.close()

    def _admin(self, username):
        admin = Admin(
            username=username,
            email=f"{username}@example.test",
            password_hash="test-hash",
            role="Admin",
        )
        self.db.add(admin)
        self.db.flush()
        return admin

    def _headers(self, admin_id):
        return {"Authorization": f"Bearer {self.tokens[admin_id]}"}

    def _request(self, method, path, *, admin_id=None, student=False):
        headers = (
            {"Authorization": f"Bearer {self.student_token}"}
            if student
            else self._headers(admin_id)
        )

        async def send():
            transport = httpx.ASGITransport(app=main_module.app)
            async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
                return await client.request(method, path, headers=headers)

        return asyncio.run(send())

    def _report(self, status="Open"):
        report = Report(
            student_id=self.student.student_id,
            student_name=self.student.name,
            email=self.student.email,
            category="Product Report",
            issue="A detailed report used to verify per-admin seen state.",
            status=status,
            created_at=datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=5),
        )
        self.db.add(report)
        self.db.flush()
        return report

    def _ticket(self):
        now = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=5)
        ticket = SupportTicket(
            user_id=self.student.student_id,
            requester_name=self.student.name,
            requester_email=self.student.email,
            subject="Test support ticket",
            category="Account Problem",
            message="A support ticket message for seen-state testing.",
            status="Open",
            created_at=now,
            updated_at=now,
        )
        self.db.add(ticket)
        self.db.flush()
        return ticket

    def _counts(self, admin_id):
        response = self._request("GET", "/api/admin/sidebar-counts", admin_id=admin_id)
        assert response.status_code == 200, response.text
        return response.json()

    def test_seen_counts_are_per_admin_and_opening_decreases_one(self):
        report = self._report()
        ticket = self._ticket()
        for admin in (self.admin_a, self.admin_b):
            for reference_type, reference_id in (("report", report.id), ("support", ticket.id)):
                self.db.add(AdminNotification(
                    admin_id=admin.id,
                    title="New queue item",
                    message="A queue item requires attention.",
                    reference_type=reference_type,
                    reference_id=str(reference_id),
                    is_read=False,
                ))
        self.db.commit()
        report_list = self._request("GET", "/api/admin/reports", admin_id=self.admin_a.id)
        support_list = self._request("GET", "/support/tickets", admin_id=self.admin_a.id)
        assert report_list.status_code == 200
        assert report_list.json()[0]["is_unseen"] is True
        assert support_list.status_code == 200
        assert support_list.json()["items"][0]["is_unseen"] is True
        initial = self._counts(self.admin_a.id)
        assert initial["unseenReports"] == 1
        assert initial["unseenSupport"] == 1

        response = self._request(
            "POST",
            f"/api/admin/reports/{report.id}/seen",
            admin_id=self.admin_a.id,
        )
        assert response.status_code == 200, response.text
        after_report_seen = self._counts(self.admin_a.id)
        assert after_report_seen["unseenReports"] == initial["unseenReports"] - 1
        assert after_report_seen["unseenSupport"] == initial["unseenSupport"]
        assert self._counts(self.admin_b.id)["unseenReports"] == 1
        assert self.db.query(AdminNotification).filter_by(
            admin_id=self.admin_a.id,
            reference_type="report",
            is_read=True,
        ).count() == 1
        assert self.db.query(AdminNotification).filter_by(
            admin_id=self.admin_b.id,
            reference_type="report",
            is_read=False,
        ).count() == 1

        response = self._request(
            "POST",
            f"/api/admin/support/{ticket.id}/seen",
            admin_id=self.admin_a.id,
        )
        assert response.status_code == 200, response.text
        assert self._counts(self.admin_a.id)["unseenSupport"] == 0
        assert self._counts(self.admin_b.id)["unseenSupport"] == 1
        assert self.db.query(AdminNotification).filter_by(
            admin_id=self.admin_a.id,
            reference_type="support",
            is_read=True,
        ).count() == 1

    def test_student_activity_reopens_seen_items_but_admin_replies_do_not(self):
        report = self._report(status="Resolved")
        ticket = self._ticket()
        self.db.commit()
        for path in (
            f"/api/admin/reports/{report.id}/seen",
            f"/api/admin/support/{ticket.id}/seen",
        ):
            response = self._request("POST", path, admin_id=self.admin_a.id)
            assert response.status_code == 200, response.text

        report.appeal_text = "Please review this decision again."
        report.appealed_by = self.student.student_id
        report.appealed_at = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(seconds=1)
        ticket_message_at = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(seconds=1)
        self.db.add(SupportTicketMessage(
            ticket_id=ticket.id,
            sender_type="student",
            sender_id=self.student.student_id,
            body="A new student reply.",
            is_internal=False,
            created_at=ticket_message_at,
        ))
        self.db.commit()
        updated_counts = self._counts(self.admin_a.id)
        assert updated_counts["unseenReports"] == 1
        assert updated_counts["unseenSupport"] == 1

        self._request("POST", f"/api/admin/reports/{report.id}/seen", admin_id=self.admin_a.id)
        self.db.add(ReportMessage(
            report_id=report.id,
            admin_id=None,
            body="A new reporter note.",
            is_internal=False,
            created_at=report.appealed_at + timedelta(seconds=1),
        ))
        self.db.commit()
        assert self._counts(self.admin_a.id)["unseenReports"] == 1

        for path in (
            f"/api/admin/reports/{report.id}/seen",
            f"/api/admin/support/{ticket.id}/seen",
        ):
            response = self._request("POST", path, admin_id=self.admin_a.id)
            assert response.status_code == 200, response.text
        self.db.add(SupportTicketMessage(
            ticket_id=ticket.id,
            sender_type="admin",
            sender_id=str(self.admin_a.id),
            body="An admin reply.",
            is_internal=False,
            created_at=ticket_message_at + timedelta(seconds=1),
        ))
        ticket.last_admin_reply_at = ticket_message_at + timedelta(seconds=1)
        self.db.commit()
        counts_after_admin_reply = self._counts(self.admin_a.id)
        assert counts_after_admin_reply["unseenReports"] == 0
        assert counts_after_admin_reply["unseenSupport"] == 0

    def test_overdue_indicator_clears_on_admin_reply_or_close(self):
        ticket = self._ticket()
        ticket.created_at = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=3)
        ticket.updated_at = ticket.created_at
        self.db.commit()
        assert self._counts(self.admin_a.id)["supportOverdue"] == 1

        ticket.last_admin_reply_at = datetime.now(timezone.utc).replace(tzinfo=None)
        self.db.commit()
        assert self._counts(self.admin_a.id)["supportOverdue"] == 0

        ticket.last_admin_reply_at = None
        ticket.status = "Closed"
        self.db.commit()
        assert self._counts(self.admin_a.id)["supportOverdue"] == 0

    def test_seen_endpoint_is_idempotent_and_student_is_forbidden(self):
        report = self._report()
        ticket = self._ticket()
        self.db.commit()

        for _ in range(2):
            report_response = self._request(
                "POST",
                f"/api/admin/reports/{report.id}/seen",
                admin_id=self.admin_a.id,
            )
            ticket_response = self._request(
                "POST",
                f"/api/admin/support/{ticket.id}/seen",
                admin_id=self.admin_a.id,
            )
            assert report_response.status_code == 200
            assert ticket_response.status_code == 200

        assert self.db.query(AdminItemSeen).filter_by(
            admin_id=self.admin_a.id,
            item_type="report",
            item_id=report.id,
        ).count() == 1
        assert self.db.query(AdminItemSeen).filter_by(
            admin_id=self.admin_a.id,
            item_type="support_ticket",
            item_id=ticket.id,
        ).count() == 1
        assert self._request(
            "POST",
            f"/api/admin/reports/{report.id}/seen",
            student=True,
        ).status_code == 403
        assert self._request(
            "POST",
            f"/api/admin/support/{ticket.id}/seen",
            student=True,
        ).status_code == 403
        assert self._request("POST", "/api/admin/reports/seen-all", student=True).status_code == 403
        assert self._request("POST", "/api/admin/support/seen-all", student=True).status_code == 403
        assert self._request("POST", "/support/notifications/read-all", student=True).status_code == 403

    def test_mark_all_clears_only_current_admin_counts_and_notifications(self):
        report = self._report()
        ticket = self._ticket()
        for admin in (self.admin_a, self.admin_b):
            self.db.add(AdminNotification(
                admin_id=admin.id,
                title="New report",
                message="A report requires attention.",
                reference_type="report",
                reference_id=str(report.id),
                action_url=f"/admin/reports?report={report.id}",
                is_read=False,
            ))
        self.db.commit()

        self._request("POST", "/api/admin/reports/seen-all", admin_id=self.admin_a.id)
        self._request("POST", "/api/admin/support/seen-all", admin_id=self.admin_a.id)
        self._request("POST", "/support/notifications/read-all", admin_id=self.admin_a.id)
        cleared = self._counts(self.admin_a.id)
        assert cleared["unseenReports"] == 0
        assert cleared["unseenSupport"] == 0
        assert cleared["unreadNotifications"] == 0
        untouched = self._counts(self.admin_b.id)
        assert untouched["unseenReports"] == 1
        assert untouched["unseenSupport"] == 1
        assert untouched["unreadNotifications"] == 1
