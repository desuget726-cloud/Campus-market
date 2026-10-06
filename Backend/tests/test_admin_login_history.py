import os
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import main as main_module
from app.database import Base, get_db
from app.models import Admin, AdminLoginHistory, AdminSession, AuditLog


class AdminLoginHistoryEndpointTests(unittest.TestCase):
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
        self.admin = self.create_admin("history-admin")
        self.other_admin = self.create_admin("other-history-admin")
        self.now = datetime.now(timezone.utc).replace(tzinfo=None)
        self.current_session = AdminSession(
            admin_id=self.admin.id,
            session_token="current-session",
            is_active=True,
            created_at=self.now,
            ip_address="127.0.0.1",
            device_browser="Test Browser",
        )
        self.db.add(self.current_session)
        self.db.flush()
        self.current_entry = self.add_history(
            admin_id=self.admin.id,
            event_type="login_success",
            created_at=self.now,
            admin_session_id=self.current_session.id,
            ip_address=self.current_session.ip_address,
            device_browser=self.current_session.device_browser,
        )
        self.own_entry = self.add_history(
            admin_id=self.admin.id,
            event_type="login_failed",
            created_at=self.now - timedelta(days=8),
        )
        self.other_admin_entry = self.add_history(
            admin_id=self.other_admin.id,
            event_type="login_failed",
            created_at=self.now - timedelta(days=8),
        )
        self.db.commit()

        self.app = FastAPI()
        self.app.include_router(main_module.app.router)
        self.app.dependency_overrides[get_db] = lambda: self.db
        self.client = TestClient(self.app)
        self.session_patch = patch.object(
            main_module,
            "_admin_for_session",
            return_value=(self.admin, self.current_session),
        )
        self.session_patch.start()

    def tearDown(self):
        self.session_patch.stop()
        self.client.close()
        self.db.close()

    def create_admin(self, username):
        admin = Admin(
            username=username,
            email=f"{username}@example.test",
            full_name=username,
            password_hash="not-a-real-password-hash",
            role="Admin",
        )
        self.db.add(admin)
        self.db.flush()
        return admin

    def add_history(self, *, admin_id, event_type, created_at, admin_session_id=None, **values):
        entry = AdminLoginHistory(
            admin_id=admin_id,
            admin_session_id=admin_session_id,
            event_type=event_type,
            created_at=created_at,
            **values,
        )
        self.db.add(entry)
        self.db.flush()
        return entry

    def request(self, method, path, **kwargs):
        return self.client.request(
            method,
            path,
            headers={"Authorization": "Bearer current-session"},
            **kwargs,
        )

    def test_list_is_scoped_hides_deleted_rows_and_paginates(self):
        self.add_history(
            admin_id=self.admin.id,
            event_type="already_deleted",
            created_at=self.now,
            is_deleted=True,
            deleted_at=self.now,
        )
        self.db.commit()

        response = self.request("GET", "/api/admin/login-history", params={"page": 1, "page_size": 1})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["total"], 2)
        self.assertEqual(len(response.json()["items"]), 1)
        self.assertEqual(response.json()["page_size"], 1)
        self.assertTrue(response.json()["items"][0]["is_current_session"])
        self.assertNotIn(self.other_admin_entry.id, [row["id"] for row in response.json()["items"]])

    def test_legacy_current_session_login_entry_is_protected(self):
        self.current_entry.admin_session_id = None
        self.db.commit()

        response = self.request(
            "DELETE",
            f"/api/admin/login-history/{self.current_entry.id}",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"deleted": 0})
        self.db.refresh(self.current_entry)
        self.assertFalse(self.current_entry.is_deleted)

    def test_single_and_bulk_deletes_are_soft_and_never_delete_current_session_entry(self):
        single_response = self.request(
            "DELETE",
            f"/api/admin/login-history/{self.own_entry.id}",
        )
        bulk_response = self.request(
            "POST",
            "/api/admin/login-history/bulk-delete",
            json={"ids": [self.current_entry.id, self.other_admin_entry.id]},
        )

        self.assertEqual(single_response.status_code, 200)
        self.assertEqual(single_response.json(), {"deleted": 1})
        self.assertEqual(bulk_response.status_code, 200)
        self.assertEqual(bulk_response.json(), {"deleted": 0})
        self.db.refresh(self.own_entry)
        self.db.refresh(self.current_entry)
        self.db.refresh(self.other_admin_entry)
        self.assertTrue(self.own_entry.is_deleted)
        self.assertIsNotNone(self.own_entry.deleted_at)
        self.assertFalse(self.current_entry.is_deleted)
        self.assertFalse(self.other_admin_entry.is_deleted)
        actions = [row.action for row in self.db.query(AuditLog).all()]
        self.assertEqual(actions.count("login_history_deleted"), 2)

    def test_delete_all_requires_confirmation_and_supports_age_filter(self):
        invalid = self.request(
            "POST",
            "/api/admin/login-history/delete-all",
            json={"confirm": "delete", "older_than_days": 7},
        )
        valid = self.request(
            "POST",
            "/api/admin/login-history/delete-all",
            json={"confirm": "DELETE", "older_than_days": 7},
        )

        self.assertEqual(invalid.status_code, 400)
        self.assertEqual(valid.status_code, 200)
        self.assertEqual(valid.json(), {"deleted": 1})
        self.db.refresh(self.own_entry)
        self.db.refresh(self.current_entry)
        self.assertTrue(self.own_entry.is_deleted)
        self.assertFalse(self.current_entry.is_deleted)

    def test_purge_hard_deletes_expired_rows_and_audits_count(self):
        expired = self.add_history(
            admin_id=self.admin.id,
            event_type="expired",
            created_at=self.now - timedelta(days=40),
            is_deleted=True,
            deleted_at=self.now - timedelta(days=31),
        )
        retained = self.add_history(
            admin_id=self.admin.id,
            event_type="retained",
            created_at=self.now - timedelta(days=35),
            is_deleted=True,
            deleted_at=self.now - timedelta(days=29),
        )
        self.db.commit()
        expired_id = expired.id
        retained_id = retained.id

        with patch.dict(os.environ, {"LOGIN_HISTORY_PURGE_DAYS": "30"}):
            with patch.object(main_module, "SessionLocal", self.session_factory):
                purged = main_module.purge_deleted_login_history()

        self.assertEqual(purged, 1)
        self.db.expire_all()
        self.assertIsNone(self.db.get(AdminLoginHistory, expired_id))
        self.assertIsNotNone(self.db.get(AdminLoginHistory, retained_id))
        audit = self.db.query(AuditLog).filter_by(action="login_history_purged").one()
        self.assertIn("purged 1", audit.description)


if __name__ == "__main__":
    unittest.main()
