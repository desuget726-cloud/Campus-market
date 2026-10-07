import json
import os
import unittest
from unittest.mock import patch

os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import main as main_module
from app.database import Base, get_db
from app.models import Admin, AdminSession, SystemSetting


class AdminSecuritySettingsTests(unittest.TestCase):
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
            username="security-settings-admin",
            email="security-settings@example.test",
            full_name="Security Settings Admin",
            password_hash="not-a-real-password-hash",
            role="Admin",
        )
        self.db.add(self.admin)
        self.db.flush()
        self.admin_session = AdminSession(
            admin_id=self.admin.id,
            session_token="security-settings-session",
            is_active=True,
        )
        self.db.add(self.admin_session)
        self.db.commit()

        self.app = FastAPI()
        self.app.include_router(main_module.app.router)
        self.app.dependency_overrides[get_db] = lambda: self.db
        self.client = TestClient(self.app)
        self.auth_patch = patch.object(
            main_module,
            "_admin_for_session",
            return_value=(self.admin, self.admin_session),
        )
        self.auth_patch.start()

    def tearDown(self):
        self.auth_patch.stop()
        self.client.close()
        self.db.close()

    def save_security(self, admin_2fa):
        return self.client.put(
            "/api/admin/settings",
            headers={"Authorization": "Bearer test-admin-session"},
            json={
                "security": {
                    "requireStudentVerification": True,
                    "admin2FA": admin_2fa,
                    "maxLoginAttempts": 5,
                    "sessionTimeout": 30,
                    "minPasswordLength": 8,
                    "auditLogging": True,
                },
            },
        )

    def test_security_two_factor_setting_saves_to_database_and_reloads_from_database(self):
        self.admin.two_factor_enabled = True
        self.admin.two_factor_secret = main_module._encrypt_totp_secret("JBSWY3DPEHPK3PXP")
        self.db.commit()

        saved = self.save_security(False)

        self.assertEqual(saved.status_code, 200, saved.text)
        self.assertFalse(saved.json()["settings"]["security"]["admin2FA"])
        stored = self.db.query(SystemSetting).filter_by(key="security").one()
        self.assertFalse(json.loads(stored.value)["admin2FA"])

        reloaded = self.client.get("/api/admin/settings")

        self.assertEqual(reloaded.status_code, 200, reloaded.text)
        self.assertFalse(reloaded.json()["security"]["admin2FA"])

    def test_enabling_two_factor_policy_requires_current_admin_authenticator(self):
        stored = SystemSetting(
            key="security",
            value=json.dumps({
                "requireStudentVerification": True,
                "admin2FA": False,
                "maxLoginAttempts": 5,
                "sessionTimeout": 30,
                "minPasswordLength": 8,
                "auditLogging": True,
            }),
        )
        self.db.add(stored)
        self.db.commit()

        rejected = self.save_security(True)

        self.assertEqual(rejected.status_code, 400)
        self.assertEqual(
            rejected.json()["detail"],
            "Set up your own authenticator before enabling this",
        )

        self.admin.two_factor_enabled = True
        self.admin.two_factor_secret = main_module._encrypt_totp_secret("JBSWY3DPEHPK3PXP")
        self.db.commit()
        accepted = self.save_security(True)

        self.assertEqual(accepted.status_code, 200, accepted.text)
        self.assertTrue(accepted.json()["settings"]["security"]["admin2FA"])
        reloaded = self.client.get("/api/admin/settings")
        self.assertTrue(reloaded.json()["security"]["admin2FA"])


if __name__ == "__main__":
    unittest.main()
