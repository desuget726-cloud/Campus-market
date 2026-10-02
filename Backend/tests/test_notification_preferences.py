import os
import unittest
from unittest.mock import patch

os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import main as main_module
from app.database import Base
from app.models import Notification, Student


class NotificationPreferenceTests(unittest.TestCase):
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
        self.student = Student(
            name="Preference Student",
            student_id="PREF-1",
            email="preference@example.test",
            password="hashed-password",
            college="Test College",
            department="Testing",
        )
        self.db.add(self.student)
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def test_new_students_start_with_payment_success_channels_enabled(self):
        self.assertTrue(self.student.notif_pay_inapp)
        self.assertTrue(self.student.notif_pay_email)

    def test_authenticated_get_put_round_trip_for_current_student(self):
        payload = main_module.StudentNotificationPreferencesUpdate(
            new_messages={"in_app": False, "email": True},
            order_updates={"in_app": True, "email": False},
            payment_success={"in_app": False, "email": False},
        )
        with patch.object(main_module, "_student_from_authorization", return_value=self.student) as authenticate:
            saved = main_module.update_notification_preferences(
                payload,
                authorization="Bearer current-student-token",
                db=self.db,
            )
            authenticate.assert_called_once_with("Bearer current-student-token", self.db)
            self.assertEqual(
                saved["preferences"],
                {
                    "new_messages": {"in_app": False, "email": True},
                    "order_updates": {"in_app": True, "email": False},
                    "payment_success": {"in_app": True, "email": False},
                },
            )
            loaded = main_module.get_notification_preferences(
                authorization="Bearer current-student-token",
                db=self.db,
            )

        self.assertEqual(loaded["preferences"], saved["preferences"])
        self.db.refresh(self.student)
        self.assertTrue(self.student.notif_pay_inapp)

    def test_preferences_reject_unlisted_keys_and_student_id(self):
        with self.assertRaises(ValidationError):
            main_module.StudentNotificationPreferencesUpdate.model_validate({
                "student_id": "OTHER-STUDENT",
                "new_messages": {"in_app": True, "email": True},
                "order_updates": {"in_app": True, "email": True},
                "payment_success": {"in_app": True, "email": True},
            })

        with self.assertRaises(ValidationError):
            main_module.NotificationChannelPreferences.model_validate({
                "in_app": True,
                "email": True,
                "sms": True,
            })

    def test_locked_payment_notifications_are_created_even_if_legacy_value_is_false(self):
        self.student.notif_pay_inapp = False
        self.student.notif_msg_inapp = False
        self.db.flush()

        self.assertFalse(main_module._add_student_notification(
            self.db, self.student, "New message", "A message arrived.", "message",
        ))
        self.assertTrue(main_module._add_student_notification(
            self.db, self.student, "Payment success", "Payment completed.", "payment",
        ))
        self.db.flush()
        self.assertEqual(self.db.query(Notification).filter_by(type="payment").count(), 1)

    def test_generic_notification_creation_respects_message_preference_but_locks_payment(self):
        self.student.notif_msg_inapp = False
        self.student.notif_pay_inapp = False
        self.db.commit()

        message_response = main_module.create_student_notification(
            main_module.NotificationCreate(
                student_id=self.student.student_id,
                message="A message arrived.",
                type="message",
            ),
            db=self.db,
        )
        payment_response = main_module.create_student_notification(
            main_module.NotificationCreate(
                student_id=self.student.student_id,
                message="Payment completed.",
                type="payment",
            ),
            db=self.db,
        )

        self.assertIsNone(message_response["notification"])
        self.assertIsNotNone(payment_response["notification"])
        self.assertEqual(self.db.query(Notification).filter_by(type="message").count(), 0)
        self.assertEqual(self.db.query(Notification).filter_by(type="payment").count(), 1)

    def test_email_notifications_respect_channel_preferences(self):
        self.student.notif_msg_email = False
        with patch.object(main_module.smtplib, "SMTP") as smtp:
            sent = main_module._send_student_notification_email(
                self.student, "New message", "A message arrived.", "message",
            )

        self.assertFalse(sent)
        smtp.assert_not_called()


if __name__ == "__main__":
    unittest.main()