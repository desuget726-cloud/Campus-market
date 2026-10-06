import os
import unittest
from datetime import datetime
from unittest.mock import patch

os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import main as main_module
from app.database import Base, get_db
from app.models import Order


class AdminSalesTrendEndpointTests(unittest.TestCase):
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
        now = datetime.now()
        current_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        self.db.add_all([
            Order(
                student_id="student-1",
                product_id=1,
                title="Paid completed order",
                price="ETB 1,200.50",
                quantity=2,
                pickup_code=1001,
                status="Completed",
                payment_status="Successful",
                paid_at=current_month,
            ),
            Order(
                student_id="student-2",
                product_id=2,
                title="USD paid completed order",
                price="USD 10",
                quantity=1,
                pickup_code=1002,
                status="Completed",
                payment_status="Paid",
                paid_at=current_month,
            ),
            Order(
                student_id="student-3",
                product_id=3,
                title="Unpaid completed order",
                price="ETB 500",
                quantity=1,
                pickup_code=1003,
                status="Completed",
                payment_status="Pending",
                paid_at=current_month,
            ),
            Order(
                student_id="student-4",
                product_id=4,
                title="Paid processing order",
                price="ETB 700",
                quantity=1,
                pickup_code=1004,
                status="Processing",
                payment_status="Successful",
                paid_at=current_month,
            ),
            Order(
                student_id="student-5",
                product_id=5,
                title="Pending order",
                price="ETB 900",
                quantity=1,
                pickup_code=1005,
                status="Pending",
                payment_status="Successful",
                paid_at=current_month,
            ),
        ])
        self.db.commit()

        self.app = FastAPI()
        self.app.include_router(main_module.app.router)
        self.app.dependency_overrides[get_db] = lambda: self.db
        self.client = TestClient(self.app)
        self.admin_session_patch = patch.object(
            main_module,
            "_admin_for_session",
            return_value=(object(), object()),
        )
        self.admin_session_patch.start()

    def tearDown(self):
        self.admin_session_patch.stop()
        self.client.close()
        self.db.close()

    def test_returns_exact_consecutive_months_and_only_paid_completed_sales(self):
        response = self.client.get(
            "/api/admin/analytics/sales-trend?months=6",
            headers={"Authorization": "Bearer test-admin-token"},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload), 6)
        self.assertEqual(
            [row["month"] for row in payload],
            sorted(row["month"] for row in payload),
        )
        self.assertTrue(all(len(row["month"]) == 7 for row in payload))
        self.assertTrue(all({"month", "label", "revenue", "orders"} <= row.keys() for row in payload))
        self.assertTrue(all(row["revenue"] == 0 and row["orders"] == 0 for row in payload[:-1]))
        self.assertEqual(payload[-1]["month"], datetime.now().strftime("%Y-%m"))
        self.assertEqual(payload[-1]["revenue"], 2961.0)
        self.assertEqual(payload[-1]["orders"], 2)

        twelve_month_response = self.client.get(
            "/api/admin/analytics/sales-trend?months=12",
            headers={"Authorization": "Bearer test-admin-token"},
        )
        self.assertEqual(twelve_month_response.status_code, 200)
        self.assertEqual(len(twelve_month_response.json()), 12)

    def test_requires_an_admin_session(self):
        response = self.client.get("/api/admin/analytics/sales-trend")

        self.assertEqual(response.status_code, 401)

    def test_order_status_breakdown_counts_every_database_status(self):
        with patch.dict(os.environ, {"CHAPA_SECRET_KEY": ""}):
            payload = main_module.get_admin_analytics(db=self.db)

        breakdown = {
            item["label"]: item
            for item in payload["orderStatus"]
        }
        self.assertEqual(breakdown["Completed"]["count"], 3)
        self.assertEqual(breakdown["Completed"]["value"], 60.0)
        self.assertEqual(breakdown["Processing"]["count"], 1)
        self.assertEqual(breakdown["Pending"]["count"], 1)
