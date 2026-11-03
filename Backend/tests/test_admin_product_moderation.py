import os
import unittest

os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import main as main_module
from app.database import Base, get_db
from app.models import Product


class AdminProductModerationTests(unittest.TestCase):
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
        self.app = FastAPI()
        self.app.include_router(main_module.app.router)
        self.app.dependency_overrides[get_db] = lambda: self.db
        self.client = TestClient(self.app)

    def tearDown(self):
        self.client.close()
        self.db.close()

    def _create_product(self, stock):
        product = Product(title="Moderation test", category="Books", price="10", status="Pending", stock=stock)
        self.db.add(product)
        self.db.commit()
        self.db.refresh(product)
        return product

    def test_put_approves_with_case_insensitive_status(self):
        product = self._create_product(stock=4)

        response = self.client.put(
            f"/api/admin/products/{product.id}",
            json={"status": "approved"},
        )

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["status"], "Approved")
        self.db.refresh(product)
        self.assertEqual(product.stock, 4)

    def test_put_approves_zero_stock_after_ensuring_minimum_stock(self):
        product = self._create_product(stock=0)

        response = self.client.put(
            f"/api/admin/products/{product.id}",
            json={"status": "Approved"},
        )

        self.assertEqual(response.status_code, 200, response.text)
        self.db.refresh(product)
        self.assertEqual(product.stock, 1)

    def test_put_pending_preserves_zero_stock(self):
        product = self._create_product(stock=0)

        response = self.client.put(
            f"/api/admin/products/{product.id}",
            json={"status": "Pending"},
        )

        self.assertEqual(response.status_code, 200, response.text)
        self.db.refresh(product)
        self.assertEqual(product.stock, 0)

    def test_put_logs_and_returns_invalid_status_detail(self):
        product = self._create_product(stock=0)

        with self.assertLogs(main_module.logger, level="WARNING") as captured:
            response = self.client.put(
                f"/api/admin/products/{product.id}",
                json={"status": "Unavailable"},
            )

        detail = "Invalid product moderation status."
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], detail)
        self.assertIn(detail, "\n".join(captured.output))


if __name__ == "__main__":
    unittest.main()
