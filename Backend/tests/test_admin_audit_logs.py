import os
import unittest
from datetime import datetime, timedelta
from unittest.mock import patch

os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import main as main_module
from app.database import Base, get_db
from app.models import Admin, AdminLoginHistory, AuditLog


class AdminAuditLogsEndpointTests(unittest.TestCase):
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
        self.admin = Admin(
            username="audit-admin",
            email="audit-admin@example.test",
            full_name="Audit Admin",
            password_hash="must-not-be-returned",
            role="Admin",
            two_factor_secret="must-not-be-returned",
            backup_codes="must-not-be-returned",
        )
        self.db.add(self.admin)
        self.db.flush()

        created_at = datetime(2026, 8, 12, 22, 0, 0)
        self.db.add_all([
            AuditLog(
                id=log_id,
                admin_id=self.admin.id,
                action=f"Admin action {log_id}",
                entity_type="Product",
                entity_id=log_id,
                description="Persisted audit row",
                status="SUCCESS",
                severity="informational",
                ip_address="197.156.0.25" if log_id == 25 else None,
                user_agent="Mozilla/5.0 (Audit Test)" if log_id == 25 else None,
                created_at=created_at + timedelta(seconds=log_id),
            )
            for log_id in range(1, 26)
        ])
        self.db.add_all([
            AdminLoginHistory(admin_id=self.admin.id, event_type="login_success"),
            AdminLoginHistory(admin_id=self.admin.id, event_type="login_success_2fa"),
            AdminLoginHistory(admin_id=self.admin.id, event_type="login_failed"),
            AdminLoginHistory(admin_id=self.admin.id, event_type="login_failed_locked"),
        ])
        self.db.commit()

        self.app = FastAPI()
        self.app.include_router(main_module.app.router)
        self.app.dependency_overrides[get_db] = lambda: self.db
        self.client = TestClient(self.app)
        self.session_patch = patch.object(
            main_module,
            "_admin_for_session",
            return_value=(self.admin, object()),
        )
        self.session_patch.start()

    def tearDown(self):
        self.session_patch.stop()
        self.client.close()
        self.db.close()

    def test_cleanup_old_audit_logs_removes_only_logs_older_than_30_days(self):
        fixed_now = datetime(2026, 8, 12, 22, 0, 0)
        cutoff_date = fixed_now - timedelta(days=30)
        old_log = AuditLog(
            admin_id=self.admin.id,
            action="Old audit log",
            entity_type="System",
            created_at=cutoff_date - timedelta(seconds=1),
        )
        boundary_log = AuditLog(
            admin_id=self.admin.id,
            action="Boundary audit log",
            entity_type="System",
            created_at=cutoff_date,
        )
        recent_log = AuditLog(
            admin_id=self.admin.id,
            action="Recent audit log",
            entity_type="System",
            created_at=cutoff_date + timedelta(seconds=1),
        )
        self.db.add_all([old_log, boundary_log, recent_log])
        self.db.commit()
        old_log_id = old_log.id
        boundary_log_id = boundary_log.id
        recent_log_id = recent_log.id

        class FixedDateTime(datetime):
            @classmethod
            def utcnow(cls):
                return fixed_now

        with patch.object(main_module, "datetime", FixedDateTime), \
             patch.object(main_module, "SessionLocal", side_effect=self.session_factory):
            deleted_count = main_module._cleanup_old_audit_logs()

        self.assertEqual(deleted_count, 1)
        remaining_ids = {
            log.id
            for log in self.db.query(AuditLog).filter(
                AuditLog.id.in_([old_log_id, boundary_log_id, recent_log_id])
            ).all()
        }
        self.assertEqual(remaining_ids, {boundary_log_id, recent_log_id})

    def get_logs(self, **params):
        return self.client.get(
            "/api/admin/audit-logs",
            params=params,
            headers={"Authorization": "Bearer test-session"},
        )

    def test_returns_newest_rows_with_only_audit_and_safe_admin_fields(self):
        response = self.get_logs(page=1, page_size=20)

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["total"], 25)
        self.assertEqual([row["id"] for row in payload["items"]], list(range(25, 5, -1)))
        self.assertEqual(payload["items"][0]["username"], "audit-admin")
        self.assertEqual(payload["items"][0]["full_name"], "Audit Admin")
        self.assertEqual(payload["items"][0]["role"], "Admin")
        self.assertEqual(
            set(payload["items"][0]),
            {
                "id", "admin_id", "action", "entity_type", "entity_id", "description",
                "status", "ip_address", "created_at", "severity", "username", "full_name", "role",
                "actor_id", "actor_username", "actor_name", "actor_role", "event_type",
                "category", "metadata", "user_agent",
            },
        )
        self.assertEqual(payload["items"][0]["actor_role"], "admin")
        self.assertEqual(payload["items"][0]["actor_name"], "Audit Admin")
        self.assertEqual(payload["items"][0]["event_type"], "ADMIN_ACTION_25")
        self.assertEqual(payload["items"][0]["category"], "ADMIN")
        self.assertEqual(payload["items"][0]["severity"], "INFO")
        self.assertEqual(payload["items"][0]["metadata"], {"description": "Persisted audit row"})
        self.assertEqual(payload["items"][0]["ip_address"], "197.156.0.25")
        self.assertEqual(payload["items"][0]["user_agent"], "Mozilla/5.0 (Audit Test)")
        self.assertTrue(payload["items"][0]["created_at"].endswith("Z"))
        self.assertNotIn("password_hash", payload["items"][0])
        self.assertNotIn("two_factor_secret", payload["items"][0])
        self.assertNotIn("backup_codes", payload["items"][0])

    def test_filters_audit_rows_and_requires_admin_session(self):
        response = self.get_logs(search="action 24", status="SUCCESS", page=1, page_size=20)
        unauthorized = self.client.get("/api/admin/audit-logs")

        self.assertEqual(response.status_code, 200)
        self.assertEqual([row["id"] for row in response.json()["items"]], [24])
        self.assertEqual(unauthorized.status_code, 401)

    def test_paginates_and_requires_exact_admin_role_or_sub_admin_permission(self):
        second_page = self.get_logs(page=2, page_size=10)
        self.assertEqual(second_page.status_code, 200)
        self.assertEqual([row["id"] for row in second_page.json()["items"]], list(range(15, 5, -1)))

        self.admin.role = "sub_admin"
        self.admin.permissions = {"audit_logs": False}
        self.db.commit()
        denied = self.get_logs()
        self.assertEqual(denied.status_code, 403)

        self.admin.permissions = {"audit_logs": True}
        self.db.commit()
        allowed_sub_admin = self.get_logs()
        self.assertEqual(allowed_sub_admin.status_code, 200)

        self.admin.role = "admin"
        self.db.commit()
        denied_role_case = self.get_logs()
        self.assertEqual(denied_role_case.status_code, 403)

    def test_cors_preflight_allows_explicit_frontend_origin_and_authorization(self):
        client = TestClient(main_module.app)
        response = client.options(
            "/api/admin/audit-logs",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "authorization",
            },
        )
        client.close()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers.get("access-control-allow-origin"), "http://localhost:5173")
        self.assertIn("authorization", response.headers.get("access-control-allow-headers", "").lower())

    def test_summary_uses_auth_audit_logs_and_audit_severity_counts(self):
        self.db.add_all([
            AuditLog(
                action="Background task complete",
                entity_type="System",
                description="Automated cleanup complete",
                status="SUCCESS",
                severity="informational",
            ),
            AuditLog(
                admin_id=self.admin.id,
                action="Report Escalated",
                entity_type="Report",
                entity_id=11,
                status="SUCCESS",
                severity="warning",
            ),
            AuditLog(
                admin_id=self.admin.id,
                action="User Banned",
                entity_type="User",
                entity_id=1600418,
                status="SUCCESS",
                severity="critical",
            ),
            AuditLog(
                admin_id=self.admin.id,
                action="ADMIN_LOGIN_SUCCESS",
                entity_type="User Account",
                description='{"message":"Login successful via credentials"}',
                status="SUCCESS",
                severity="INFO",
                category="AUTH",
                actor_role="admin",
                metadata_json={"actor_name": "Audit Admin", "actor_id": self.admin.id},
            ),
            AuditLog(
                action="USER_LOGIN_SUCCESS",
                entity_type="User Account",
                description='{"message":"Login successful via credentials"}',
                status="SUCCESS",
                severity="INFO",
                category="AUTH",
                actor_role="student",
                metadata_json={"actor_name": "Student Example", "actor_id": "MAU1600001"},
            ),
            AuditLog(
                action="AUTH_LOGIN_FAILED",
                entity_type="User Account",
                description='{"reason":"Invalid password or unverified account"}',
                status="FAILURE",
                severity="WARNING",
                category="AUTH",
                actor_role="unknown",
                metadata_json={"actor_name": "missing@example.test"},
            ),
            AuditLog(
                action="AUTH_LOGIN_FAILED",
                entity_type="User Account",
                description='{"reason":"Invalid password or unverified account"}',
                status="FAILURE",
                severity="WARNING",
                category="AUTH",
                actor_role="student",
                metadata_json={"actor_name": "student@example.test"},
            ),
        ])
        self.db.commit()
        response = self.client.get(
            "/api/admin/audit-logs/summary",
            headers={"Authorization": "Bearer test-session"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            "total_events": 32,
            "logins": {"success": 2, "failed": 2, "total": 4},
            "admin_actions": 28,
            "alerts": {"critical": 1, "warning": 3, "informational": 28, "total": 4},
        })

    def test_auth_category_includes_successful_and_failed_login_events(self):
        self.db.add_all([
            AuditLog(
                action="USER_LOGIN_SUCCESS",
                entity_type="User Account",
                description="Login successful",
                status="SUCCESS",
                severity="INFO",
                category="AUTH",
                actor_role="student",
                metadata_json={"actor_name": "Student Example", "actor_id": "MAU1600001"},
            ),
            AuditLog(
                action="AUTH_LOGIN_FAILED",
                entity_type="User Account",
                description="Invalid password",
                status="FAILURE",
                severity="WARNING",
                category="AUTH",
                actor_role="unknown",
                metadata_json={
                    "actor_name": "missing@example.test",
                    "attempted_identifier": "missing@example.test",
                    "device": "Windows / Chrome",
                },
                ip_address="203.0.113.10",
            ),
        ])
        self.db.commit()

        response = self.get_logs(category="AUTH")

        self.assertEqual(response.status_code, 200)
        items = response.json()["items"]
        self.assertEqual({item["action"] for item in items}, {
            "USER_LOGIN_SUCCESS",
            "AUTH_LOGIN_FAILED",
        })
        failed_login = next(item for item in items if item["action"] == "AUTH_LOGIN_FAILED")
        self.assertEqual(failed_login["actor_name"], "missing@example.test")
        self.assertEqual(failed_login["actor_role"], "unknown")
        self.assertEqual(failed_login["actor_id"], None)
        self.assertEqual(failed_login["metadata"]["attempted_identifier"], "missing@example.test")

    def test_filters_by_ip_severity_and_category(self):
        self.db.add_all([
            AuditLog(
                admin_id=self.admin.id,
                action="Report Escalated",
                entity_type="Report",
                entity_id=11,
                description='{"old_status":"under_review","new_status":"escalated"}',
                status="SUCCESS",
                severity="warning",
            ),
            AuditLog(
                action="Background task complete",
                entity_type="System",
                description="Automated cleanup complete",
                status="SUCCESS",
                severity="informational",
            ),
            AuditLog(
                action="Payout threshold reached",
                entity_type="Payout",
                description="Payout requires review.",
                status="SUCCESS",
                severity="informational",
            ),
        ])
        self.db.commit()

        warning = self.get_logs(severity="WARNING", category="SECURITY")
        financial_warning = self.get_logs(severity="WARNING", category="FINANCIAL")
        by_ip = self.get_logs(search="197.156.0.25")
        system = self.get_logs(category="SYSTEM", severity="INFO")

        self.assertEqual(warning.status_code, 200)
        self.assertEqual([row["event_type"] for row in warning.json()["items"]], ["REPORT_ESCALATED"])
        self.assertEqual(warning.json()["items"][0]["metadata"], {
            "old_status": "under_review",
            "new_status": "escalated",
        })
        self.assertEqual([row["event_type"] for row in financial_warning.json()["items"]], ["PAYOUT_THRESHOLD_REACHED"])
        self.assertEqual([row["id"] for row in by_ip.json()["items"]], [25])
        self.assertEqual(len(system.json()["items"]), 1)

    def test_invalid_and_expired_admin_jwts_are_rejected(self):
        with patch.dict(os.environ, {"SESSION_SECRET": "audit-test-secret"}):
            with self.assertRaises(HTTPException) as invalid_error:
                main_module._decode_admin_jwt("not-a-jwt")
            expired_token = main_module._create_session_token(
                self.admin.username,
                "admin",
                -1,
                "audit-test-secret",
            )
            with self.assertRaises(HTTPException) as expired_error:
                main_module._decode_admin_jwt(expired_token)

        self.assertEqual(invalid_error.exception.status_code, 401)
        self.assertEqual(expired_error.exception.status_code, 401)


if __name__ == "__main__":
    unittest.main()