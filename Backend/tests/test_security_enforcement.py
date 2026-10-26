import json
import os
import unittest
import uuid
from datetime import datetime, timezone
from unittest.mock import patch

os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import main as main_module
from app.database import Base, get_db
from app.models import Student, SystemSetting, UserSession
from app.password_security import hash_password


class StudentVerificationEnforcementTests(unittest.TestCase):
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
            name="Unverified Student",
            student_id="MAU1600987",
            email="unverified@example.test",
            password=hash_password("ValidPassword123!"),
            is_verified=False,
        )
        self.db.add(self.student)
        self.db.flush()
        self.session_id = str(uuid.uuid4())
        self.token = main_module._create_session_token(
            self.student.student_id,
            "student",
            60,
            "student-verification-test-secret",
            session_id=self.session_id,
        )
        self.db.add(UserSession(
            id=self.session_id,
            user_id=self.student.student_id,
            device_name="Test browser",
            created_at=datetime.now(timezone.utc),
            last_active_at=datetime.now(timezone.utc),
        ))
        self.db.add(SystemSetting(
            key="security",
            value=json.dumps({"requireStudentVerification": True}),
        ))
        self.db.commit()

        self.app = FastAPI()
        self.app.include_router(main_module.app.router)
        self.app.dependency_overrides[get_db] = lambda: self.db
        self.client = TestClient(self.app)
        self.secret_patch = patch.dict(
            os.environ,
            {"SESSION_SECRET": "student-verification-test-secret"},
        )
        self.secret_patch.start()
        self.authorization = {"Authorization": f"Bearer {self.token}"}

    def tearDown(self):
        self.secret_patch.stop()
        self.client.close()
        self.db.close()

    def test_unverified_students_cannot_post_listings(self):
        response = self.client.post(
            "/api/products",
            headers=self.authorization,
            data={
                "title": "Test listing",
                "category": "Books",
                "price": "10",
                "quantity": "1",
            },
        )

        self.assertEqual(response.status_code, 403, response.text)
        self.assertIn("Verify your student account", response.json()["detail"])

    def test_unverified_students_cannot_open_checkout(self):
        response = self.client.get(
            "/api/products/1/pay-summary",
            headers=self.authorization,
        )

        self.assertEqual(response.status_code, 403, response.text)
        self.assertIn("Verify your student account", response.json()["detail"])

    def test_unverified_students_cannot_submit_checkout(self):
        response = self.client.post(
            "/api/products/1/pay",
            headers={
                **self.authorization,
                "Idempotency-Key": "verification-test-123",
            },
            json={"password": "not-used", "quantity": 1},
        )

        self.assertEqual(response.status_code, 403, response.text)
        self.assertIn("Verify your student account", response.json()["detail"])

    def test_configured_password_minimum_is_enforced_during_registration(self):
        self.db.query(SystemSetting).filter_by(key="security").update({
            "value": json.dumps({
                "requireStudentVerification": True,
                "minPasswordLength": 12,
            }),
        })
        self.db.commit()

        response = self.client.post(
            "/api/register",
            json={
                "name": "New Student",
                "student_id": "MAU1600999",
                "email": "newstudent@university.edu.et",
                "password": "ShortPass1",
                "college": "Test College",
                "department": "Testing",
            },
        )

        self.assertEqual(response.status_code, 400, response.text)
        self.assertIn("at least 12 characters", response.json()["detail"])


if __name__ == "__main__":
    unittest.main()
