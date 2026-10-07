import json
import os
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

os.environ["DATABASE_URL"] = "sqlite:///:memory:"

import pyotp
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import main as main_module
from app.database import Base, get_db
from app.models import Admin, AdminBackupCode, AdminLoginChallenge, AdminLoginEmailCode, AdminLoginHistory, AdminSession, AuditLog, SystemSetting


class AdminLoginTwoFactorTests(unittest.TestCase):
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
            username="login-2fa-admin",
            email="login-2fa@example.test",
            full_name="Login 2FA Admin",
            password_hash="hashed-test-password",
            role="Admin",
            status="Active",
        )
        self.db.add(self.admin)
        self.db.add(SystemSetting(
            key="security",
            value=json.dumps({
                "requireStudentVerification": True,
                "admin2FA": True,
                "maxLoginAttempts": 5,
                "sessionTimeout": 30,
                "minPasswordLength": 8,
                "auditLogging": True,
            }),
        ))
        self.db.commit()

        self.app = FastAPI()
        self.app.include_router(main_module.app.router)
        self.app.dependency_overrides[get_db] = lambda: self.db
        self.client = TestClient(self.app)
        self.env_patch = patch.dict(
            os.environ,
            {"SESSION_SECRET": "test-admin-login-2fa-secret", "ADMIN_2FA_BYPASS": "false"},
        )
        self.env_patch.start()
        self.password_patch = patch.object(main_module, "verify_password", return_value=True)
        self.password_patch.start()

    def tearDown(self):
        self.password_patch.stop()
        self.env_patch.stop()
        self.client.close()
        self.db.close()

    def login(self):
        return self.client.post(
            "/api/login",
            json={"id_or_email": self.admin.email, "password": "ValidPassword!23"},
        )

    def configure_authenticator(self):
        secret = "JBSWY3DPEHPK3PXP"
        self.admin.two_factor_enabled = True
        self.admin.two_factor_secret = main_module._encrypt_totp_secret(secret)
        self.db.commit()
        return secret

    def test_required_policy_returns_short_lived_challenge_without_session_or_login_history(self):
        with patch.object(main_module, "DISABLE_ADMIN_2FA", False):
            response = self.login()

        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertTrue(payload["requires_2fa_setup"])
        self.assertFalse(payload["requires_2fa"])
        self.assertEqual(self.db.query(AdminSession).count(), 0)
        self.assertEqual(self.db.query(AdminLoginHistory).count(), 0)
        challenge = self.db.query(AdminLoginChallenge).one()
        claims = main_module._decode_admin_login_challenge(payload["challenge_token"])
        self.assertLessEqual(
            claims["exp"] - int(datetime.now(timezone.utc).timestamp()),
            300,
        )
        self.assertLessEqual(
            (challenge.expires_at - datetime.now(timezone.utc).replace(tzinfo=None)).total_seconds(),
            300,
        )

    def test_totp_challenge_creates_session_only_after_success_and_audits_result(self):
        secret = self.configure_authenticator()
        password_step = self.login()
        challenge_token = password_step.json()["challenge_token"]

        valid = self.client.post(
            "/api/admin/login/2fa",
            json={"challenge_token": challenge_token, "code": pyotp.TOTP(secret).now()},
        )

        self.assertEqual(valid.status_code, 200, valid.text)
        self.assertTrue(valid.json()["access_token"])
        self.assertEqual(valid.json()["remaining_backup_codes"], 0)
        self.assertEqual(self.db.query(AdminSession).count(), 1)
        self.assertEqual(self.db.query(AdminLoginHistory).count(), 1)
        self.assertEqual(
            self.db.query(AuditLog).filter_by(action="Admin 2FA Login Succeeded").count(),
            1,
        )

    def test_personal_authenticator_also_uses_signed_login_challenge(self):
        self.configure_authenticator()
        self.db.query(SystemSetting).filter_by(key="security").update({
            "value": json.dumps({"admin2FA": False}),
        })
        self.db.commit()

        with patch.object(main_module, "DISABLE_ADMIN_2FA", False):
            response = self.login()

        self.assertEqual(response.status_code, 200, response.text)
        self.assertTrue(response.json()["requires_2fa"])
        self.assertFalse(response.json()["requires_2fa_setup"])
        self.assertTrue(response.json()["challenge_token"])
        self.assertEqual(self.db.query(AdminSession).count(), 0)

    def test_backup_code_is_hashed_single_use_and_remaining_count_is_accurate(self):
        self.configure_authenticator()
        backup_code = "ABCD1234EF"
        self.db.add(AdminBackupCode(
            admin_id=self.admin.id,
            code_hash=main_module._hash_admin_backup_code(backup_code),
            used=False,
        ))
        self.db.commit()
        challenge_token = self.login().json()["challenge_token"]

        accepted = self.client.post(
            "/api/admin/login/2fa",
            json={"challenge_token": challenge_token, "method": "backup", "backup_code": backup_code},
        )

        self.assertEqual(accepted.status_code, 200, accepted.text)
        self.assertEqual(accepted.json()["remaining_backup_codes"], 0)
        stored_code = self.db.query(AdminBackupCode).one()
        self.assertTrue(stored_code.used)
        self.assertNotIn(backup_code, stored_code.code_hash)

        next_challenge = self.login().json()["challenge_token"]
        reused = self.client.post(
            "/api/admin/login/2fa",
            json={"challenge_token": next_challenge, "method": "backup", "backup_code": backup_code},
        )
        self.assertEqual(reused.status_code, 400)
        self.assertEqual(self.db.query(AdminSession).count(), 1)

    def test_legacy_admin_otp_endpoint_cannot_bypass_required_challenge(self):
        secret = self.configure_authenticator()

        for system_policy in (True, False):
            self.db.query(SystemSetting).filter_by(key="security").update({
                "value": json.dumps({"admin2FA": system_policy}),
            })
            self.db.commit()
            rejected = self.client.post(
                "/api/login/verify-otp",
                json={"email": self.admin.email, "otp_code": pyotp.TOTP(secret).now()},
            )

            self.assertEqual(rejected.status_code, 400)
        self.assertEqual(self.db.query(AdminSession).count(), 0)
        self.assertEqual(self.db.query(AdminLoginHistory).count(), 0)
        self.assertEqual(
            self.db.query(AuditLog).filter_by(
                action="Admin 2FA Login Failed",
                status="FAILURE",
            ).count(),
            2,
        )

    def test_fifth_failed_attempt_invalidates_challenge_and_audits_each_failure(self):
        self.configure_authenticator()
        challenge_token = self.login().json()["challenge_token"]

        statuses = [
            self.client.post(
                "/api/admin/login/2fa",
                json={"challenge_token": challenge_token, "code": "000000"},
            ).status_code
            for _ in range(5)
        ]

        self.assertEqual(statuses, [400, 400, 400, 400, 429])
        self.assertEqual(self.db.query(AdminSession).count(), 0)
        self.assertEqual(self.db.query(AdminLoginHistory).count(), 0)
        self.assertEqual(
            self.db.query(AuditLog).filter_by(
                action="Admin 2FA Login Failed",
                status="FAILURE",
            ).count(),
            5,
        )
        self.assertTrue(self.db.query(AdminLoginChallenge).one().used)

    def test_setup_displays_hashed_backup_codes_before_session_is_created(self):
        challenge_token = self.login().json()["challenge_token"]
        setup = self.client.post(
            "/api/admin/login/2fa/setup",
            json={"challenge_token": challenge_token},
        )
        self.assertEqual(setup.status_code, 200, setup.text)
        pending_secret = main_module._decrypt_totp_secret(self.admin.two_factor_pending_secret)

        verification = self.client.post(
            "/api/admin/login/2fa/setup/verify",
            json={
                "challenge_token": challenge_token,
                "code": pyotp.TOTP(pending_secret).now(),
            },
        )

        self.assertEqual(verification.status_code, 200, verification.text)
        backup_codes = verification.json()["backup_codes"]
        self.assertEqual(len(backup_codes), 8)
        self.assertEqual(verification.json()["remaining_backup_codes"], 8)
        self.assertTrue(self.admin.two_factor_enabled)
        self.assertEqual(self.db.query(AdminSession).count(), 0)
        self.assertEqual(self.db.query(AdminLoginHistory).count(), 0)
        stored_records = self.db.query(AdminBackupCode).all()
        self.assertEqual(len(stored_records), 8)
        self.assertTrue(all(code not in record.code_hash for code, record in zip(backup_codes, stored_records)))
        self.assertTrue(all("$" in record.code_hash for record in stored_records))

        completed = self.client.post(
            "/api/admin/login/2fa/setup/complete",
            json={"challenge_token": challenge_token},
        )
        self.assertEqual(completed.status_code, 200, completed.text)
        self.assertEqual(self.db.query(AdminSession).count(), 1)
        self.assertEqual(self.db.query(AdminLoginHistory).count(), 1)

    def test_policy_is_read_from_database_on_each_password_login(self):
        self.db.query(SystemSetting).filter_by(key="security").update({
            "value": json.dumps({"admin2FA": False}),
        })
        self.db.commit()
        first_login = self.login()
        self.assertIn("access_token", first_login.json())

        self.db.query(SystemSetting).filter_by(key="security").update({
            "value": json.dumps({"admin2FA": True}),
        })
        self.db.commit()
        next_login = self.login()

        self.assertTrue(next_login.json()["requires_2fa_setup"])
        self.assertEqual(self.db.query(AdminSession).count(), 1)

    def test_emergency_bypass_only_allows_the_sole_active_admin(self):
        with patch.dict(os.environ, {"ADMIN_2FA_BYPASS": "true"}):
            response = self.login()
        self.assertIn("access_token", response.json())
        self.assertEqual(
            self.db.query(AuditLog).filter_by(action="Admin 2FA Emergency Bypass").count(),
            1,
        )

        self.db.add(Admin(
            username="second-admin",
            email="second-admin@example.test",
            password_hash="another-hash",
            role="Admin",
            status="Active",
        ))
        self.db.commit()
        self.db.query(AdminSession).delete()
        self.db.commit()
        with patch.dict(os.environ, {"ADMIN_2FA_BYPASS": "true"}):
            blocked_bypass = self.login()
        self.assertTrue(blocked_bypass.json()["requires_2fa_setup"])

    def test_email_code_is_hashed_sent_masked_and_single_use(self):
        self.configure_authenticator()
        challenge_token = self.login().json()["challenge_token"]
        sent_codes = []

        def mock_send_email(email, code):
            sent_codes.append((email, code))
            return True

        with patch.dict(os.environ, {"SENDER_EMAIL": "sender@example.test", "SENDER_PASSWORD": "app-password"}), \
             patch.object(main_module, "send_otp_email", side_effect=mock_send_email):
            sent = self.client.post(
                "/api/admin/login/2fa/email-code",
                json={"challenge_token": challenge_token},
            )

        self.assertEqual(sent.status_code, 200, sent.text)
        payload = sent.json()
        self.assertEqual(payload["masked_email"], "l***@example.test")
        self.assertEqual(payload["resend_after_seconds"], 60)
        self.assertNotIn(sent_codes[0][1], sent.text)
        code_record = self.db.query(AdminLoginEmailCode).one()
        self.assertNotIn(sent_codes[0][1], code_record.code_hash)
        self.assertTrue(code_record.used is False)
        self.assertLessEqual(
            (code_record.expires_at - datetime.now(timezone.utc).replace(tzinfo=None)).total_seconds(),
            600,
        )
        self.assertEqual(
            self.db.query(AuditLog).filter_by(action="Admin 2FA Email Code Sent").count(),
            1,
        )

        verified = self.client.post(
            "/api/admin/login/2fa",
            json={
                "challenge_token": challenge_token,
                "method": "email",
                "code": sent_codes[0][1],
            },
        )
        self.assertEqual(verified.status_code, 200, verified.text)
        self.assertTrue(self.db.query(AdminLoginEmailCode).one().used)
        self.assertEqual(self.db.query(AdminSession).count(), 1)

    def test_email_code_attempts_are_single_use_expiring_and_limited(self):
        self.configure_authenticator()
        challenge_token = self.login().json()["challenge_token"]
        sent_codes = []
        with patch.dict(os.environ, {"SENDER_EMAIL": "sender@example.test", "SENDER_PASSWORD": "app-password"}), \
             patch.object(main_module, "send_otp_email", side_effect=lambda _email, code: sent_codes.append(code) or True):
            self.client.post(
                "/api/admin/login/2fa/email-code",
                json={"challenge_token": challenge_token},
            )

        code_record = self.db.query(AdminLoginEmailCode).one()
        code_record.expires_at = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(seconds=1)
        self.db.commit()
        expired = self.client.post(
            "/api/admin/login/2fa",
            json={"challenge_token": challenge_token, "method": "email", "code": sent_codes[0]},
        )
        self.assertEqual(expired.status_code, 400)
        self.assertEqual(self.db.query(AdminSession).count(), 0)
        self.assertEqual(
            self.db.query(AuditLog).filter_by(action="Admin 2FA Email Code Failed").count(),
            1,
        )

        code_record.sent_at = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(seconds=61)
        self.db.commit()
        new_challenge = self.login().json()["challenge_token"]
        with patch.dict(os.environ, {"SENDER_EMAIL": "sender@example.test", "SENDER_PASSWORD": "app-password"}), \
             patch.object(main_module, "send_otp_email", return_value=True):
            first_send = self.client.post(
                "/api/admin/login/2fa/email-code",
                json={"challenge_token": new_challenge},
            )
            too_soon = self.client.post(
                "/api/admin/login/2fa/email-code",
                json={"challenge_token": new_challenge},
            )
        self.assertEqual(first_send.status_code, 200)
        self.assertEqual(too_soon.status_code, 429)
        self.assertEqual(too_soon.headers["Retry-After"], "60")

    def test_email_code_has_a_five_attempt_limit_and_five_per_hour_send_limit(self):
        self.configure_authenticator()
        challenge_token = self.login().json()["challenge_token"]
        with patch.dict(os.environ, {"SENDER_EMAIL": "sender@example.test", "SENDER_PASSWORD": "app-password"}), \
             patch.object(main_module, "send_otp_email", return_value=True):
            sent = self.client.post(
                "/api/admin/login/2fa/email-code",
                json={"challenge_token": challenge_token},
            )
            self.assertEqual(sent.status_code, 200)
            for _ in range(4):
                code_record = self.db.query(AdminLoginEmailCode).filter_by(used=False).one()
                code_record.sent_at = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(seconds=61)
                self.db.commit()
                response = self.client.post(
                    "/api/admin/login/2fa/email-code",
                    json={"challenge_token": challenge_token},
                )
                self.assertEqual(response.status_code, 200, response.text)

            code_record = self.db.query(AdminLoginEmailCode).filter_by(used=False).one()
            code_record.sent_at = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(seconds=61)
            self.db.commit()
            hourly_limit = self.client.post(
                "/api/admin/login/2fa/email-code",
                json={"challenge_token": challenge_token},
            )
        self.assertEqual(hourly_limit.status_code, 429)
        self.assertIn("limit", hourly_limit.json()["detail"])

        self.db.query(AdminLoginEmailCode).filter_by(used=False).update(
            {"sent_at": datetime.now(timezone.utc).replace(tzinfo=None)},
            synchronize_session=False,
        )
        self.db.commit()
        code_record = self.db.query(AdminLoginEmailCode).filter_by(used=False).order_by(
            AdminLoginEmailCode.sent_at.desc()
        ).first()
        self.assertIsNotNone(code_record)
        for attempt in range(5):
            response = self.client.post(
                "/api/admin/login/2fa",
                json={"challenge_token": challenge_token, "method": "email", "code": "000000"},
            )
            self.assertEqual(response.status_code, 429 if attempt == 4 else 400)
        self.assertEqual(code_record.failed_attempts, 5)
        self.assertTrue(code_record.used)

    def test_email_code_endpoint_reports_missing_smtp_without_sending_or_returning_a_code(self):
        self.configure_authenticator()
        challenge_token = self.login().json()["challenge_token"]
        with patch.dict(os.environ, {"SENDER_EMAIL": "", "SENDER_PASSWORD": ""}), \
             patch.object(main_module, "send_otp_email") as send_email:
            response = self.client.post(
                "/api/admin/login/2fa/email-code",
                json={"challenge_token": challenge_token},
            )
        self.assertEqual(response.status_code, 503)
        self.assertIn("not configured", response.json()["detail"])
        send_email.assert_not_called()
        self.assertEqual(self.db.query(AdminLoginEmailCode).count(), 0)
        self.assertEqual(
            self.db.query(AuditLog).filter_by(action="Admin 2FA Email Code Failed").count(),
            1,
        )

    def test_backup_code_regeneration_requires_current_password_and_stores_hashes(self):
        self.configure_authenticator()
        session_token = main_module._create_session_token(
            self.admin.username,
            "admin",
            30,
            main_module._get_session_secret(),
        )
        self.db.add(AdminSession(
            admin_id=self.admin.id,
            session_token=session_token,
            is_active=True,
        ))
        self.db.commit()

        denied = self.client.post(
            "/api/admin/2fa/backup-codes",
            json={"session_token": session_token, "otp_code": "123456"},
        )
        self.assertEqual(denied.status_code, 403)

        regenerated = self.client.post(
            "/api/admin/2fa/backup-codes",
            json={"session_token": session_token, "current_password": "ValidPassword!23"},
        )
        self.assertEqual(regenerated.status_code, 200, regenerated.text)
        codes = regenerated.json()["backup_codes"]
        records = self.db.query(AdminBackupCode).filter_by(admin_id=self.admin.id, used=False).all()
        self.assertEqual(len(codes), 8)
        self.assertEqual(len(records), 8)
        self.assertTrue(all("$" in record.code_hash for record in records))
        self.assertTrue(all(
            code not in record.code_hash
            for code in codes
            for record in records
        ))


if __name__ == "__main__":
    unittest.main()
