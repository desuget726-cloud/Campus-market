import json
import os
import unittest
import asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import database, main as main_module
from app.database import Base, get_db
from app.models import Admin, AdminSession, SystemSetting


class AdminSessionLifecycleTests(unittest.TestCase):
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
            username="session-lifecycle-admin",
            email="session-lifecycle@example.test",
            full_name="Session Lifecycle Admin",
            password_hash="hashed-test-password",
            role="Admin",
            status="Active",
        )
        self.db.add(self.admin)
        self.db.add(SystemSetting(
            key="security",
            value=json.dumps({
                "admin2FA": False,
                "sessionTimeout": 30,
            }),
        ))
        self.db.commit()

        self.app = FastAPI()
        self.app.include_router(main_module.app.router)
        self.app.dependency_overrides[get_db] = lambda: self.db
        self.client = TestClient(self.app)
        self.env_patch = patch.dict(
            os.environ,
            {
                "SESSION_SECRET": "test-admin-session-lifecycle-secret",
                "ADMIN_SINGLE_SESSION": "false",
                "ADMIN_SESSION_INACTIVITY_MINUTES": "30",
            },
        )
        self.env_patch.start()
        self.password_patch = patch.object(main_module, "verify_password", return_value=True)
        self.password_patch.start()

    def tearDown(self):
        self.password_patch.stop()
        self.env_patch.stop()
        self.client.close()
        self.db.close()

    def login(self, user_agent=None):
        headers = {"user-agent": user_agent} if user_agent else {}
        return self.client.post(
            "/api/login",
            headers=headers,
            json={"id_or_email": self.admin.email, "password": "ValidPassword!23"},
        )

    def test_login_then_immediate_admin_me_keeps_new_session_active(self):
        response = self.login()
        self.assertEqual(response.status_code, 200, response.text)

        token = response.json()["access_token"]
        profile = self.client.get(
            "/api/admin/me",
            headers={"Authorization": f"Bearer {token}"},
        )

        self.assertEqual(profile.status_code, 200, profile.text)
        session = self.db.query(AdminSession).one()
        self.assertTrue(session.is_active)
        self.assertIsNone(session.revoked_at)
        self.assertIsNone(session.revoke_reason)

    def test_duplicate_login_within_two_seconds_reuses_the_active_session(self):
        first = self.login()
        second = self.login()

        self.assertEqual(first.status_code, 200, first.text)
        self.assertEqual(second.status_code, 200, second.text)
        self.assertEqual(first.json()["access_token"], second.json()["access_token"])
        self.assertEqual(self.db.query(AdminSession).count(), 1)
        self.assertEqual(self.db.query(AdminSession).filter_by(is_active=True).count(), 1)

    def test_multiple_logins_remain_active_when_single_session_is_disabled(self):
        first = self.login("browser-one")
        second = self.login("browser-two")

        self.assertEqual(first.status_code, 200, first.text)
        self.assertEqual(second.status_code, 200, second.text)
        sessions = self.db.query(AdminSession).order_by(AdminSession.id).all()
        self.assertEqual(len(sessions), 2)
        self.assertTrue(all(session.is_active for session in sessions))
        self.assertTrue(all(session.revoke_reason is None for session in sessions))

    def test_authenticated_requests_refresh_last_active_at_most_once_per_minute(self):
        fixed_now = datetime.now(timezone.utc)
        token = main_module._create_session_token(
            self.admin.username,
            "admin",
            60,
            "test-admin-session-lifecycle-secret",
        )
        session = AdminSession(
            admin_id=self.admin.id,
            session_token=token,
            is_active=True,
            created_at=fixed_now.replace(tzinfo=None) - timedelta(hours=1),
            last_active=fixed_now.replace(tzinfo=None) - timedelta(minutes=2),
        )
        self.db.add(session)
        self.db.commit()
        previous_activity = session.last_active

        headers = {"Authorization": f"Bearer {token}"}
        with patch.object(main_module, "_utc_now", return_value=fixed_now):
            first = self.client.get("/api/admin/me", headers=headers)
            self.assertEqual(first.status_code, 200, first.text)
            self.db.refresh(session)
            refreshed_activity = session.last_active
            self.assertGreater(refreshed_activity, previous_activity)
            self.assertEqual(refreshed_activity, fixed_now.replace(tzinfo=None))

            second = self.client.get("/api/admin/me", headers=headers)
            self.assertEqual(second.status_code, 200, second.text)
            self.db.refresh(session)
            self.assertEqual(session.last_active, refreshed_activity)

    def test_inactive_admin_request_returns_code_and_persists_reason(self):
        token = main_module._create_session_token(
            self.admin.username,
            "admin",
            60,
            "test-admin-session-lifecycle-secret",
        )
        session = AdminSession(
            admin_id=self.admin.id,
            session_token=token,
            is_active=True,
            created_at=datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=31),
            last_active=datetime.now(timezone.utc) - timedelta(minutes=31),
        )
        self.db.add(session)
        self.db.commit()

        response = self.client.get(
            "/api/admin/me",
            headers={"Authorization": f"Bearer {token}"},
        )

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["detail"]["code"], "session_inactive")
        self.assertFalse(session.is_active)
        self.assertEqual(session.revoke_reason, "inactivity_cleanup")
        self.assertIsNotNone(session.revoked_at)

    def test_single_session_revokes_only_the_previous_session_with_reason(self):
        first = self.login("browser-one")
        self.assertEqual(first.status_code, 200, first.text)

        with patch.dict(os.environ, {"ADMIN_SINGLE_SESSION": "true"}):
            second = self.login("browser-two")

        self.assertEqual(second.status_code, 200, second.text)
        sessions = self.db.query(AdminSession).order_by(AdminSession.id).all()
        self.assertEqual(len(sessions), 2)
        self.assertFalse(sessions[0].is_active)
        self.assertEqual(sessions[0].revoke_reason, "new_login_single_session")
        self.assertIsNotNone(sessions[0].revoked_at)
        self.assertTrue(sessions[1].is_active)
        self.assertIsNone(sessions[1].revoke_reason)

        rejected = self.client.get(
            "/api/admin/me",
            headers={"Authorization": f"Bearer {first.json()['access_token']}"},
        )
        self.assertEqual(rejected.status_code, 401)
        self.assertEqual(rejected.json()["detail"]["code"], "session_replaced")

    def test_cleanup_revokes_only_sessions_past_the_configured_idle_timeout(self):
        now = datetime(2026, 10, 27, 8, 0, tzinfo=timezone.utc)
        stale = AdminSession(
            admin_id=self.admin.id,
            session_token="stale-admin-session",
            is_active=True,
            created_at=now.replace(tzinfo=None) - timedelta(minutes=40),
            last_active=now.replace(tzinfo=None) - timedelta(minutes=31),
        )
        active = AdminSession(
            admin_id=self.admin.id,
            session_token="recent-admin-session",
            is_active=True,
            created_at=now.replace(tzinfo=None) - timedelta(minutes=20),
            last_active=now.replace(tzinfo=None) - timedelta(minutes=2),
        )
        just_created = AdminSession(
            admin_id=self.admin.id,
            session_token="just-created-admin-session",
            is_active=True,
            created_at=now.replace(tzinfo=None),
            last_active=now.replace(tzinfo=None),
        )
        self.db.add_all([stale, active, just_created])
        self.db.commit()

        self.db.close()
        with patch.object(main_module, "_utc_now", return_value=now), patch.object(
            main_module, "SessionLocal", side_effect=self.session_factory
        ):
            revoked_count = main_module._cleanup_inactive_admin_sessions()

        self.assertEqual(revoked_count, 1)
        self.db = self.session_factory()
        stale = self.db.query(AdminSession).filter_by(session_token="stale-admin-session").one()
        active = self.db.query(AdminSession).filter_by(session_token="recent-admin-session").one()
        just_created = self.db.query(AdminSession).filter_by(
            session_token="just-created-admin-session"
        ).one()
        self.assertFalse(stale.is_active)
        self.assertEqual(stale.revoke_reason, "inactivity_cleanup")
        self.assertIsNotNone(stale.revoked_at)
        self.assertTrue(active.is_active)
        self.assertIsNone(active.revoke_reason)
        self.assertTrue(just_created.is_active)
        self.assertIsNone(just_created.revoke_reason)

    def test_inactivity_timeout_below_five_minutes_is_rejected(self):
        with patch.dict(os.environ, {"ADMIN_SESSION_INACTIVITY_MINUTES": "4"}):
            with self.assertRaisesRegex(RuntimeError, "at least 5"):
                main_module._admin_session_inactivity_minutes()

    def test_startup_rejects_an_invalid_inactivity_timeout(self):
        with patch.dict(os.environ, {"ADMIN_SESSION_INACTIVITY_MINUTES": "4"}):
            with self.assertRaisesRegex(RuntimeError, "at least 5"):
                asyncio.run(main_module.on_startup())

    def test_startup_does_not_revoke_a_valid_admin_session(self):
        session = AdminSession(
            admin_id=self.admin.id,
            session_token="startup-valid-session",
            is_active=True,
        )
        self.db.add(session)
        self.db.commit()
        previous_scheduler = main_module.payment_scheduler

        class FakeScheduler:
            def add_job(self, *args, **kwargs):
                return None

            def start(self):
                return None

        try:
            with patch.dict(os.environ, {"AI_PROVIDER": "test"}), \
                 patch.object(main_module, "_check_production_configuration"), \
                 patch.object(main_module, "init_db"), \
                 patch.object(main_module, "SessionLocal", return_value=self.db), \
                 patch.object(main_module, "ensure_database_compatibility"), \
                 patch.object(main_module, "_seed_default_system_settings"), \
                 patch.object(main_module, "backfill_report_targets"), \
                 patch.object(main_module, "purge_legacy_soft_deleted_login_history"), \
                 patch.object(main_module, "AsyncIOScheduler", return_value=FakeScheduler()):
                asyncio.run(main_module.on_startup())
            self.db = self.session_factory()
            stored = self.db.query(AdminSession).filter_by(
                session_token="startup-valid-session"
            ).one()
            self.assertTrue(stored.is_active)
            self.assertIsNone(stored.revoked_at)
            self.assertIsNone(stored.revoke_reason)
        finally:
            main_module.payment_scheduler = previous_scheduler

    def test_admin_logout_records_revocation_metadata(self):
        response = self.login()
        token = response.json()["access_token"]

        logged_out = self.client.post(
            "/api/admin/logout",
            headers={"Authorization": f"Bearer {token}"},
        )

        self.assertEqual(logged_out.status_code, 200, logged_out.text)
        session = self.db.query(AdminSession).one()
        self.assertFalse(session.is_active)
        self.assertEqual(session.revoke_reason, "logout")
        self.assertIsNotNone(session.revoked_at)

    def test_init_db_migrates_existing_sqlite_sessions_without_revoking_them(self):
        engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        try:
            Base.metadata.create_all(bind=engine, tables=[Admin.__table__])
            with engine.begin() as connection:
                connection.execute(text(
                    "CREATE TABLE admin_sessions ("
                    "id INTEGER PRIMARY KEY, admin_id INTEGER NOT NULL, "
                    "session_token VARCHAR(500) NOT NULL UNIQUE, "
                    "ip_address VARCHAR(50), device_browser VARCHAR(255), "
                    "is_active BOOLEAN NOT NULL DEFAULT TRUE, "
                    "last_active DATETIME NOT NULL, created_at DATETIME NOT NULL)"
                ))
                connection.execute(text(
                    "INSERT INTO admin_sessions "
                    "(id, admin_id, session_token, is_active, last_active, created_at) "
                    "VALUES (1, 1, 'existing-valid-session', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
                ))

            with patch.object(database, "engine", engine):
                database.init_db()
                database.init_db()

            columns = {column["name"] for column in inspect(engine).get_columns("admin_sessions")}
            self.assertIn("revoked_at", columns)
            self.assertIn("revoke_reason", columns)
            with engine.connect() as connection:
                row = connection.execute(text(
                    "SELECT is_active, revoked_at, revoke_reason "
                    "FROM admin_sessions WHERE id = 1"
                )).one()
            self.assertTrue(row.is_active)
            self.assertIsNone(row.revoked_at)
            self.assertIsNone(row.revoke_reason)
        finally:
            engine.dispose()


if __name__ == "__main__":
    unittest.main()
