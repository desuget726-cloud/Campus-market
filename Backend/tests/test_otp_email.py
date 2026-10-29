import os
import socket
import unittest
from contextlib import redirect_stdout
from datetime import datetime, timedelta, timezone
from io import StringIO
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from fastapi import BackgroundTasks, HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import database as database_module
from app import main as main_module
from app.models import AuditLog, PasswordReset, PasswordResetRequest, Student, SystemSetting
from app.password_security import verify_password


class OtpEmailTests(unittest.TestCase):
    def setUp(self):
        self.environment = patch.dict(
            os.environ,
            {
                "ENV": "",
                "ENVIRONMENT": "",
                "APP_ENV": "",
                "RENDER": "",
                "RENDER_SERVICE_ID": "",
                "EMAIL_DEV_LOG_OTP": "",
                "SMTP_HOST": "",
                "SMTP_PORT": "",
                "SMTP_SECURITY": "",
                "SMTP_USER": "sender@example.test",
                "SMTP_PASSWORD": " ' test app password ' ",
                "SENDER_EMAIL": "",
                "SENDER_PASSWORD": "",
            },
        )
        self.environment.start()
        self.addCleanup(self.environment.stop)

    def _create_password_reset_db(self, include_student=False):
        engine = create_engine("sqlite:///:memory:")
        PasswordReset.__table__.create(engine)
        PasswordResetRequest.__table__.create(engine)
        AuditLog.__table__.create(engine)
        SystemSetting.__table__.create(engine)
        if include_student:
            Student.__table__.create(engine)
        db = sessionmaker(bind=engine, expire_on_commit=False)()
        self.addCleanup(engine.dispose)
        self.addCleanup(db.close)
        return db

    def _request_password_reset(self, db, identifier, ip="198.51.100.2"):
        request = SimpleNamespace(
            client=SimpleNamespace(host=ip),
            headers={},
        )
        tasks = BackgroundTasks()
        response = main_module.forgot_password(
            main_module.ForgotPasswordRequest(id_or_email=identifier),
            request,
            tasks,
            db,
        )
        return response, tasks

    def test_mysql_password_reset_expiry_migration_removes_auto_update(self):
        engine = MagicMock()
        engine.dialect.name = "mysql"
        engine.connect.return_value.__enter__.return_value.execute.return_value.mappings.return_value.first.return_value = {
            "data_type": "datetime",
            "datetime_precision": None,
            "extra": "on update CURRENT_TIMESTAMP",
        }

        with patch.object(database_module, "engine", engine):
            database_module._migrate_password_reset_expiry_column()

        migration_statement = engine.begin.return_value.__enter__.return_value.execute.call_args.args[0]
        self.assertIn(
            "ALTER TABLE password_resets MODIFY COLUMN expires_at DATETIME NOT NULL",
            str(migration_statement),
        )
        self.assertIsNone(PasswordReset.__table__.c.expires_at.onupdate)

    def test_localhost_forgot_password_ignores_shared_ip_bucket(self):
        db = self._create_password_reset_db(include_student=True)
        db.add(
            Student(
                name="Student",
                student_id="STU-1",
                email="new-account@example.test",
                password=main_module.hash_password("InitialPassword1"),
            )
        )
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        db.add_all(
            PasswordResetRequest(
                account_key=f"other-{index}@example.test",
                request_ip="127.0.0.1",
                requested_at=now - timedelta(minutes=2),
                delivery_status="failed",
            )
            for index in range(main_module.PASSWORD_RESET_SEND_LIMIT)
        )
        db.commit()

        with patch.object(main_module, "_generate_otp_code", return_value="123456"):
            response, tasks = self._request_password_reset(
                db,
                "new-account@example.test",
                ip="127.0.0.1",
            )

        self.assertIn("verification code will be sent", response["message"])
        self.assertEqual(len(tasks.tasks), 1)

    def test_default_port_uses_starttls_and_normalizes_password(self):
        with (
            patch.object(main_module, "_notifications_enabled", return_value=True),
            patch.object(main_module, "_IPv4SMTP") as smtp,
            patch.object(main_module, "_IPv4SMTP_SSL") as smtp_ssl,
            self.assertLogs("app.email", level="INFO"),
        ):
            server = smtp.return_value.__enter__.return_value
            server.sendmail.return_value = {}
            self.assertTrue(main_module.send_otp_email("student@example.test", "123456"))

        smtp.assert_called_once_with("smtp.gmail.com", 587, timeout=15)
        smtp_ssl.assert_not_called()
        self.assertEqual(server.ehlo.call_count, 2)
        self.assertIsNotNone(server.starttls.call_args.kwargs["context"])
        server.login.assert_called_once_with("sender@example.test", "testapppassword")

    def test_port_465_selects_implicit_ssl(self):
        with (
            patch.dict(os.environ, {"SMTP_PORT": "465"}),
            patch.object(main_module, "_notifications_enabled", return_value=True),
            patch.object(main_module, "_IPv4SMTP_SSL") as smtp_ssl,
            patch.object(main_module, "_IPv4SMTP") as smtp,
            self.assertLogs("app.email", level="INFO"),
        ):
            smtp_ssl.return_value.__enter__.return_value.sendmail.return_value = {}
            self.assertTrue(main_module.send_otp_email("student@example.test", "123456"))

        smtp_ssl.assert_called_once()
        self.assertEqual(smtp_ssl.call_args.args[:2], ("smtp.gmail.com", 465))
        self.assertEqual(smtp_ssl.call_args.kwargs["timeout"], 15)
        smtp.assert_not_called()

    def test_smtp_connections_resolve_ipv4_and_keep_hostname_for_tls(self):
        resolved_address = ("192.0.2.25", 465)
        socket_info = (
            socket.AF_INET,
            socket.SOCK_STREAM,
            socket.IPPROTO_TCP,
            "",
            resolved_address,
        )
        raw_socket = MagicMock()
        tls_socket = MagicMock()
        context = MagicMock()
        context.wrap_socket.return_value = tls_socket

        with (
            patch.object(main_module.socket, "getaddrinfo", return_value=[socket_info]) as getaddrinfo,
            patch.object(main_module.socket, "create_connection", return_value=raw_socket) as create_connection,
        ):
            starttls_client = main_module._IPv4SMTP(timeout=15)
            self.assertIs(
                starttls_client._get_socket("smtp.gmail.com", 587, 15),
                raw_socket,
            )
            ssl_client = main_module._IPv4SMTP_SSL(context=context, timeout=15)
            ssl_client._host = "smtp.gmail.com"
            self.assertIs(
                ssl_client._get_socket("smtp.gmail.com", 465, 15),
                tls_socket,
            )

        self.assertEqual(getaddrinfo.call_args_list, [
            unittest.mock.call("smtp.gmail.com", 587, socket.AF_INET, socket.SOCK_STREAM),
            unittest.mock.call("smtp.gmail.com", 465, socket.AF_INET, socket.SOCK_STREAM),
        ])
        self.assertEqual(create_connection.call_args_list, [
            unittest.mock.call(resolved_address, 15, None),
            unittest.mock.call(resolved_address, 15, None),
        ])
        context.wrap_socket.assert_called_once_with(
            raw_socket,
            server_hostname="smtp.gmail.com",
        )

    def test_connection_reset_falls_back_to_ssl_once(self):
        with (
            patch.object(main_module, "_notifications_enabled", return_value=True),
            patch.object(
                main_module,
                "_IPv4SMTP",
                side_effect=main_module.smtplib.SMTPServerDisconnected("connection reset"),
            ) as starttls_client,
            patch.object(main_module, "_IPv4SMTP_SSL") as ssl_client,
            self.assertLogs("app.email", level="WARNING"),
        ):
            ssl_client.return_value.__enter__.return_value.sendmail.return_value = {}
            result = main_module.send_otp_email_diagnostic(
                "student@example.test",
                "123456",
            )

        self.assertTrue(result["success"])
        self.assertEqual(result["mode"], "ssl")
        self.assertEqual(result["port"], 465)
        self.assertEqual(len(result["attempts"]), 2)
        self.assertEqual(result["attempts"][0]["stage"], "connect")
        starttls_client.assert_called_once_with("smtp.gmail.com", 587, timeout=15)
        ssl_client.assert_called_once()

    def test_starttls_connection_reset_reports_stage_and_falls_back(self):
        with (
            patch.object(main_module, "_notifications_enabled", return_value=True),
            patch.object(main_module, "_IPv4SMTP") as smtp,
            patch.object(main_module, "_IPv4SMTP_SSL") as smtp_ssl,
            self.assertLogs("app.email", level="WARNING"),
        ):
            smtp.return_value.__enter__.return_value.starttls.side_effect = (
                main_module.smtplib.SMTPServerDisconnected("connection reset")
            )
            smtp_ssl.return_value.__enter__.return_value.sendmail.return_value = {}
            result = main_module.send_otp_email_diagnostic(
                "student@example.test",
                "123456",
            )

        self.assertTrue(result["success"])
        self.assertEqual(result["attempts"][0]["stage"], "starttls")
        self.assertEqual(result["attempts"][0]["mode"], "starttls")

    def test_auth_failure_logs_traceback_and_never_logs_password_or_otp(self):
        with (
            patch.object(main_module, "_notifications_enabled", return_value=True),
            patch.object(main_module, "_IPv4SMTP") as smtp,
            patch.object(main_module, "_IPv4SMTP_SSL") as smtp_ssl,
            self.assertLogs("app.email", level="ERROR") as logs,
            redirect_stdout(StringIO()) as output,
        ):
            smtp.return_value.__enter__.return_value.login.side_effect = (
                main_module.smtplib.SMTPAuthenticationError(
                    535,
                    b"secret SMTP response",
                )
            )
            self.assertFalse(main_module.send_otp_email("student@example.test", "123456"))

        smtp_ssl.assert_not_called()
        combined_logs = "\n".join(logs.output) + output.getvalue()
        self.assertIn("stage=login", combined_logs)
        self.assertIn("Gmail requires an App Password (2-Step Verification)", combined_logs)
        self.assertIn("Failed to send OTP email", combined_logs)
        self.assertIn("Traceback (most recent call last)", combined_logs)
        self.assertIn("secret SMTP response", combined_logs)
        self.assertIn("sender=sender@example.test", combined_logs)
        self.assertIn("receiver=student@example.test", combined_logs)
        self.assertIn("Connecting to smtp.gmail.com:587", output.getvalue())
        self.assertNotIn("testapppassword", combined_logs)
        self.assertNotIn("123456", combined_logs)

    def test_password_recovery_email_ignores_optional_email_notification_setting(self):
        with (
            patch.object(main_module, "_notifications_enabled", return_value=False) as setting,
            patch.object(main_module, "_IPv4SMTP") as smtp,
            patch.object(main_module, "_IPv4SMTP_SSL") as smtp_ssl,
            self.assertLogs("app.email", level="INFO"),
        ):
            smtp.return_value.__enter__.return_value.sendmail.return_value = {}
            result = main_module.send_otp_email_diagnostic(
                "student@example.test",
                "123456",
            )

        self.assertTrue(result["success"])
        setting.assert_not_called()
        smtp.assert_called_once_with("smtp.gmail.com", 587, timeout=15)
        smtp_ssl.assert_not_called()

    def test_dev_otp_logging_requires_development_flag_and_is_disabled_in_production(self):
        output = StringIO()
        with (
            patch.dict(
                os.environ,
                {"ENV": "development", "EMAIL_DEV_LOG_OTP": "true"},
            ),
            redirect_stdout(output),
        ):
            main_module._log_development_otp("123456")
        self.assertIn("[DEV ONLY]", output.getvalue())
        self.assertIn("123456", output.getvalue())

        output = StringIO()
        with (
            patch.dict(
                os.environ,
                {
                    "ENV": "production",
                    "ENVIRONMENT": "",
                    "APP_ENV": "",
                    "EMAIL_DEV_LOG_OTP": "true",
                },
            ),
            redirect_stdout(output),
        ):
            main_module._log_development_otp("123456")
        self.assertEqual(output.getvalue(), "")

    def test_cooldown_and_hourly_limits_apply_to_account_and_ip(self):
        engine = create_engine("sqlite:///:memory:")
        PasswordResetRequest.__table__.create(engine)
        db = sessionmaker(bind=engine)()
        self.addCleanup(engine.dispose)
        self.addCleanup(db.close)
        now = datetime.now(timezone.utc).replace(tzinfo=None)

        db.add(
            PasswordResetRequest(
                account_key="cooldown@example.test",
                request_ip="198.51.100.1",
                requested_at=now - timedelta(seconds=20),
                delivery_status="sent",
            )
        )
        db.commit()
        self.assertEqual(
            main_module._password_reset_rate_limit(
                db,
                "cooldown@example.test",
                "198.51.100.2",
                now,
            ),
            40,
        )

        db.query(PasswordResetRequest).delete()
        for index in range(5):
            db.add(
                PasswordResetRequest(
                    account_key="hourly@example.test",
                    request_ip=f"198.51.100.{index + 10}",
                    requested_at=now - timedelta(minutes=10, seconds=index),
                    delivery_status="sent",
                )
            )
        db.commit()
        self.assertGreater(
            main_module._password_reset_rate_limit(
                db,
                "hourly@example.test",
                "203.0.113.1",
                now,
            ),
            0,
        )

        db.query(PasswordResetRequest).delete()
        for index in range(5):
            db.add(
                PasswordResetRequest(
                    account_key=f"account-{index}@example.test",
                    request_ip="203.0.113.55",
                    requested_at=now - timedelta(minutes=10, seconds=index),
                    delivery_status="sent",
                )
            )
        db.commit()
        self.assertGreater(
            main_module._password_reset_rate_limit(
                db,
                "another-account@example.test",
                "203.0.113.55",
                now,
            ),
            0,
        )

    def test_local_development_rate_limit_is_scoped_to_account(self):
        engine = create_engine("sqlite:///:memory:")
        PasswordResetRequest.__table__.create(engine)
        db = sessionmaker(bind=engine)()
        self.addCleanup(engine.dispose)
        self.addCleanup(db.close)
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        db.add_all(
            PasswordResetRequest(
                account_key=f"account-{index}@example.test",
                request_ip="127.0.0.1",
                requested_at=now - timedelta(minutes=2),
                delivery_status="failed",
            )
            for index in range(main_module.PASSWORD_RESET_SEND_LIMIT)
        )
        db.add_all(
            PasswordResetRequest(
                account_key="account-0@example.test",
                request_ip="127.0.0.1",
                requested_at=now - timedelta(minutes=3, seconds=index),
                delivery_status="failed",
            )
            for index in range(main_module.PASSWORD_RESET_SEND_LIMIT - 1)
        )
        db.commit()

        self.assertEqual(
            main_module._password_reset_rate_limit(
                db,
                "new-account@example.test",
                "127.0.0.1",
                now,
                include_ip_limit=False,
            ),
            0,
        )
        self.assertGreater(
            main_module._password_reset_rate_limit(
                db,
                "account-0@example.test",
                "127.0.0.1",
                now,
                include_ip_limit=False,
            ),
            0,
        )

    def test_rate_limit_history_can_be_cleared_for_local_testing(self):
        engine = create_engine("sqlite:///:memory:")
        PasswordResetRequest.__table__.create(engine)
        db = sessionmaker(bind=engine)()
        self.addCleanup(engine.dispose)
        self.addCleanup(db.close)
        db.add(
            PasswordResetRequest(
                account_key="student@example.test",
                request_ip="127.0.0.1",
                requested_at=datetime.now(timezone.utc).replace(tzinfo=None),
                delivery_status="failed",
            )
        )
        db.commit()

        self.assertEqual(main_module._clear_password_reset_rate_limit_history(db), 1)
        self.assertEqual(db.query(PasswordResetRequest).count(), 0)

    def test_background_delivery_retries_three_times_and_records_failure(self):
        engine = create_engine("sqlite:///:memory:")
        PasswordReset.__table__.create(engine)
        PasswordResetRequest.__table__.create(engine)
        local_session = sessionmaker(bind=engine, expire_on_commit=False)()
        self.addCleanup(engine.dispose)
        self.addCleanup(local_session.close)
        reset = PasswordReset(
            email="student@example.test",
            otp_hash=main_module._password_reset_otp_hash("student@example.test", "123456"),
            expires_at=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(minutes=10),
            is_used=False,
            delivery_status="queued",
            created_at=datetime.now(timezone.utc).replace(tzinfo=None),
        )
        tracking = PasswordResetRequest(
            account_key="student@example.test",
            request_ip="198.51.100.2",
            requested_at=datetime.now(timezone.utc).replace(tzinfo=None),
            delivery_status="queued",
        )
        local_session.add_all([reset, tracking])
        local_session.commit()

        with (
            patch.object(main_module, "SessionLocal", return_value=local_session),
            patch.object(
                main_module,
                "send_otp_email_diagnostic",
                return_value={
                    "success": False,
                    "stage": "connect",
                    "mode": "starttls",
                },
            ) as sender,
            patch.object(main_module, "time_sleep"),
        ):
            main_module._deliver_password_reset_email(reset.id, tracking.id, "123456")

        self.assertEqual(sender.call_count, 3)
        self.assertEqual(reset.delivery_status, "failed")
        self.assertEqual(tracking.delivery_status, "failed")

    def test_background_delivery_retry_uses_reset_state_not_tracking_state(self):
        engine = create_engine("sqlite:///:memory:")
        PasswordReset.__table__.create(engine)
        PasswordResetRequest.__table__.create(engine)
        local_session = sessionmaker(bind=engine, expire_on_commit=False)()
        self.addCleanup(engine.dispose)
        self.addCleanup(local_session.close)
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        reset = PasswordReset(
            email="student@example.test",
            otp_hash=main_module._password_reset_otp_hash("student@example.test", "123456"),
            expires_at=now + timedelta(minutes=10),
            is_used=False,
            delivery_status="queued",
            created_at=now,
        )
        tracking = PasswordResetRequest(
            account_key="student@example.test",
            request_ip="198.51.100.2",
            requested_at=now,
            delivery_status="queued",
        )
        local_session.add_all([reset, tracking])
        local_session.commit()
        reset_id, tracking_id = reset.id, tracking.id

        def fail_once_then_succeed(*_args, **_kwargs):
            if sender.call_count == 1:
                tracking.delivery_status = "failed"
                local_session.commit()
                return {
                    "success": False,
                    "stage": "connect",
                    "mode": "starttls",
                }
            return {"success": True, "stage": "send", "mode": "starttls"}

        with (
            patch.object(main_module, "SessionLocal", return_value=local_session),
            patch.object(
                main_module,
                "send_otp_email_diagnostic",
                side_effect=fail_once_then_succeed,
            ) as sender,
            patch.object(main_module, "time_sleep"),
        ):
            main_module._deliver_password_reset_email(reset_id, tracking_id, "123456")

        self.assertEqual(sender.call_count, 2)
        self.assertEqual(reset.delivery_status, "sent")
        self.assertEqual(tracking.delivery_status, "sent")

    def test_background_delivery_records_success(self):
        engine = create_engine("sqlite:///:memory:")
        PasswordReset.__table__.create(engine)
        PasswordResetRequest.__table__.create(engine)
        local_session = sessionmaker(bind=engine, expire_on_commit=False)()
        self.addCleanup(engine.dispose)
        self.addCleanup(local_session.close)
        reset = PasswordReset(
            email="student@example.test",
            otp_hash=main_module._password_reset_otp_hash("student@example.test", "123456"),
            expires_at=datetime.now(timezone.utc).replace(tzinfo=None)
            + timedelta(minutes=10),
            is_used=False,
            delivery_status="sending",
            created_at=datetime.now(timezone.utc).replace(tzinfo=None),
        )
        tracking = PasswordResetRequest(
            account_key="student@example.test",
            request_ip="198.51.100.2",
            requested_at=datetime.now(timezone.utc).replace(tzinfo=None),
            delivery_status="sending",
        )
        local_session.add_all([reset, tracking])
        local_session.commit()
        reset_id, tracking_id = reset.id, tracking.id

        with (
            patch.object(main_module, "SessionLocal", return_value=local_session),
            patch.object(
                main_module,
                "send_otp_email_diagnostic",
                return_value={"success": True, "stage": "send", "mode": "starttls"},
            ) as sender,
        ):
            main_module._deliver_password_reset_email(reset_id, tracking_id, "123456")
            main_module._deliver_password_reset_email(reset_id, tracking_id, "123456")

        sender.assert_called_once_with("student@example.test", "123456")
        self.assertEqual(reset.delivery_status, "sent")
        self.assertEqual(tracking.delivery_status, "sent")

    def test_background_delivery_attempts_first_send_before_checking_expiry(self):
        engine = create_engine("sqlite:///:memory:")
        PasswordReset.__table__.create(engine)
        PasswordResetRequest.__table__.create(engine)
        local_session = sessionmaker(bind=engine, expire_on_commit=False)()
        self.addCleanup(engine.dispose)
        self.addCleanup(local_session.close)
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        reset = PasswordReset(
            email="student@example.test",
            otp_hash=main_module._password_reset_otp_hash("student@example.test", "123456"),
            expires_at=now - timedelta(minutes=1),
            is_used=False,
            delivery_status="queued",
            created_at=now - timedelta(minutes=11),
        )
        tracking = PasswordResetRequest(
            account_key="student@example.test",
            request_ip="198.51.100.2",
            requested_at=now - timedelta(minutes=11),
            delivery_status="queued",
        )
        local_session.add_all([reset, tracking])
        local_session.commit()
        reset_id, tracking_id = reset.id, tracking.id

        with (
            patch.object(main_module, "SessionLocal", return_value=local_session),
            patch.object(
                main_module,
                "send_otp_email_diagnostic",
                return_value={"success": True, "stage": "send", "mode": "starttls"},
            ) as sender,
        ):
            main_module._deliver_password_reset_email(reset_id, tracking_id, "123456")

        sender.assert_called_once_with("student@example.test", "123456")
        self.assertEqual(reset.delivery_status, "sent")
        self.assertEqual(tracking.delivery_status, "sent")

    def test_wallet_pin_reset_uses_email_otp_and_supports_google_only_accounts(self):
        db = self._create_password_reset_db(include_student=True)
        student = Student(
            name="Google Student",
            student_id="GOOGLE-1",
            email="google@example.test",
            password="oauth-only",
            has_password=False,
            is_verified=True,
            wallet_pin_hash=main_module.hash_password("1111"),
        )
        db.add(student)
        db.commit()
        background_tasks = BackgroundTasks()
        request = SimpleNamespace(
            client=SimpleNamespace(host="198.51.100.8"),
            headers={},
        )
        session_factory = sessionmaker(bind=db.get_bind(), expire_on_commit=False)

        with (
            patch.object(main_module, "_student_from_authorization", return_value=student),
            patch.object(main_module, "_require_verified_student"),
            patch.object(main_module, "_generate_otp_code", return_value="123456"),
            patch.object(main_module, "SessionLocal", side_effect=session_factory),
            patch.object(
                main_module,
                "send_otp_email_diagnostic",
                return_value={"success": True, "stage": "send", "mode": "starttls"},
            ) as sender,
        ):
            request_result = main_module.request_wallet_pin_reset(
                request,
                background_tasks,
                "test-token",
                db,
            )
            reset = db.query(PasswordReset).filter_by(
                purpose="wallet_pin_reset",
            ).one()
            tracking = db.query(PasswordResetRequest).one()
            main_module._deliver_password_reset_email(
                reset.id,
                tracking.id,
                "123456",
                "wallet_pin_reset",
            )
            db.expire_all()
            reset = db.query(PasswordReset).filter_by(
                purpose="wallet_pin_reset",
            ).one()
            self.assertEqual(reset.delivery_status, "sent")

            confirmation = main_module.confirm_wallet_pin_reset(
                main_module.WalletPinResetRequest(otp_code="123456", pin="2468"),
                request,
                "test-token",
                db,
            )

        self.assertIn("verification code will be sent", request_result["message"])
        self.assertTrue(confirmation["has_wallet_pin"])
        self.assertFalse(student.has_password)
        self.assertTrue(verify_password("2468", student.wallet_pin_hash))
        self.assertTrue(reset.is_used)
        sender.assert_called_once_with(
            "google@example.test",
            "123456",
            purpose="wallet_pin_reset",
        )

    def test_wallet_pin_reset_rejects_bad_codes_and_invalidates_after_five_attempts(self):
        db = self._create_password_reset_db(include_student=True)
        student = Student(
            name="Student",
            student_id="STU-1",
            email="student@example.test",
            password="oauth-only",
            has_password=False,
            is_verified=True,
            wallet_pin_hash=main_module.hash_password("1111"),
        )
        db.add(student)
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        reset = PasswordReset(
            email=student.email,
            otp_hash=main_module._password_reset_otp_hash(
                student.email,
                "123456",
                "wallet_pin_reset",
            ),
            expires_at=now + timedelta(minutes=10),
            is_used=False,
            delivery_status="sent",
            purpose="wallet_pin_reset",
            verification_attempts=0,
            created_at=now,
        )
        db.add(reset)
        db.commit()
        request = SimpleNamespace(client=SimpleNamespace(host="198.51.100.8"))

        with (
            patch.object(main_module, "_student_from_authorization", return_value=student),
            patch.object(main_module, "_require_verified_student"),
        ):
            for attempt in range(5):
                with self.assertRaises(HTTPException) as error:
                    main_module.confirm_wallet_pin_reset(
                        main_module.WalletPinResetRequest(otp_code="000000", pin="2468"),
                        request,
                        "test-token",
                        db,
                    )
                self.assertEqual(error.exception.status_code, 400)

        db.refresh(reset)
        db.refresh(student)
        self.assertEqual(reset.verification_attempts, 5)
        self.assertTrue(reset.is_used)
        self.assertTrue(verify_password("1111", student.wallet_pin_hash))

    def test_two_rapid_requests_create_one_otp_and_send_one_email(self):
        db = self._create_password_reset_db(include_student=True)
        db.add(Student(
            name="Student",
            student_id="STU-1",
            email="student@example.test",
            password="stored-password-hash",
        ))
        db.commit()
        with (
            patch.object(main_module, "_generate_otp_code", return_value="123456"),
            patch.object(main_module, "SessionLocal", return_value=db),
            patch.object(
                main_module,
                "send_otp_email_diagnostic",
                return_value={"success": True, "stage": "send", "mode": "starttls"},
            ) as sender,
        ):
            first_response, first_tasks = self._request_password_reset(
                db,
                "student@example.test",
            )
            second_response, second_tasks = self._request_password_reset(
                db,
                "student@example.test",
            )
            self.assertEqual(db.query(PasswordReset).count(), 1)
            reset = db.query(PasswordReset).one()
            self.assertNotEqual(reset.otp_hash, "123456")
            self.assertGreater(
                main_module._as_utc_datetime(reset.expires_at),
                main_module._utc_now(),
            )
            self.assertEqual(
                (reset.expires_at - reset.created_at).total_seconds(),
                600,
            )
            expires_at = reset.expires_at
            first_tasks.tasks[0].func(*first_tasks.tasks[0].args)
            sent_reset = db.query(PasswordReset).filter_by(id=reset.id).one()
            self.assertEqual(sent_reset.expires_at, expires_at)

        self.assertEqual(first_response, second_response)
        self.assertEqual(len(second_tasks.tasks), 0)
        sender.assert_called_once_with("student@example.test", "123456")
        self.assertTrue(
            main_module.verify_reset_code(
                main_module.VerifyResetCodeRequest(
                    email="student@example.test",
                    otp_code="123456",
                ),
                db,
            )["success"]
        )

    def test_resend_after_cooldown_invalidates_old_code(self):
        db = self._create_password_reset_db(include_student=True)
        db.add(Student(
            name="Student",
            student_id="STU-1",
            email="student@example.test",
            password="stored-password-hash",
        ))
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        db.add_all([
            PasswordReset(
                email="student@example.test",
                otp_hash=main_module._password_reset_otp_hash(
                    "student@example.test",
                    "111111",
                ),
                expires_at=now + timedelta(minutes=9),
                is_used=False,
                delivery_status="sent",
                verification_attempts=0,
                created_at=now - timedelta(seconds=61),
            ),
            PasswordResetRequest(
                account_key="student@example.test",
                request_ip="198.51.100.2",
                requested_at=now - timedelta(seconds=61),
                delivery_status="sent",
            ),
        ])
        db.commit()

        with (
            patch.object(main_module, "_generate_otp_code", return_value="222222"),
            patch.object(main_module, "SessionLocal", return_value=db),
            patch.object(
                main_module,
                "send_otp_email_diagnostic",
                return_value={"success": True, "stage": "send", "mode": "starttls"},
            ) as sender,
        ):
            _, tasks = self._request_password_reset(db, "student@example.test")
            tasks.tasks[0].func(*tasks.tasks[0].args)

        old_reset, current_reset = db.query(PasswordReset).order_by(PasswordReset.id).all()
        self.assertTrue(old_reset.is_used)
        self.assertEqual(old_reset.delivery_status, "invalidated")
        self.assertTrue(current_reset.otp_hash != "222222")
        sender.assert_called_once_with("student@example.test", "222222")

        with self.assertRaises(HTTPException):
            main_module.verify_reset_code(
                main_module.VerifyResetCodeRequest(
                    email="student@example.test",
                    otp_code="111111",
                ),
                db,
            )
        self.assertTrue(
            main_module.verify_reset_code(
                main_module.VerifyResetCodeRequest(
                    email="student@example.test",
                    otp_code="222222",
                ),
                db,
            )["success"]
        )

    def test_invalidated_otp_is_not_sent_by_delivery_retry(self):
        db = self._create_password_reset_db()
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        reset = PasswordReset(
            email="student@example.test",
            otp_hash=main_module._password_reset_otp_hash("student@example.test", "123456"),
            expires_at=now + timedelta(minutes=10),
            is_used=True,
            delivery_status="invalidated",
            created_at=now,
        )
        tracking = PasswordResetRequest(
            account_key="student@example.test",
            request_ip="198.51.100.2",
            requested_at=now,
            delivery_status="queued",
        )
        db.add_all([reset, tracking])
        db.commit()
        with (
            patch.object(main_module, "SessionLocal", return_value=db),
            patch.object(main_module, "send_otp_email_diagnostic") as sender,
        ):
            main_module._deliver_password_reset_email(
                reset.id,
                tracking.id,
                "123456",
            )
        sender.assert_not_called()
        self.assertEqual(tracking.delivery_status, "invalidated")

    def test_five_incorrect_verification_attempts_invalidate_the_code(self):
        db = self._create_password_reset_db(include_student=True)
        db.add(Student(
            name="Student",
            student_id="STU-1",
            email="student@example.test",
            password="stored-password-hash",
        ))
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        reset = PasswordReset(
            email="student@example.test",
            otp_hash=main_module._password_reset_otp_hash("student@example.test", "123456"),
            expires_at=now + timedelta(minutes=10),
            is_used=False,
            delivery_status="sent",
            verification_attempts=0,
            created_at=now,
        )
        db.add(reset)
        db.commit()
        invalid_request = main_module.VerifyResetCodeRequest(
            email="student@example.test",
            otp_code="000000",
        )

        for _ in range(5):
            with self.assertRaises(HTTPException):
                main_module.verify_reset_code(invalid_request, db)

        self.assertEqual(reset.verification_attempts, 5)
        self.assertTrue(reset.is_used)
        with self.assertRaises(HTTPException):
            main_module.verify_reset_code(
                main_module.VerifyResetCodeRequest(
                    email="student@example.test",
                    otp_code="123456",
                ),
                db,
            )

    def test_admin_test_email_returns_safe_transport_diagnostic(self):
        diagnostic = {
            "success": False,
            "stage": "starttls",
            "mode": "starttls",
            "port": 587,
            "hint": "Check whether the port is blocked by firewall/antivirus/network.",
            "attempts": [{"success": False, "stage": "starttls", "mode": "starttls"}],
        }
        with (
            patch.object(main_module, "_require_admin_dashboard_access") as require_admin,
            patch.object(
                main_module,
                "_smtp_credentials",
                return_value=("sender@example.test", "not-a-real-password"),
            ),
            patch.object(main_module, "_send_smtp_message", return_value=diagnostic) as send,
        ):
            response = main_module.send_admin_test_email(
                "Bearer admin-token",
                "session-token",
                object(),
            )

        require_admin.assert_called_once()
        send.assert_called_once_with(
            "sender@example.test",
            "Campus Market SMTP test",
            "This is an administrator-triggered SMTP configuration test.",
        )
        self.assertEqual(response["stage"], "starttls")
        self.assertEqual(response["mode"], "starttls")
        self.assertNotIn("not-a-real-password", str(response))


if __name__ == "__main__":
    unittest.main()
