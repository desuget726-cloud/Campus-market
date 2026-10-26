import os
import ssl
import unittest
from contextlib import redirect_stdout
from io import StringIO
from unittest.mock import patch

from app import main as main_module


class OtpEmailTests(unittest.TestCase):
    def setUp(self):
        self.environment = patch.dict(
            os.environ,
            {
                "ENVIRONMENT": "development",
                "APP_ENV": "",
                "SMTP_USER": "sender@example.test",
                "SMTP_PASSWORD": "test app password",
                "SENDER_EMAIL": "",
                "SENDER_PASSWORD": "",
            },
        )
        self.environment.start()
        self.addCleanup(self.environment.stop)

    def test_sends_through_gmail_implicit_tls_and_prints_development_fallback(self):
        output = StringIO()
        with (
            patch.object(main_module, "_notifications_enabled", return_value=True),
            patch.object(main_module.smtplib, "SMTP_SSL") as smtp,
            redirect_stdout(output),
            self.assertLogs("app.email", level="INFO"),
        ):
            smtp_server = smtp.return_value.__enter__.return_value
            smtp_server.sendmail.return_value = {}
            sent = main_module.send_otp_email("student@example.test", "123456")

        self.assertTrue(sent)
        smtp.assert_called_once_with(
            "smtp.gmail.com",
            465,
            context=smtp.call_args.kwargs["context"],
            timeout=15,
        )
        self.assertIsInstance(smtp.call_args.kwargs["context"], ssl.SSLContext)
        smtp_server.starttls.assert_not_called()
        smtp_server.login.assert_called_once_with(
            "sender@example.test",
            "testapppassword",
        )
        sendmail_args = smtp_server.sendmail.call_args.args
        self.assertEqual(sendmail_args[:2], ("sender@example.test", "student@example.test"))
        self.assertIn("123456", sendmail_args[2])
        self.assertIn(
            "[DEV FALLBACK] OTP for student@example.test is: 123456",
            output.getvalue(),
        )

    def test_authentication_failure_is_logged_and_does_not_crash(self):
        output = StringIO()
        with (
            patch.object(main_module, "_notifications_enabled", return_value=True),
            patch.object(main_module.smtplib, "SMTP_SSL") as smtp,
            redirect_stdout(output),
            self.assertLogs("app.email", level="ERROR") as logs,
        ):
            smtp_server = smtp.return_value.__enter__.return_value
            smtp_server.login.side_effect = main_module.smtplib.SMTPAuthenticationError(
                535,
                b"5.7.8 invalid credentials",
            )
            sent = main_module.send_otp_email("student@example.test", "123456")

        self.assertFalse(sent)
        self.assertIn("recipient=student@example.test", logs.output[0])
        self.assertIn("5.7.8 invalid credentials", logs.output[0])
        self.assertIn("[DEV FALLBACK]", output.getvalue())
        self.assertIn("[EMAIL SMTP AUTH ERROR]", output.getvalue())

    def test_missing_credentials_are_reported_but_development_otp_is_printed(self):
        with patch.dict(
            os.environ,
            {
                "SMTP_USER": "",
                "SMTP_PASSWORD": "",
                "SENDER_EMAIL": "",
                "SENDER_PASSWORD": "",
            },
        ):
            output = StringIO()
            with (
                patch.object(main_module, "_notifications_enabled", return_value=True),
                patch.object(main_module.smtplib, "SMTP") as smtp,
                redirect_stdout(output),
                self.assertLogs("app.email", level="ERROR") as logs,
            ):
                sent = main_module.send_otp_email("student@example.test", "123456")

        self.assertFalse(sent)
        smtp.assert_not_called()
        self.assertIn("missing configuration", logs.output[0])
        self.assertIn("[DEV FALLBACK] OTP for student@example.test is: 123456", output.getvalue())

    def test_smtp_connection_response_and_timeout_failures_are_handled(self):
        failures = (
            (
                main_module.smtplib.SMTPConnectError(421, b"connection refused"),
                "SMTP connection failed",
            ),
            (
                main_module.smtplib.SMTPResponseException(554, b"message rejected"),
                "SMTP response error",
            ),
            (TimeoutError("connection timed out"), "SMTP timed out"),
            (
                main_module.smtplib.SMTPServerDisconnected(
                    "Connection unexpectedly closed"
                ),
                "SMTP failed",
            ),
        )

        for error, expected_log in failures:
            with self.subTest(error=type(error).__name__):
                output = StringIO()
                with (
                    patch.object(main_module, "_notifications_enabled", return_value=True),
                    patch.object(main_module.smtplib, "SMTP_SSL", side_effect=error),
                    redirect_stdout(output),
                    self.assertLogs("app.email", level="ERROR") as logs,
                ):
                    sent = main_module.send_otp_email(
                        "student@example.test",
                        "123456",
                    )

                self.assertFalse(sent)
                self.assertIn(expected_log, logs.output[0])
                self.assertIn("[DEV FALLBACK]", output.getvalue())

    def test_disconnect_during_authentication_is_logged_with_phase(self):
        output = StringIO()
        with (
            patch.object(main_module, "_notifications_enabled", return_value=True),
            patch.object(main_module.smtplib, "SMTP_SSL") as smtp,
            redirect_stdout(output),
            self.assertLogs("app.email", level="ERROR") as logs,
        ):
            smtp_server = smtp.return_value.__enter__.return_value
            smtp_server.login.side_effect = main_module.smtplib.SMTPServerDisconnected(
                "Connection unexpectedly closed"
            )
            sent = main_module.send_otp_email(
                "student@example.test",
                "123456",
            )

        self.assertFalse(sent)
        self.assertIn("during authentication", logs.output[0])
        self.assertIn("[EMAIL SMTP ERROR] authentication:", output.getvalue())


if __name__ == "__main__":
    unittest.main()
