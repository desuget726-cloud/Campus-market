import os
import unittest
from unittest.mock import patch

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["PYTHON_DOTENV_DISABLED"] = "true"

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import main as main_module
from app.database import Base, get_db
from app.models import Admin


class AdminSubAdminFeatureTests(unittest.TestCase):
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
            username="sole-admin",
            email="sole-admin@example.test",
            password_hash="admin-password-hash",
            role="admin",
            status="Active",
        )
        self.active_sub_admin = Admin(
            username="active-sub-admin",
            email="active-sub-admin@example.test",
            password_hash="active-password-hash",
            role="sub_admin",
            status="Active",
        )
        self.inactive_sub_admin = Admin(
            username="inactive-sub-admin",
            email="inactive-sub-admin@example.test",
            password_hash="inactive-password-hash",
            role="sub_admin",
            status="Inactive",
        )
        self.db.add_all([self.admin, self.active_sub_admin, self.inactive_sub_admin])
        self.db.commit()

        self.app = FastAPI()
        self.app.include_router(main_module.app.router)
        self.app.dependency_overrides[get_db] = lambda: self.db
        self.client = TestClient(self.app)
        self.admin_auth_patch = patch.object(main_module, "_require_admin", return_value=self.admin)
        self.admin_auth_patch.start()
        self.current_admin_patch = patch.object(
            main_module,
            "_admin_for_session",
            return_value=(self.admin, object()),
        )
        self.current_admin_patch.start()
        self.enabled_patch = patch.object(main_module, "ADMIN_SUB_ADMINS_ENABLED", False)
        self.enabled_patch.start()

    def tearDown(self):
        self.enabled_patch.stop()
        self.current_admin_patch.stop()
        self.admin_auth_patch.stop()
        self.client.close()
        self.db.close()

    def test_disabled_feature_blocks_mutations_without_changing_existing_rows(self):
        cases = (
            ("post", "/api/admin/sub-admins", {
                "username": "new-sub-admin",
                "email": "new-sub-admin@example.test",
                "password": "a-long-test-password",
            }),
            ("patch", f"/api/admin/sub-admins/{self.active_sub_admin.id}/status", {"status": "Inactive"}),
            ("patch", f"/api/admin/sub-admins/{self.inactive_sub_admin.id}/status", {"status": "Active"}),
            ("delete", f"/api/admin/sub-admins/{self.inactive_sub_admin.id}", None),
        )

        for method, path, body in cases:
            with self.subTest(method=method, path=path):
                response = self.client.request(
                    method.upper(),
                    path,
                    headers={"Authorization": "Bearer test-admin-session"},
                    json=body,
                )
                self.assertEqual(response.status_code, 403)
                self.assertEqual(response.json()["detail"]["code"], "FEATURE_DISABLED")

        self.db.expire_all()
        self.assertEqual(
            self.db.query(Admin).filter(Admin.role == "sub_admin").count(),
            2,
        )
        self.assertEqual(
            self.db.query(Admin).filter(Admin.id == self.active_sub_admin.id).one().status,
            "Active",
        )
        self.assertEqual(
            self.db.query(Admin).filter(Admin.id == self.inactive_sub_admin.id).one().status,
            "Inactive",
        )

    def test_disabled_feature_keeps_admin_only_read_endpoints_safe(self):
        accounts = self.client.get(
            "/api/admin/sub-admins",
            headers={"Authorization": "Bearer test-admin-session"},
        )
        profile = self.client.get(
            "/api/admin/me",
            headers={"Authorization": "Bearer test-admin-session"},
        )

        self.assertEqual(accounts.status_code, 200, accounts.text)
        self.assertEqual(profile.status_code, 200, profile.text)
        self.assertFalse(profile.json()["admin_sub_admins_enabled"])
        self.assertEqual(len(accounts.json()["sub_admins"]), 2)
        for sub_admin in accounts.json()["sub_admins"]:
            self.assertNotIn("password_hash", sub_admin)
            self.assertNotIn("token", sub_admin)
            self.assertNotIn("session_token", sub_admin)
        self.assertNotIn("password_hash", profile.json())
        self.assertNotIn("token", profile.json())
        self.assertNotIn("session_token", profile.json())

    def test_sub_admin_read_endpoints_still_require_admin_authentication(self):
        self.admin_auth_patch.stop()
        try:
            accounts = self.client.get("/api/admin/sub-admins")
            profile = self.client.get("/api/admin/me")
        finally:
            self.admin_auth_patch.start()

        self.assertEqual(accounts.status_code, 401)
        self.assertEqual(profile.status_code, 401)

    def test_enabled_feature_preserves_create_status_and_delete_behavior(self):
        with patch.object(main_module, "ADMIN_SUB_ADMINS_ENABLED", True):
            created = self.client.post(
                "/api/admin/sub-admins",
                headers={"Authorization": "Bearer test-admin-session"},
                json={
                    "username": "new-sub-admin",
                    "email": "new-sub-admin@example.test",
                    "password": "a-long-test-password",
                },
            )
            self.assertEqual(created.status_code, 201, created.text)
            admin_id = created.json()["sub_admin"]["id"]

            deactivated = self.client.patch(
                f"/api/admin/sub-admins/{admin_id}/status",
                headers={"Authorization": "Bearer test-admin-session"},
                json={"status": "Inactive"},
            )
            self.assertEqual(deactivated.status_code, 200, deactivated.text)
            self.assertEqual(deactivated.json()["status"], "Inactive")

            activated = self.client.patch(
                f"/api/admin/sub-admins/{admin_id}/status",
                headers={"Authorization": "Bearer test-admin-session"},
                json={"status": "Active"},
            )
            self.assertEqual(activated.status_code, 200, activated.text)
            self.assertEqual(activated.json()["status"], "Active")

            deleted = self.client.delete(
                f"/api/admin/sub-admins/{admin_id}",
                headers={"Authorization": "Bearer test-admin-session"},
            )
            self.assertEqual(deleted.status_code, 200, deleted.text)
            self.assertIsNone(self.db.get(Admin, admin_id))

            profile = self.client.get(
                "/api/admin/me",
                headers={"Authorization": "Bearer test-admin-session"},
            )
            self.assertTrue(profile.json()["admin_sub_admins_enabled"])


if __name__ == "__main__":
    unittest.main()
