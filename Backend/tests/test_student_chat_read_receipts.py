import asyncio
import json
import os
import unittest
from unittest.mock import AsyncMock, patch

from fastapi import WebSocketDisconnect

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["SESSION_SECRET"] = "student-chat-read-receipt-test-secret"

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import main as main_module
from app.database import Base
from app.models import Message, Student


class StudentChatReadReceiptTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(bind=self.engine)
        self.db = sessionmaker(bind=self.engine)()
        self.reader = Student(
            name="Reader",
            student_id="reader-one",
            email="reader@example.test",
            password="test-password",
            is_verified=True,
        )
        self.sender = Student(
            name="Sender",
            student_id="sender-two",
            email="sender@example.test",
            password="test-password",
            is_verified=True,
        )
        self.other_sender = Student(
            name="Other Sender",
            student_id="sender-three",
            email="other-sender@example.test",
            password="test-password",
            is_verified=True,
        )
        self.db.add_all([self.reader, self.sender, self.other_sender])
        self.db.flush()
        self.incoming_message = Message(
            sender_id=self.sender.student_id,
            receiver_id=self.reader.student_id,
            message_text="Please review this.",
            is_read=False,
        )
        self.outgoing_message = Message(
            sender_id=self.reader.student_id,
            receiver_id=self.sender.student_id,
            message_text="I will take a look.",
            is_read=False,
        )
        self.other_conversation_message = Message(
            sender_id=self.other_sender.student_id,
            receiver_id=self.reader.student_id,
            message_text="A different conversation.",
            is_read=False,
        )
        self.db.add_all([
            self.incoming_message,
            self.outgoing_message,
            self.other_conversation_message,
        ])
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_mark_read_updates_only_messages_from_selected_sender(self):
        request = main_module.StudentMessagesMarkReadRequest(
            sender_id=self.sender.student_id,
        )
        with patch.object(
            main_module,
            "_student_from_authorization",
            return_value=self.reader,
        ):
            result = main_module.mark_student_messages_read(
                request,
                authorization="Bearer test-token",
                db=self.db,
            )

        self.assertEqual(result["updated_count"], 1)
        self.assertEqual(result["unread_count"], 1)
        self.assertTrue(self.incoming_message.is_read)
        self.assertFalse(self.outgoing_message.is_read)
        self.assertFalse(self.other_conversation_message.is_read)

    def test_mark_read_rejects_self_conversation(self):
        request = main_module.StudentMessagesMarkReadRequest(
            sender_id=self.reader.student_id,
        )
        with patch.object(
            main_module,
            "_student_from_authorization",
            return_value=self.reader,
        ):
            with self.assertRaises(main_module.HTTPException) as error:
                main_module.mark_student_messages_read(
                    request,
                    authorization="Bearer test-token",
                    db=self.db,
                )

        self.assertEqual(error.exception.status_code, 400)

    def test_websocket_mark_read_sends_receipt_to_original_sender(self):
        class FakeWebSocket:
            def __init__(self):
                self.payloads = [
                    json.dumps({
                        "type": "mark_read",
                        "sender_id": "sender-two",
                    }),
                ]

            async def receive_text(self):
                if self.payloads:
                    return self.payloads.pop(0)
                raise WebSocketDisconnect()

            async def send_json(self, payload):
                return None

            async def close(self, **kwargs):
                return None

        websocket = FakeWebSocket()
        with (
            patch.object(main_module, "SessionLocal", sessionmaker(bind=self.engine)),
            patch.object(main_module.manager, "connect", new_callable=AsyncMock),
            patch.object(main_module.manager, "broadcast", new_callable=AsyncMock),
            patch.object(
                main_module.manager,
                "send_personal_message",
                new_callable=AsyncMock,
                return_value=True,
            ) as send_personal_message,
            patch.object(
                main_module.manager,
                "disconnect",
                new_callable=AsyncMock,
                return_value=True,
            ),
        ):
            asyncio.run(
                main_module.student_chat_websocket(
                    websocket,
                    self.reader.student_id,
                )
            )

        self.db.expire_all()
        self.assertTrue(
            self.db.query(Message).filter_by(id=self.incoming_message.id).one().is_read
        )
        send_personal_message.assert_awaited_once_with(
            self.sender.student_id,
            {
                "type": "read_receipt_updated",
                "reader_id": self.reader.student_id,
                "conversation_id": f"conv-{self.reader.student_id}",
            },
        )
