import os
import unittest
from contextlib import redirect_stdout
from io import StringIO
from unittest.mock import patch

os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from app import admin_bootstrap
from app.database import Base
from app.models import Admin, SystemSetting
from app.password_security import verify_password
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool


class AdminBootstrapTests(unittest.TestCase):
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
        self.session_patch = patch.object(admin_bootstrap, "SessionLocal", self.session_factory)
        self.session_patch.start()

    def tearDown(self):
        self.session_patch.stop()

    def set_admin_environment(self, **overrides):
        values = {
            "ADMIN_USERNAME": "bootstrap-admin",
            "ADMIN_EMAIL": "bootstrap-admin@example.test",
            "ADMIN_INITIAL_PASSWORD": "SecureInitialPassword9",
            "DISABLE_ADMIN_2FA": "false",
        }
        values.update(overrides)
        return patch.dict(os.environ, values, clear=False)

    def get_admin(self):
        with self.session_factory() as db:
            return db.query(Admin).filter(Admin.username == "bootstrap-admin").first()

    def test_creates_admin_when_missing(self):
        with self.set_admin_environment():
            admin_bootstrap.create_admin_if_missing()

        admin = self.get_admin()
        self.assertIsNotNone(admin)
        self.assertEqual(admin.email, "bootstrap-admin@example.test")
        self.assertEqual(admin.role, "Admin")
        self.assertEqual(admin.status, "Active")
        self.assertNotEqual(admin.password_hash, "SecureInitialPassword9")
        self.assertTrue(verify_password("SecureInitialPassword9", admin.password_hash))

    def test_existing_admin_is_unchanged_and_second_run_is_idempotent(self):
        with self.session_factory() as db:
            db.add(Admin(
                username="bootstrap-admin",
                email="bootstrap-admin@example.test",
                full_name="Existing Admin",
                password_hash="existing-hash",
                role="Admin",
                status="Active",
                two_factor_enabled=True,
                two_factor_secret="test-secret",
            ))
            db.commit()

        with self.set_admin_environment(), redirect_stdout(StringIO()):
            admin_bootstrap.create_admin_if_missing()
            admin_bootstrap.create_admin_if_missing()

        admin = self.get_admin()
        self.assertEqual(admin.password_hash, "existing-hash")
        self.assertEqual(admin.full_name, "Existing Admin")
        self.assertTrue(admin.two_factor_enabled)
        self.assertEqual(admin.two_factor_secret, "test-secret")
        with self.session_factory() as db:
            self.assertEqual(db.query(Admin).count(), 1)

    def test_explicit_two_factor_recovery_prints_warning(self):
        with self.session_factory() as db:
            db.add(Admin(
                username="bootstrap-admin",
                email="bootstrap-admin@example.test",
                password_hash="existing-hash",
                role="Admin",
                status="Active",
                two_factor_enabled=True,
            ))
            db.commit()

        output = StringIO()
        with self.set_admin_environment(DISABLE_ADMIN_2FA="true"), redirect_stdout(output):
            admin_bootstrap.create_admin_if_missing()

        self.assertFalse(self.get_admin().two_factor_enabled)
        self.assertIn("WARNING: DISABLE_ADMIN_2FA=true", output.getvalue())

    def test_generated_password_is_printed_once_and_only_its_hash_is_stored(self):
        generated_password = "generated-password-for-test"
        output = StringIO()
        with self.set_admin_environment(), redirect_stdout(output):
            os.environ.pop("ADMIN_INITIAL_PASSWORD", None)
            with patch.object(admin_bootstrap.secrets, "token_urlsafe", return_value=generated_password) as generate:
                admin_bootstrap.create_admin_if_missing()

        admin = self.get_admin()
        self.assertEqual(generate.call_args.args, (16,))
        self.assertNotEqual(admin.password_hash, generated_password)
        self.assertTrue(verify_password(generated_password, admin.password_hash))
        self.assertEqual(output.getvalue().count(generated_password), 1)

    def test_rejects_password_shorter_than_configured_minimum(self):
        with self.session_factory() as db:
            db.add(SystemSetting(key="security", value='{"minPasswordLength": 12}'))
            db.commit()

        with self.set_admin_environment(ADMIN_INITIAL_PASSWORD="short"):
            with self.assertRaisesRegex(ValueError, "at least 12 characters"):
                admin_bootstrap.create_admin_if_missing()

        self.assertIsNone(self.get_admin())


if __name__ == "__main__":
    unittest.main()