import unittest
from email import message_from_string
from unittest.mock import MagicMock, patch

from app import main as main_module
from app.email_templates import render_system_email, render_system_email_text
from app.models import Student


class SystemEmailTemplateTests(unittest.TestCase):
    def test_renderer_escapes_content_and_renders_status_details_and_cta(self):
        rendered = render_system_email(
            "Order <completed>",
            "Hello Ada & Sam,",
            ["Your item is ready."],
            badge="Pending",
            details_table={"Order ID": "#12", "Item": "<Laptop>"},
            action_button={"label": "Track Order", "url": "https://shop.example/orders/12"},
            image_url="https://res.cloudinary.com/campus/image/upload/poster.png",
        )

        self.assertIn("max-width:560px", rendered)
        self.assertIn("linear-gradient(120deg,#0284c7,#0369a1)", rendered)
        self.assertIn("Order &lt;completed&gt;", rendered)
        self.assertIn("&lt;Laptop&gt;", rendered)
        self.assertIn('href="https://shop.example/orders/12"', rendered)
        self.assertIn('src="https://res.cloudinary.com/campus/image/upload/poster.png"', rendered)
        self.assertIn("width:100%;border-radius:12px;margin-bottom:16px", rendered)
        self.assertIn(">Track Order</a>", rendered)
        self.assertIn("#b45309", rendered)
        self.assertIn("© 2026 UniXchange Campus Marketplace. All rights reserved.", rendered)
        self.assertNotIn("<Laptop>", rendered)

    def test_renderer_rejects_non_http_action_url(self):
        with self.assertRaises(ValueError):
            render_system_email(
                "Update",
                "Hello,",
                ["Status changed."],
                action_button={"label": "View", "url": "javascript:alert(1)"},
            )

    def test_outbox_sender_sends_alternative_plain_and_branded_html_parts(self):
        server = MagicMock()
        server.__enter__.return_value = server
        body = (
            '{"template":"system","title":"Support update","greeting":"Hello Ada,",'
            '"message_paragraphs":["Your support request has been resolved."],'
            '"badge":"Resolved","details_table":{"Ticket ID":"SUP-0003"},'
            '"image_url":"https://res.cloudinary.com/campus/image/upload/support.png",'
            '"action_button":{"label":"View Support Request",'
            '"url":"https://shop.example/support/3"}}'
        )

        with patch.object(main_module, "_IPv4SMTP_SSL", return_value=server):
            main_module._send_outbox_email("ada@example.test", "Support update", body)

        parsed = message_from_string(server.sendmail.call_args.args[2])
        self.assertEqual(parsed.get_content_type(), "multipart/alternative")
        parts = [part for part in parsed.walk() if part.get_content_maintype() != "multipart"]
        self.assertEqual([part.get_content_type() for part in parts], ["text/plain", "text/html"])
        self.assertIn("Ticket ID: SUP-0003", parts[0].get_payload(decode=True).decode("utf-8"))
        html_body = parts[1].get_payload(decode=True).decode("utf-8")
        self.assertIn("UniXchange", html_body)
        self.assertIn('href="https://shop.example/support/3"', html_body)
        self.assertIn("View Support Request", html_body)
        self.assertIn('src="https://res.cloudinary.com/campus/image/upload/support.png"', html_body)

    def test_plain_text_alternative_includes_details_and_security_footer(self):
        plain = render_system_email_text(
            "Payment receipt",
            "Hello Ada,",
            ["Your deposit completed."],
            badge="Completed",
            details_table={"Reference": "TX-123"},
        )
        self.assertIn("Reference: TX-123", plain)
        self.assertIn("never ask you to share your password", plain)
        self.assertIn("© 2026 UniXchange Campus Marketplace. All rights reserved.", plain)

    def test_student_payment_email_has_itemized_html_and_plain_fallback(self):
        student = Student(
            name="Ada",
            student_id="ada-1",
            email="ada@example.test",
            notif_pay_email=True,
        )
        server = MagicMock()
        server.__enter__.return_value = server

        with patch.object(main_module, "_IPv4SMTP_SSL", return_value=server):
            sent = main_module._send_student_notification_email(
                student,
                "Payment completed",
                "Your order is complete.",
                "payment",
                badge="Completed",
                details_table={
                    "Order ID": "#12",
                    "Item": "Textbook",
                    "Quantity": 2,
                    "Total": "200.00 ETB",
                },
                action_button={
                    "label": "Track Order",
                    "url": "https://shop.example/dashboard?tab=buyer&section=orders&order=12",
                },
            )

        self.assertTrue(sent)
        parsed = message_from_string(server.sendmail.call_args.args[2])
        self.assertEqual(parsed.get_content_type(), "multipart/alternative")
        parts = [part for part in parsed.walk() if part.get_content_maintype() != "multipart"]
        self.assertEqual([part.get_content_type() for part in parts], ["text/plain", "text/html"])
        self.assertIn("Total: 200.00 ETB", parts[0].get_payload(decode=True).decode("utf-8"))
        self.assertIn("Quantity", parts[1].get_payload(decode=True).decode("utf-8"))


if __name__ == "__main__":
    unittest.main()
