import os
import unittest
from datetime import datetime, timedelta, timezone

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["SESSION_SECRET"] = "similar-products-test-secret"

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import main as main_module
from app.database import Base
from app.models import Message, Product, Student


class SimilarProductsTests(unittest.TestCase):
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
        self.seller = Student(
            name="Similar Seller",
            student_id="similar-seller",
            email="similar-seller@example.test",
            password="not-used-in-this-test",
        )
        self.db.add(self.seller)
        self.db.flush()
        self.current_product = self.add_product(
            "Current listing",
            seller=self.seller.student_id,
            seller_id=self.seller.student_id,
            price="1000",
            subcategory="Phones",
        )
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def add_product(
        self,
        title,
        *,
        seller="another-seller",
        seller_id=None,
        price="1000",
        category="Electronics",
        subcategory="Phones",
        stock=5,
        status="Approved",
        created_at=None,
    ):
        product = Product(
            title=title,
            category=category,
            subcategory=subcategory,
            price=price,
            stock=stock,
            seller=seller,
            seller_id=seller_id,
            status=status,
            description="Must not be returned by the similar-products endpoint.",
            pickup_location="Private pickup details",
            created_at=created_at or datetime(2026, 1, 1),
        )
        self.db.add(product)
        self.db.flush()
        return product

    def test_anonymous_request_uses_fallback_ladder_and_returns_public_fields(self):
        farther_subcategory_match = self.add_product("Farther subcategory match", price="1200")
        closest_subcategory_match = self.add_product("Closest subcategory match", price="900")
        same_seller_category_match = self.add_product(
            "Same seller category match",
            seller=self.seller.student_id,
            seller_id=self.seller.student_id,
            price="1010",
            subcategory="Accessories",
        )
        out_of_range_category_match = self.add_product(
            "Out of range category match",
            seller=self.seller.name,
            price="5000",
            subcategory="Accessories",
        )
        newest_other_category = self.add_product(
            "Newest other category",
            category="Books",
            created_at=datetime(2026, 1, 3),
        )
        older_other_category = self.add_product(
            "Older other category",
            category="Furniture",
            created_at=datetime(2026, 1, 2),
        )
        self.add_product("Hidden listing", status="Hidden")
        self.add_product("Sold listing", status="Sold", stock=0)
        self.add_product("Soft deleted listing", status="Deleted")
        self.db.commit()

        response = self.client.get(
            f"/api/products/{self.current_product.id}/similar",
            headers={},
        )

        self.assertEqual(response.status_code, 200, response.text)
        products = response.json()
        returned_ids = [item["id"] for item in products]
        self.assertEqual(
            returned_ids,
            [
                closest_subcategory_match.id,
                farther_subcategory_match.id,
                same_seller_category_match.id,
                out_of_range_category_match.id,
                newest_other_category.id,
                older_other_category.id,
            ],
        )
        self.assertNotIn(self.current_product.id, returned_ids)
        self.assertEqual(
            set(products[0]),
            {"id", "title", "price", "image", "category", "status"},
        )

    def test_returns_only_same_category_product_when_its_price_is_out_of_range(self):
        out_of_range_product = self.add_product(
            "Only category match",
            price="5000",
            subcategory="Accessories",
        )
        self.db.commit()

        response = self.client.get(
            f"/api/products/{self.current_product.id}/similar",
            headers={},
        )

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual([item["id"] for item in response.json()], [out_of_range_product.id])

    def test_excludes_hidden_sold_out_and_soft_deleted_products(self):
        hidden_product = self.add_product("Hidden listing", status="Hidden")
        sold_status_product = self.add_product("Sold listing", status="Sold", stock=0)
        sold_out_product = self.add_product("Sold out listing", stock=0)
        deleted_product = self.add_product("Soft deleted listing", status="Deleted")
        active_product = self.add_product("Active fallback", category="Books")
        self.db.commit()

        response = self.client.get(f"/api/products/{self.current_product.id}/similar")

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual([item["id"] for item in response.json()], [active_product.id])
        excluded_ids = {
            self.current_product.id,
            hidden_product.id,
            sold_status_product.id,
            sold_out_product.id,
            deleted_product.id,
        }
        self.assertTrue(excluded_ids.isdisjoint(
            item["id"] for item in response.json()
        ))

    def test_orders_by_price_then_newest_limits_to_eight_and_returns_no_seller_data(self):
        nearer = self.add_product("Nearer price", price="1100")
        older_tie = self.add_product(
            "Older price tie",
            price="1200",
            created_at=datetime(2026, 1, 1),
        )
        newer_tie = self.add_product(
            "Newer price tie",
            price="1200",
            created_at=datetime(2026, 1, 2),
        )
        for index in range(9):
            self.add_product(f"Extra listing {index}", price=str(1400 + index))
        self.db.commit()

        response = self.client.get(f"/api/products/{self.current_product.id}/similar")

        self.assertEqual(response.status_code, 200, response.text)
        products = response.json()
        self.assertEqual(len(products), 8)
        self.assertEqual(
            [products[index]["id"] for index in range(3)],
            [nearer.id, newer_tie.id, older_tie.id],
        )
        self.assertEqual(products[0]["price"], 1100)
        self.assertEqual(
            set(products[0]),
            {"id", "title", "price", "image", "category", "status"},
        )
        self.assertFalse({
            "seller",
            "seller_id",
            "seller_name",
            "description",
            "pickup_location",
        } & set(products[0]))

    def test_missing_product_returns_not_found(self):
        response = self.client.get("/api/products/999999/similar")

        self.assertEqual(response.status_code, 404)

    def add_conversation(self, buyer_index, started_at, reply_hours=None, seller_started=False):
        buyer = Student(
            name=f"Response Buyer {buyer_index}",
            student_id=f"response-buyer-{buyer_index}",
            email=f"response-buyer-{buyer_index}@example.test",
            password="not-used-in-this-test",
        )
        self.db.add(buyer)
        self.db.flush()
        first_message = Message(
            sender_id=self.seller.student_id if seller_started else buyer.student_id,
            receiver_id=buyer.student_id if seller_started else self.seller.student_id,
            product_id=self.current_product.id,
            message_text="Conversation started",
            created_at=started_at,
        )
        self.db.add(first_message)
        self.db.flush()
        if reply_hours is not None:
            reply = Message(
                sender_id=buyer.student_id if seller_started else self.seller.student_id,
                receiver_id=self.seller.student_id if seller_started else buyer.student_id,
                product_id=self.current_product.id,
                message_text="First seller response",
                created_at=started_at + timedelta(hours=reply_hours),
            )
            self.db.add(reply)
            self.db.flush()
            if not seller_started:
                self.db.add(Message(
                    sender_id=buyer.student_id,
                    receiver_id=self.seller.student_id,
                    product_id=self.current_product.id,
                    message_text="Follow-up",
                    created_at=reply.created_at + timedelta(hours=1),
                ))
                self.db.add(Message(
                    sender_id=self.seller.student_id,
                    receiver_id=buyer.student_id,
                    product_id=self.current_product.id,
                    message_text="Later seller response must not count",
                    created_at=reply.created_at + timedelta(hours=1, minutes=1),
                ))

    def test_response_bucket_uses_median_first_reply_and_ignores_unanswered_or_seller_started_chats(self):
        now = datetime(2026, 10, 25, 12, 0)
        intervals = [1, 6, 100]
        for index, hours in enumerate(intervals):
            self.add_conversation(index, now - timedelta(days=1, hours=hours), hours)
        self.add_conversation(10, now - timedelta(hours=12), reply_hours=None)
        self.add_conversation(11, now - timedelta(hours=12), reply_hours=1, seller_started=True)
        self.db.commit()

        bucket = main_module._seller_typical_response_bucket(
            self.db,
            self.seller.student_id,
            now.replace(tzinfo=timezone.utc),
        )

        self.assertEqual(bucket, "responseWithinFewHours")

    def test_product_detail_returns_response_bucket_and_null_when_too_few_replies(self):
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        for index, hours in enumerate((1, 6, 100)):
            self.add_conversation(
                index,
                now - timedelta(days=1, hours=hours),
                hours,
            )
        self.db.commit()

        response = self.client.get(f"/api/products/{self.current_product.id}")

        self.assertEqual(response.status_code, 200, response.text)
        detail = response.json()
        self.assertEqual(detail["seller_typical_response_bucket"], "responseWithinFewHours")
        self.assertNotIn("seller_typical_response_time_hours", detail)

        self.db.query(Message).delete()
        self.db.query(Student).filter(Student.student_id != self.seller.student_id).delete()
        self.db.commit()
        for index, hours in enumerate((1, 2)):
            self.add_conversation(index, now - timedelta(days=1, hours=hours), hours)
        self.db.commit()

        response = self.client.get(f"/api/products/{self.current_product.id}")

        self.assertEqual(response.status_code, 200, response.text)
        self.assertIsNone(response.json()["seller_typical_response_bucket"])

    def test_response_bucket_thresholds_and_fewer_than_three_replies(self):
        now = datetime(2026, 10, 25, 12, 0)
        scenarios = [
            ([0.5, 0.6, 0.8], "responseUnderHour"),
            ([1, 5, 6], "responseWithinFewHours"),
            ([6, 12, 24], "responseWithinDay"),
            ([24, 48, 72], "responseWithinFewDays"),
        ]
        buyer_index = 20
        for intervals, expected_bucket in scenarios:
            for hours in intervals:
                self.add_conversation(
                    buyer_index,
                    now - timedelta(days=1, hours=hours),
                    hours,
                )
                buyer_index += 1
            self.db.commit()
            self.assertEqual(
                main_module._seller_typical_response_bucket(
                    self.db,
                    self.seller.student_id,
                    now.replace(tzinfo=timezone.utc),
                ),
                expected_bucket,
            )
            self.db.query(Message).delete()
            self.db.query(Student).filter(Student.student_id != self.seller.student_id).delete()
            self.db.commit()

        for index, hours in enumerate((1, 2)):
            self.add_conversation(index, now - timedelta(days=1, hours=hours), hours)
        self.db.commit()
        self.assertIsNone(main_module._seller_typical_response_bucket(
            self.db,
            self.seller.student_id,
            now.replace(tzinfo=timezone.utc),
        ))


if __name__ == "__main__":
    unittest.main()
