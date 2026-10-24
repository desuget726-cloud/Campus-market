import os
import unittest
from unittest.mock import patch

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["SESSION_SECRET"] = "message-block-test-secret"

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import main as main_module
from app.database import Base
from app.models import Message, MessageBlock, Student


class MessageBlockTests(unittest.TestCase):
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
        self.blocker = Student(
            name="Blocker",
            student_id="blocker-one",
            email="blocker@example.test",
            password="not-a-real-password",
            college="Test College",
            department="Testing",
            is_verified=True,
        )
        self.blocked = Student(
            name="Blocked",
            student_id="blocked-two",
            email="blocked@example.test",
            password="not-a-real-password",
            college="Test College",
            department="Testing",
            is_verified=True,
        )
        self.db.add_all([self.blocker, self.blocked])
        self.db.flush()
        self.previous_message = Message(
            sender_id=self.blocker.student_id,
            receiver_id=self.blocked.student_id,
            message_text="Message history remains.",
        )
        self.db.add(self.previous_message)
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def call_block(self, actor, user_id):
        with patch.object(main_module, "_student_from_authorization", return_value=actor):
            return main_module.block_student(user_id, authorization="Bearer test-token", db=self.db)

    def call_unblock(self, actor, user_id):
        with patch.object(main_module, "_student_from_authorization", return_value=actor):
            return main_module.unblock_student(user_id, authorization="Bearer test-token", db=self.db)

    def send_message(self):
        request = main_module.SendMessageRequest(
            sender_id=self.blocker.student_id,
            receiver_id=self.blocked.student_id,
            message_text="Can we message now?",
        )
        with patch.object(main_module, "_dispatch_student_notification"):
            return main_module.send_student_message(request, db=self.db)

    def test_block_is_idempotent_and_self_block_is_rejected(self):
        self.call_block(self.blocker, self.blocked.student_id)
        self.call_block(self.blocker, self.blocked.student_id)

        self.assertEqual(
            self.db.query(MessageBlock).filter_by(
                blocker_id=self.blocker.student_id,
                blocked_id=self.blocked.student_id,
            ).count(),
            1,
        )

        with self.assertRaises(HTTPException) as error:
            self.call_block(self.blocker, self.blocker.student_id)

        self.assertEqual(error.exception.status_code, 400)

    def test_block_endpoints_require_authentication(self):
        with self.assertRaises(HTTPException) as error:
            main_module.block_student(self.blocked.student_id, authorization=None, db=self.db)

        self.assertEqual(error.exception.status_code, 401)

    def test_block_then_unblock_restores_sending_without_deleting_history(self):
        self.call_block(self.blocker, self.blocked.student_id)
        with self.assertRaises(HTTPException) as error:
            self.send_message()
        self.assertEqual(error.exception.status_code, 403)

        self.call_unblock(self.blocker, self.blocked.student_id)
        self.call_unblock(self.blocker, self.blocked.student_id)
        response = self.send_message()

        self.assertTrue(response["success"])
        self.assertEqual(
            self.db.query(Message).filter(
                Message.sender_id == self.blocker.student_id,
                Message.receiver_id == self.blocked.student_id,
            ).count(),
            2,
        )
        self.assertIsNotNone(self.db.get(Message, self.previous_message.id))

    def test_only_blocker_can_remove_their_block(self):
        self.call_block(self.blocker, self.blocked.student_id)

        with self.assertRaises(HTTPException) as error:
            self.call_unblock(self.blocked, self.blocker.student_id)

        self.assertEqual(error.exception.status_code, 404)
        self.assertEqual(self.db.query(MessageBlock).count(), 1)

    def test_mutual_blocks_keep_messaging_disabled_until_both_are_removed(self):
        self.call_block(self.blocker, self.blocked.student_id)
        self.call_block(self.blocked, self.blocker.student_id)
        self.call_unblock(self.blocker, self.blocked.student_id)

        with self.assertRaises(HTTPException) as error:
            self.send_message()
        self.assertEqual(error.exception.status_code, 403)

        self.call_unblock(self.blocked, self.blocker.student_id)
        self.assertTrue(self.send_message()["success"])

    def test_conversations_report_block_flags_without_identity_details(self):
        self.call_block(self.blocker, self.blocked.student_id)

        blocker_response = main_module.get_student_conversations(self.blocker.student_id, db=self.db)
        blocked_response = main_module.get_student_conversations(self.blocked.student_id, db=self.db)

        blocker_conversation = blocker_response["conversations"][0]
        blocked_conversation = blocked_response["conversations"][0]
        self.assertEqual(blocker_conversation["blocked_by_me"], True)
        self.assertEqual(blocker_conversation["blocked_me"], False)
        self.assertEqual(blocked_conversation["blocked_by_me"], False)
        self.assertEqual(blocked_conversation["blocked_me"], True)


if __name__ == "__main__":
    unittest.main()
