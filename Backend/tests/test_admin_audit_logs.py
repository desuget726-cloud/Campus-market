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
            },
        )
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

    def test_summary_uses_login_history_and_audit_severity_counts(self):
        response = self.client.get(
            "/api/admin/audit-logs/summary",
            headers={"Authorization": "Bearer test-session"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            "total_events": 25,
            "logins": {"success": 2, "failed": 2, "total": 4},
            "admin_actions": 25,
            "alerts": {"critical": 0, "warning": 0, "informational": 25, "total": 25},
        })

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