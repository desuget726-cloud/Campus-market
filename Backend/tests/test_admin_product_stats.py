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


class AdminProductStatsTests(unittest.TestCase):
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
        self.db.add_all([
            Product(title="Uppercase sold", category="Books", price="10", status="SOLD", stock=0),
            Product(title="Padded sold", category="Books", price="10", status=" sold ", stock=0),
            Product(title="Approved", category="Books", price="10", status="Approved", stock=1),
            Product(title="Active", category="Electronics", price="10", status="active", stock=1),
            Product(title="Pending", category="Books", price="10", status="Pending", stock=1),
            Product(title="Flagged", category="Electronics", price="10", status="Flagged", stock=1),
            Product(title="Hidden", category="Electronics", price="10", status="Hidden", stock=1),
        ])
        self.db.commit()

        self.app = FastAPI()
        self.app.include_router(main_module.app.router)
        self.app.dependency_overrides[get_db] = lambda: self.db
        self.client = TestClient(self.app)

    def tearDown(self):
        self.client.close()
        self.db.close()

    def test_counts_normalize_case_and_whitespace(self):
        response = self.client.get("/api/admin/products/stats")

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json(), {
            "total": 7,
            "available": 2,
            "sold": 2,
            "pending": 1,
            "flagged": 1,
        })

    def test_counts_respect_category_filter(self):
        response = self.client.get(
            "/api/admin/products/stats",
            params={"category": "Books"},
        )

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json(), {
            "total": 4,
            "available": 1,
            "sold": 2,
            "pending": 1,
            "flagged": 0,
        })


if __name__ == "__main__":
    unittest.main()
