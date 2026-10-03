import os
import unittest
from unittest.mock import patch

os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import main as main_module
from app.database import Base
from app.models import Notification, Student


class StudentVerificationNotificationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        cls.session_factory = sessionmaker(
            bind=cls.engine,
            autoflush=False,
            autocommit=False,
        )

    @classmethod
    def tearDownClass(cls):
        cls.engine.dispose()

    def setUp(self):
        Base.metadata.drop_all(bind=self.engine)
        Base.metadata.create_all(bind=self.engine)
        self.db = self.session_factory()
        self.student = Student(
            name="Verification Student",
            student_id="VERIFY-1",
            email="verification@example.test",
            password="hashed-password",
            college="Test College",
            department="Testing",
        )
        self.db.add(self.student)
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def test_helper_creates_one_system_notification_with_marketplace_action(self):
        self.assertTrue(main_module.notify_id_verified(self.db, self.student.student_id))
        self.assertFalse(main_module.notify_id_verified(self.db, self.student.student_id))
        self.db.commit()

        notifications = self.db.query(Notification).filter_by(
            student_id=self.student.student_id,
        ).all()
        self.assertEqual(len(notifications), 1)
        notification = notifications[0]
        self.assertEqual(notification.title, "ID Verification Approved")
        self.assertEqual(
            notification.message,
            "Your student identity has been successfully verified. You can now access full "
            "marketplace features and complete transactions without restrictions.",
        )
        self.assertEqual(notification.type, "SYSTEM")
        self.assertEqual(notification.action_label, "Go to Marketplace")
        self.assertEqual(notification.action_url, "buyer")
        response = main_module.get_student_notifications(self.student.student_id, db=self.db)
        self.assertEqual(response["notifications"][0]["action_label"], "Go to Marketplace")
        self.assertEqual(response["notifications"][0]["action_url"], "buyer")

    def test_admin_approval_notifies_only_when_verification_changes(self):
        request = main_module.VerificationDecisionRequest(status="Verified")
        with patch.object(main_module, "send_verification_status_email", return_value=True) as send_email:
            first_response = main_module.update_student_verification(
                self.student.id,
                request,
                db=self.db,
            )
            second_response = main_module.update_student_verification(
                self.student.id,
                request,
                db=self.db,
            )

        self.assertTrue(first_response["is_verified"])
        self.assertEqual(second_response["message"], "Student is already verified.")
        send_email.assert_called_once()
        self.assertEqual(
            self.db.query(Notification).filter_by(student_id=self.student.student_id).count(),
            1,
        )


if __name__ == "__main__":
    unittest.main()
