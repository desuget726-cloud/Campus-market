import os
import unittest
from datetime import datetime, timedelta, timezone

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["SESSION_SECRET"] = "student-session-test-secret"

from app import main as main_module
from app.database import Base
from app.models import Student, StudentSession
from app.password_security import hash_password


class StudentSessionTests(unittest.TestCase):
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
            name="Session User",
            student_id="MAU1600001",
            email="session-user@example.test",
            password=hash_password("SessionPass123!"),
            college="Test College",
            department="Testing",
            is_verified=True,
        )
        self.db.add(self.student)
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def test_student_from_authorization_rejects_revoked_session(self):
        token = main_module._create_session_token(
            self.student.student_id,
            "student",
            30,
            main_module._get_session_secret(),
        )
        session = StudentSession(
            student_id=self.student.student_id,
            session_token=token,
            ip_address="127.0.0.1",
            device_browser="Test Browser",
            is_active=False,
            last_active=datetime.now(timezone.utc),
        )
        self.db.add(session)
        self.db.commit()

        with self.assertRaises(Exception):
            main_module._student_from_authorization(f"Bearer {token}", self.db)

    def test_get_student_sessions_lists_active_devices(self):
        current_token = main_module._create_session_token(
            self.student.student_id,
            "student",
            30,
            main_module._get_session_secret(),
        )
        other_token = main_module._create_session_token(
            f"{self.student.student_id}-alt",
            "student",
            30,
            main_module._get_session_secret(),
        )
        self.db.add_all(
            [
                StudentSession(
                    student_id=self.student.student_id,
                    session_token=current_token,
                    ip_address="127.0.0.1",
                    device_browser="Chrome",
                    is_active=True,
                    last_active=datetime.now(timezone.utc),
                ),
                StudentSession(
                    student_id=self.student.student_id,
                    session_token=other_token,
                    ip_address="192.168.1.10",
                    device_browser="Safari",
                    is_active=True,
                    last_active=datetime.now(timezone.utc) - timedelta(minutes=5),
                ),
            ]
        )
        self.db.commit()

        sessions = main_module.get_student_sessions(
            authorization=f"Bearer {current_token}",
            db=self.db,
        )

        self.assertEqual(len(sessions), 2)
        self.assertTrue(any(item["is_current"] for item in sessions if item["session_token"] == current_token))
        self.assertTrue(any(item["device_browser"] == "Safari" for item in sessions))


if __name__ == "__main__":
    unittest.main()
