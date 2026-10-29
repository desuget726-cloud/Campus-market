import os
import unittest
from unittest.mock import patch

os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import main as main_module
from app.database import Base
from app.models import Product, Student


class AdminUserGrowthTests(unittest.TestCase):
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

    def tearDown(self):
        self.db.close()

    def test_user_growth_contains_six_monthly_database_counts_and_zero_fills(self):
        current_month = main_module._analytics_local_now().replace(
            day=1, hour=0, minute=0, second=0, microsecond=0
        )
        month_starts = []
        for month_offset in range(5, -1, -1):
            month_index = current_month.month - month_offset
            year = current_month.year + (month_index - 1) // 12
            month = (month_index - 1) % 12 + 1
            month_starts.append(main_module.datetime(year, month, 1))

        self.db.add_all([
            Student(
                name=f"Growth Student {index}",
                student_id=f"growth-{index}",
                email=f"growth-{index}@example.test",
                password="test-password",
                created_at=month_starts[1],
            )
            for index in range(2)
        ])
        self.db.add_all([
            Product(
                title=f"Growth Product {index}",
                category="Books",
                price="10",
                created_at=month_starts[0],
            )
            for index in range(3)
        ])
        self.db.commit()

        with patch.dict(os.environ, {"CHAPA_SECRET_KEY": ""}):
            payload = main_module.get_admin_analytics(db=self.db)

        growth = payload["userGrowth"]
        self.assertEqual(len(growth), 6)
        self.assertEqual(
            growth,
            [
                {"month": month.strftime("%b %y"), "users": users, "products": products}
                for month, users, products in zip(
                    month_starts,
                    [0, 2, 0, 0, 0, 0],
                    [3, 0, 0, 0, 0, 0],
                )
            ],
        )
        self.assertEqual(payload["trends"]["user_growth"], [0, 2, 0, 0, 0, 0])
        self.assertEqual(payload["trends"]["product_uploads"], [3, 0, 0, 0, 0, 0])


if __name__ == "__main__":
    unittest.main()
