import asyncio
import os
import unittest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["SESSION_SECRET"] = "message-edit-test-secret"

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import main as main_module
from app.database import Base
from app.models import Message, Student


class MessageEditTests(unittest.TestCase):
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
        self.sender = Student(
            name="Sender",
            student_id="sender-one",
            email="sender@example.test",
            password="test-password",
            college="Test College",
            department="Testing",
        )
        self.receiver = Student(
            name="Receiver",
            student_id="receiver-two",
            email="receiver@example.test",
            password="test-password",
            college="Test College",
            department="Testing",
        )
        self.db.add_all([self.sender, self.receiver])
        self.db.flush()
        self.message = self.make_message()
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def make_message(self, **overrides):
        values = {
            "sender_id": self.sender.student_id,
            "receiver_id": self.receiver.student_id,
            "message_text": "Original message",
            "created_at": datetime.now(),
        }
        values.update(overrides)
        message = Message(**values)
        self.db.add(message)
        self.db.flush()
        return message

    def edit(self, message, content):
        return asyncio.run(main_module.edit_student_message(
            message.id,
            main_module.EditMessageRequest(content=content),
            authorization="Bearer test-token",
            db=self.db,
        ))

    def test_edit_trims_saves_and_broadcasts_to_receiver(self):
        with (
            patch.object(main_module, "_student_from_authorization", return_value=self.sender),
            patch.object(main_module, "_get_setting_value", return_value=1000),
            patch.object(main_module.manager, "send_personal_message", new_callable=AsyncMock) as broadcast,
        ):
            response = self.edit(self.message, "  Updated message  ")

        self.db.refresh(self.message)
        self.assertEqual(self.message.message_text, "Updated message")
        self.assertTrue(self.message.edited)
        self.assertIsNotNone(self.message.edited_at)
        self.assertEqual(response["content"], "Updated message")
        self.assertEqual(response["conversationId"], "conv-receiver-two")
        broadcast.assert_awaited_once_with("receiver-two", {
            "type": "message_edited",
            "id": self.message.id,
            "conversationId": "conv-sender-one",
            "content": "Updated message",
            "edited": True,
            "editedAt": response["editedAt"],
            "is_latest": True,
        })

    def test_only_sender_can_edit(self):
        with patch.object(main_module, "_student_from_authorization", return_value=self.receiver):
            with self.assertRaises(HTTPException) as error:
                self.edit(self.message, "Changed")

        self.assertEqual(error.exception.status_code, 403)
        self.assertEqual(self.message.message_text, "Original message")

    def test_message_must_be_within_edit_window(self):
        old_message = self.make_message(created_at=datetime.now() - timedelta(minutes=16))
        with patch.object(main_module, "_student_from_authorization", return_value=self.sender):
            with self.assertRaises(HTTPException) as error:
                self.edit(old_message, "Changed")

        self.assertEqual(error.exception.status_code, 400)
        self.assertIn("15 minutes", error.exception.detail)

    def test_only_plain_text_messages_can_be_edited(self):
        image_message = self.make_message(attachment_url="/static/image.jpg", attachment_type="image")
        with patch.object(main_module, "_student_from_authorization", return_value=self.sender):
            with self.assertRaises(HTTPException) as error:
                self.edit(image_message, "Changed")

        self.assertEqual(error.exception.status_code, 400)
        self.assertIn("plain text", error.exception.detail)

    def test_empty_and_over_limit_content_are_rejected(self):
        with (
            patch.object(main_module, "_student_from_authorization", return_value=self.sender),
            patch.object(main_module, "_get_setting_value", return_value=3),
        ):
            with self.assertRaises(HTTPException) as empty_error:
                self.edit(self.message, "   ")
            with self.assertRaises(HTTPException) as length_error:
                self.edit(self.message, "four")

        self.assertEqual(empty_error.exception.status_code, 400)
        self.assertEqual(length_error.exception.status_code, 400)
        self.assertIn("3 character limit", length_error.exception.detail)


if __name__ == "__main__":
    unittest.main()
