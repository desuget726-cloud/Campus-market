import os
import unittest
from datetime import datetime, timedelta
from unittest.mock import patch

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SESSION_SECRET", "seller-product-pagination-test-secret")

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import main as main_module
from app.database import Base
from app.models import Product, Student


class SellerProductPaginationTests(unittest.TestCase):
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
        database = cls.session_factory()
        try:
            yield database
        finally:
            database.close()

    def setUp(self):
        Base.metadata.drop_all(bind=self.engine)
        Base.metadata.create_all(bind=self.engine)
        self.db = self.session_factory()
        self.seller = Student(
            name="Seller One",
            student_id="seller-one",
            email="seller-one@example.test",
            password="test-password",
            college="Test College",
            department="Testing",
        )
        self.other_seller = Student(
            name="Seller Two",
            student_id="seller-two",
            email="seller-two@example.test",
            password="test-password",
            college="Test College",
            department="Testing",
        )
        self.db.add_all([self.seller, self.other_seller])
        self.db.flush()

        self.products = []
        first_created = datetime(2026, 1, 1)
        for index in range(25):
            status = "Approved" if index < 16 else "Sold" if index < 21 else "Pending"
            product = Product(
                title=f"Seller product {index + 1}",
                category="Test",
                price="10.00",
                stock=0 if status == "Sold" else 1,
                seller=self.seller.student_id,
                seller_id=self.seller.student_id,
                status=status,
                created_at=first_created + timedelta(
                    minutes=24 if index in {23, 24} else index
                ),
            )
            self.db.add(product)
            self.products.append(product)

        self.other_products = []
        for index in range(3):
            product = Product(
                title=f"Other seller product {index + 1}",
                category="Test",
                price="10.00",
                stock=1,
                seller=self.seller.name,
                seller_id=self.other_seller.student_id,
                status="Approved",
                created_at=first_created + timedelta(days=1, minutes=index),
            )
            self.db.add(product)
            self.other_products.append(product)
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def get_products(self, page=1, page_size=None):
        params = {"student_id": self.seller.student_id, "page": page}
        if page_size is not None:
            params["page_size"] = page_size
        with patch.object(main_module, "_student_from_authorization", return_value=self.seller):
            return self.client.get(
                "/api/student/seller/products",
                params=params,
                headers={"Authorization": "test-token"},
            )

    def test_returns_ten_items_on_first_page_and_five_on_third(self):
        first_page = self.get_products(1)
        third_page = self.get_products(3)

        self.assertEqual(first_page.status_code, 200, first_page.text)
        self.assertEqual(third_page.status_code, 200, third_page.text)
        self.assertEqual(len(first_page.json()["items"]), 10)
        self.assertEqual(len(third_page.json()["items"]), 5)
        self.assertEqual(first_page.json()["total_pages"], 3)
        self.assertEqual(first_page.json()["total"], 25)
        self.assertEqual(first_page.json()["page"], 1)
        self.assertEqual(third_page.json()["page"], 3)
        self.assertEqual(
            first_page.json()["items"][0]["id"],
            max(product.id for product in self.products),
        )

    def test_only_returns_the_authenticated_sellers_products(self):
        returned_ids = set()
        for page in range(1, 4):
            returned_ids.update(
                item["id"] for item in self.get_products(page).json()["items"]
            )

        self.assertEqual(returned_ids, {product.id for product in self.products})
        self.assertTrue(
            returned_ids.isdisjoint({product.id for product in self.other_products})
        )

    def test_summary_counts_cover_all_seller_products(self):
        response = self.get_products(1)

        self.assertEqual(
            response.json()["summary"],
            {"total": 25, "active": 16, "sold": 5, "pending": 4},
        )

    def test_invalid_pages_are_clamped_to_the_first_or_last_page(self):
        first_page = self.get_products(0).json()
        last_page = self.get_products(99).json()

        self.assertEqual(first_page["page"], 1)
        self.assertEqual(len(first_page["items"]), 10)
        self.assertEqual(last_page["page"], 3)
        self.assertEqual(len(last_page["items"]), 5)

    def test_page_size_is_capped_at_fifty(self):
        response = self.get_products(page_size=75).json()

        self.assertEqual(response["page_size"], 50)
        self.assertEqual(response["total_pages"], 1)
        self.assertEqual(len(response["items"]), 25)


if __name__ == "__main__":
    unittest.main()
