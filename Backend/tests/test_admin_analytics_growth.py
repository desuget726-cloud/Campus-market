import os
import unittest
from datetime import datetime
from unittest.mock import patch

os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import main as main_module
from app.database import Base
from app.models import Order, Product, Student


class AdminAnalyticsGrowthTests(unittest.TestCase):
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
        self.now = datetime(2025, 5, 15, 12, 0)
        self.db.add(Student(
            name="Analytics Student",
            student_id="analytics-student",
            email="analytics@example.test",
            password="test-password",
            created_at=datetime(2025, 1, 1),
        ))
        self.db.flush()

    def tearDown(self):
        self.db.close()

    def get_growth(self):
        with patch.object(main_module, "_analytics_local_now", return_value=self.now):
            with patch.dict(os.environ, {"CHAPA_SECRET_KEY": ""}):
                return main_module.get_admin_analytics(period="30d", db=self.db)["growth"]

    def test_growth_compares_current_period_with_previous_equal_period(self):
        current_date = datetime(2025, 4, 20)
        previous_date = datetime(2025, 3, 20)
        self.db.add_all([
            Student(
                name=f"Current Student {index}",
                student_id=f"current-{index}",
                email=f"current-{index}@example.test",
                password="test-password",
                created_at=current_date,
            )
            for index in range(3)
        ])
        self.db.add_all([
            Student(
                name=f"Previous Student {index}",
                student_id=f"previous-{index}",
                email=f"previous-{index}@example.test",
                password="test-password",
                created_at=previous_date,
            )
            for index in range(2)
        ])
        products = [
            Product(title=f"Product {index}", category="Books", price="100", created_at=created_at)
            for index, created_at in enumerate([current_date, previous_date, previous_date])
        ]
        self.db.add_all(products)
        self.db.flush()
        self.db.add_all([
            Order(
                student_id="analytics-student",
                product_id=products[0].id,
                title="Current order",
                price="ETB 100",
                quantity=1,
                status="Completed",
                payment_status="Successful",
                created_at=current_date,
                paid_at=current_date,
                completed_at=current_date,
            ),
            Order(
                student_id="analytics-student",
                product_id=products[0].id,
                title="Current order two",
                price="ETB 200",
                quantity=1,
                status="Completed",
                payment_status="Successful",
                created_at=current_date,
                paid_at=current_date,
                completed_at=current_date,
            ),
            Order(
                student_id="analytics-student",
                product_id=products[1].id,
                title="Previous order",
                price="ETB 100",
                quantity=1,
                status="Completed",
                payment_status="Successful",
                created_at=previous_date,
                paid_at=previous_date,
                completed_at=previous_date,
            ),
        ])
        self.db.commit()

        growth = self.get_growth()

        self.assertEqual(growth["users"], {
            "value": 3.0, "previous_value": 2.0, "change_pct": 50.0, "trend": "up",
        })
        self.assertEqual(growth["products"], {
            "value": 1.0, "previous_value": 2.0, "change_pct": -50.0, "trend": "down",
        })
        self.assertEqual(growth["orders"], {
            "value": 2.0, "previous_value": 1.0, "change_pct": 100.0, "trend": "up",
        })
        self.assertEqual(growth["revenue"], {
            "value": 300.0, "previous_value": 100.0, "change_pct": 200.0, "trend": "up",
        })

    def test_zero_previous_period_returns_new_or_unavailable_trend(self):
        self.db.add(Student(
            name="New Student",
            student_id="new-student",
            email="new@example.test",
            password="test-password",
            created_at=datetime(2025, 4, 20),
        ))
        self.db.commit()

        growth = self.get_growth()

        self.assertEqual(growth["users"]["change_pct"], None)
        self.assertEqual(growth["users"]["trend"], "new")
        for metric in ("products", "orders", "revenue"):
            self.assertEqual(growth[metric]["change_pct"], None)
            self.assertEqual(growth[metric]["trend"], "unavailable")


if __name__ == "__main__":
    unittest.main()
