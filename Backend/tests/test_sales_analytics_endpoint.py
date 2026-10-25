import os
import unittest
from datetime import datetime
from unittest.mock import patch

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SESSION_SECRET", "seller-sales-analytics-test-secret")

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import main as main_module
from app.database import Base
from app.models import Order, Product, Student


class SellerSalesAnalyticsEndpointTests(unittest.TestCase):
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
        )
        self.other_seller = Student(
            name="Seller Two",
            student_id="seller-two",
            email="seller-two@example.test",
            password="test-password",
        )
        self.buyer = Student(
            name="Buyer",
            student_id="buyer",
            email="buyer@example.test",
            password="test-password",
        )
        self.db.add_all([self.seller, self.other_seller, self.buyer])
        self.db.flush()

        self.seller_product = self.add_product(self.seller, "Seller product")
        self.other_product = self.add_product(self.other_seller, "Other product")
        self.db.flush()

        self.add_order(self.seller_product, "Completed", 20, datetime(2026, 10, 25, 9))
        self.add_order(self.seller_product, "Successful", 30, datetime(2026, 10, 4, 9))
        self.add_order(self.seller_product, "Delivered", 40, datetime(2026, 8, 15, 9))
        self.add_order(
            self.other_product,
            "Completed",
            999,
            datetime(2026, 10, 25, 10),
            seller_id=self.seller.student_id,
        )
        self.add_order(self.seller_product, "Processing", 500, datetime(2026, 10, 25, 11))
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def add_product(self, seller, title):
        product = Product(
            title=title,
            category="Test",
            price="10.00",
            stock=1,
            seller=seller.student_id,
            seller_id=seller.student_id,
            status="Approved",
        )
        self.db.add(product)
        self.db.flush()
        return product

    def add_order(self, product, status, price, completed_at, seller_id=None):
        order = Order(
            student_id=self.buyer.student_id,
            product_id=product.id,
            title=product.title,
            price=str(price),
            quantity=1,
            seller_id=seller_id or product.seller_id,
            status=status,
            created_at=completed_at,
            completed_at=completed_at,
        )
        self.db.add(order)

    def fetch_range(self, period):
        with (
            patch.object(
                main_module,
                "_student_from_authorization",
                return_value=self.seller,
            ),
            patch.object(
                main_module,
                "analytics_local_now",
                return_value=datetime(2026, 10, 25, 12),
            ),
        ):
            return self.client.get(
                "/api/student/seller/sales-analytics",
                params={"range": period},
                headers={"Authorization": "test-token"},
            )

    def test_all_ranges_return_zero_filled_buckets_and_only_sellers_completed_orders(self):
        expected = {
            "7d": {"buckets": 7, "orders": 1, "revenue": 20},
            "30d": {"buckets": 30, "orders": 2, "revenue": 50},
            "3m": {"buckets": 3, "orders": 3, "revenue": 90},
        }

        for period, totals in expected.items():
            with self.subTest(period=period):
                response = self.fetch_range(period)
                self.assertEqual(response.status_code, 200, response.text)
                data = response.json()
                self.assertEqual(len(data["labels"]), totals["buckets"])
                self.assertEqual(len(data["values"]), totals["buckets"])
                self.assertEqual(len(data["points"]), totals["buckets"])
                self.assertEqual(data["stats"]["total_orders"], totals["orders"])
                self.assertEqual(data["stats"]["total_revenue"], totals["revenue"])
                self.assertEqual(data["totals"], {
                    "revenue": totals["revenue"],
                    "orders": totals["orders"],
                })
                self.assertEqual(sum(data["values"]), totals["revenue"])
                self.assertTrue(any(value == 0 for value in data["values"]))


if __name__ == "__main__":
    unittest.main()
