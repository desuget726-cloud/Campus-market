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

    def test_anonymous_recommendations_include_owner_listings(self):
        owner_a = Product(
            title="Owner product A",
            category="Books",
            price="10",
            stock=1,
            seller=self.student.student_id,
            seller_id=self.student.student_id,
            status="Approved",
        )
        owner_b = Product(
            title="Owner product B",
            category="Books",
            price="12",
            stock=1,
            seller=self.student.student_id,
            seller_id=self.student.student_id,
            status="Approved",
        )
        self.db.add_all([owner_a, owner_b])
        self.db.commit()

        response = self.client.get(
            f"/api/student/recommendations?student_id={self.student.student_id}"
        )

        self.assertEqual(response.status_code, 200, response.text)
        returned_ids = {recommendation["id"] for recommendation in response.json()}
        self.assertTrue({owner_a.id, owner_b.id}.issubset(returned_ids))

    def test_authenticated_recommendations_exclude_owner_products(self):
        owner_a = Product(
            title="Owner product A",
            category="Books",
            price="10",
            stock=1,
            seller=self.student.student_id,
            seller_id=self.student.student_id,
            status="Approved",
        )
        owner_b = Product(
            title="Owner product B",
            category="Books",
            price="12",
            stock=1,
            seller=self.student.student_id,
            seller_id=self.student.student_id,
            status="Approved",
        )
        public_product = Product(
            title="Public textbook",
            category="Books",
            price="14",
            stock=1,
            seller="another-student",
            status="Approved",
        )
        self.db.add_all([owner_a, owner_b, public_product])
        self.db.commit()

        with patch.object(
            main_module,
            "_student_from_authorization",
            return_value=self.student,
        ):
            response = self.client.get(
                f"/api/student/recommendations?student_id={self.student.student_id}",
                headers={"Authorization": "Bearer valid-test-token"},
            )

        self.assertEqual(response.status_code, 200, response.text)
        returned_ids = {recommendation["id"] for recommendation in response.json()}
        self.assertTrue({owner_a.id, owner_b.id}.isdisjoint(returned_ids))
        self.assertIn(public_product.id, returned_ids)

    def test_cached_recommendations_are_filtered_when_read(self):
        own_product = Product(
            title="Cached owner product",
            category="Books",
            price="10",
            stock=1,
            seller=self.student.student_id,
            seller_id=self.student.student_id,
            status="Approved",
        )
        public_product = Product(
            title="Cached public product",
            category="Books",
            price="12",
            stock=1,
            seller="another-student",
            status="Approved",
        )
        self.db.add_all([own_product, public_product])
        self.db.commit()

        filtered = main_module._filter_public_recommendations(
            [{"id": own_product.id}, {"id": public_product.id}],
            self.student,
            self.db,
        )

        self.assertEqual(filtered, [{"id": public_product.id}])

    def test_anonymous_cached_recommendations_still_exclude_inactive_products(self):
        active_product = Product(
            title="Cached active product",
            category="Books",
            price="10",
            stock=1,
            seller=self.student.student_id,
            seller_id=self.student.student_id,
            status="Approved",
        )
        hidden_product = Product(
            title="Cached hidden product",
            category="Books",
            price="12",
            stock=1,
            seller="another-student",
            status="Hidden",
        )
        self.db.add_all([active_product, hidden_product])
        self.db.commit()

        filtered = main_module._filter_public_recommendations(
            [{"id": active_product.id}, {"id": hidden_product.id}],
            None,
            self.db,
        )

        self.assertEqual(filtered, [{"id": active_product.id}])

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
