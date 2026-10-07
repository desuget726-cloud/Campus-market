import os
import unittest
from unittest.mock import patch

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["SESSION_SECRET"] = "student-recommendations-test-secret"

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import main as main_module
from app.database import Base
from app.models import Product, Student


class StudentRecommendationsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        cls.session_factory = sessionmaker(bind=cls.engine, autoflush=False, autocommit=False)
        cls.original_session_local = main_module.SessionLocal
        cls.original_init_db = main_module.init_db
        main_module.SessionLocal = cls.session_factory
        main_module.init_db = lambda: Base.metadata.create_all(bind=cls.engine)
        main_module.app.dependency_overrides[main_module.get_db] = cls._override_get_db
        cls.client = TestClient(main_module.app)

    @classmethod
    def tearDownClass(cls):
        cls.client.close()
        main_module.app.dependency_overrides.pop(main_module.get_db, None)
        main_module.SessionLocal = cls.original_session_local
        main_module.init_db = cls.original_init_db
        cls.engine.dispose()

    @classmethod
    def _override_get_db(cls):
        db = cls.session_factory()
        try:
            yield db
        finally:
            db.close()

    def setUp(self):
        Base.metadata.drop_all(bind=self.engine)
        Base.metadata.create_all(bind=self.engine)
        self.db = self.session_factory()
        self.student = Student(
            name="No Department",
            student_id="no-department",
            email="no-department@example.test",
            password="test-only",
            college=None,
            department=None,
        )
        self.db.add(self.student)
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def test_missing_department_and_college_use_category_fallback(self):
        product = Product(
            title="Campus Textbook",
            category="Books",
            subcategory=None,
            price="25.00",
            stock=1,
            description=None,
            seller=None,
            image=None,
            status="Approved",
        )
        self.db.add(product)
        self.db.commit()

        with patch.object(
            main_module,
            "_student_interest_text",
            side_effect=RuntimeError("recommendation scorer unavailable"),
        ):
            response = self.client.get(
                f"/api/student/recommendations?student_id={self.student.student_id}"
            )

        self.assertEqual(response.status_code, 200, response.text)
        recommendations = response.json()
        self.assertEqual(len(recommendations), 1)
        self.assertEqual(recommendations[0]["category"], "Books")
        self.assertEqual(recommendations[0]["reason"], "Recommended from Books listings")

    def test_empty_approved_product_list_returns_empty_recommendations(self):
        response = self.client.get(
            f"/api/student/recommendations?student_id={self.student.student_id}"
        )

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json(), [])

    def test_unexpected_failure_returns_json_500(self):
        with patch.object(
            main_module,
            "_get_setting_value",
            side_effect=RuntimeError("unexpected recommendation failure"),
        ):
            response = self.client.get(
                f"/api/student/recommendations?student_id={self.student.student_id}"
            )

        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.headers["content-type"], "application/json")
        self.assertIn("Unable to load recommendations", response.json()["detail"])


if __name__ == "__main__":
    unittest.main()
