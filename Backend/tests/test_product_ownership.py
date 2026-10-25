import os
import unittest
from datetime import datetime, timedelta
from unittest.mock import patch

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["SESSION_SECRET"] = "product-ownership-test-secret"

from fastapi import HTTPException, Request, Response
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import main as main_module
from app.database import Base
from app.models import CartItem, Dispute, Message, Order, Product, ProductView, Review, Student, WishlistItem


class ProductOwnershipTests(unittest.TestCase):
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
        self.buyer = Student(
            name="Buyer One",
            student_id="buyer-one",
            email="buyer-one@example.test",
            password="test-password",
            college="Test College",
            department="Testing",
        )
        self.seller = Student(
            name="Seller Two",
            student_id="seller-two",
            email="seller-two@example.test",
            password="test-password",
            college="Test College",
            department="Testing",
        )
        self.db.add_all([self.buyer, self.seller])
        self.db.flush()
        self.buyers_product = self.add_product(self.buyer.student_id, "Buyer listing")
        self.legacy_name_product = self.add_product(self.buyer.name, "Legacy buyer listing")
        self.sellers_product = self.add_product(self.seller.student_id, "Seller listing")
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def add_product(self, seller, title, price="10.00", category="Test", stock=5, status="Approved"):
        product = Product(
            title=title,
            category=category,
            price=price,
            stock=stock,
            seller=seller,
            status=status,
        )
        self.db.add(product)
        self.db.flush()
        return product

    def products_for(self, student):
        with patch.object(main_module, "_student_from_authorization", return_value=student):
            return main_module.get_products(
                authorization="Bearer test-token",
                product_ids=None,
                db=self.db,
            )

    def test_authenticated_buyer_does_not_see_own_products_and_other_sellers_remain_visible(self):
        buyer_products = self.products_for(self.buyer)
        buyer_ids = {product["id"] for product in buyer_products}
        self.assertNotIn(self.buyers_product.id, buyer_ids)
        self.assertNotIn(self.legacy_name_product.id, buyer_ids)
        self.assertIn(self.sellers_product.id, buyer_ids)

        seller_products = self.products_for(self.seller)
        seller_ids = {product["id"] for product in seller_products}
        self.assertIn(self.buyers_product.id, seller_ids)
        self.assertIn(self.legacy_name_product.id, seller_ids)

    def test_guests_still_see_products_from_all_sellers(self):
        products = main_module.get_products(authorization=None, product_ids=None, db=self.db)
        product_ids = {product["id"] for product in products}
        self.assertEqual(product_ids, {
            self.buyers_product.id,
            self.legacy_name_product.id,
            self.sellers_product.id,
        })

    def test_products_remain_public_when_optional_authorization_is_expired(self):
        with patch.object(
            main_module,
            "_student_from_authorization",
            side_effect=HTTPException(status_code=401, detail="JWT token has expired."),
        ):
            products = main_module.get_products(
                authorization="Bearer expired-token",
                product_ids=None,
                db=self.db,
            )

        product_ids = {product["id"] for product in products}
        self.assertEqual(product_ids, {
            self.buyers_product.id,
            self.legacy_name_product.id,
            self.sellers_product.id,
        })

    def test_seller_cannot_add_own_product_to_cart(self):
        payload = main_module.CartItemCreate(
            student_id=self.buyer.student_id,
            product_id=self.buyers_product.id,
            quantity=1,
        )
        with patch.object(main_module, "_student_from_authorization", return_value=self.buyer):
            with self.assertRaises(HTTPException) as error:
                main_module.add_to_cart(payload, authorization="Bearer test-token", db=self.db)

        self.assertEqual(error.exception.status_code, 403)
        self.assertEqual(error.exception.detail, main_module.PRODUCT_OWNERSHIP_ERROR)

    def test_owner_can_update_stock_without_redundant_student_id(self):
        payload = main_module.StudentProductUpdate(quantity=0, status="Sold")

        with patch.object(main_module, "_student_from_authorization", return_value=self.buyer):
            result = main_module.update_student_product(
                self.buyers_product.id,
                payload,
                authorization="******",
                db=self.db,
            )

        self.assertTrue(result["success"])
        self.assertEqual(result["product"]["stock"], 0)
        self.assertEqual(result["product"]["status"], "Sold")

    def product_detail_for(self, student, request=None):
        if request is None:
            request = Request({
                "type": "http",
                "method": "GET",
                "path": f"/api/products/{self.buyers_product.id}",
                "headers": [],
                "query_string": b"",
                "server": ("testserver", 80),
                "client": ("testclient", 50000),
                "scheme": "http",
            })
        with patch.object(main_module, "_student_from_authorization", return_value=student):
            return main_module.get_product_detail(
                self.buyers_product.id,
                request,
                Response(),
                authorization="Bearer test-token",
                db=self.db,
            )

    def test_owner_product_details_include_owner_status_and_stats(self):
        self.db.add_all([
            WishlistItem(student_id=self.seller.student_id, product_id=self.buyers_product.id),
            CartItem(student_id=self.seller.student_id, product_id=self.buyers_product.id, quantity=2),
            Message(
                sender_id=self.seller.student_id,
                receiver_id=self.buyer.student_id,
                product_id=self.buyers_product.id,
                message_text="Is this available?",
            ),
        ])
        self.buyers_product.views = 7
        self.db.commit()

        detail = self.product_detail_for(self.buyer)

        self.assertTrue(detail["is_owner"])
        self.assertEqual(detail["views"], detail["stats"]["views"])
        self.assertEqual(detail["stats"], {
            "views": 7,
            "wishlist_count": 1,
            "inquiries_count": 1,
            "cart_count": 2,
        })

    def test_anonymous_product_details_do_not_include_seller_phone(self):
        self.buyer.phone = "0912345678"
        self.db.commit()

        anonymous_detail = self.product_detail_for(None)
        authenticated_detail = self.product_detail_for(self.seller)

        self.assertNotIn("seller_phone", anonymous_detail)
        self.assertEqual(authenticated_detail["seller_phone"], "0912345678")

    def test_anonymous_product_detail_endpoint_returns_public_fields(self):
        self.buyer.phone = "0912345678"
        self.db.commit()
        previous_override = main_module.app.dependency_overrides.get(main_module.get_db)

        def override_get_db():
            yield self.db

        main_module.app.dependency_overrides[main_module.get_db] = override_get_db
        try:
            with TestClient(main_module.app) as client:
                response = client.get(
                    f"/api/products/{self.buyers_product.id}",
                    headers={"Origin": "http://localhost:5173"},
                )
        finally:
            if previous_override is None:
                main_module.app.dependency_overrides.pop(main_module.get_db, None)
            else:
                main_module.app.dependency_overrides[main_module.get_db] = previous_override

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.headers.get("access-control-allow-origin"), "http://localhost:5173")
        detail = response.json()
        self.assertFalse(detail["is_owner"])
        self.assertNotIn("seller_phone", detail)
        self.assertNotIn("0912345678", response.text)
        self.assertNotIn("stats", detail)

    def test_unhandled_errors_are_logged_and_include_cors_headers(self):
        previous_override = main_module.app.dependency_overrides.get(main_module.get_db)

        def failing_get_db():
            raise RuntimeError("intentional unhandled test exception")

        main_module.app.dependency_overrides[main_module.get_db] = failing_get_db
        try:
            with self.assertLogs(level="ERROR"):
                with TestClient(main_module.app, raise_server_exceptions=False) as client:
                    response = client.get(
                        f"/api/products/{self.buyers_product.id}",
                        headers={"Origin": "http://localhost:5173"},
                    )
        finally:
            if previous_override is None:
                main_module.app.dependency_overrides.pop(main_module.get_db, None)
            else:
                main_module.app.dependency_overrides[main_module.get_db] = previous_override

        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.headers.get("access-control-allow-origin"), "http://localhost:5173")

    def test_product_views_exclude_owner_and_dedupe_authenticated_viewer_per_day(self):
        self.buyers_product.views = 4
        self.db.commit()

        owner_detail = self.product_detail_for(self.buyer)
        first_view = self.product_detail_for(self.seller)
        repeated_view = self.product_detail_for(self.seller)
        guest_request = Request({
            "type": "http",
            "method": "GET",
            "path": f"/api/products/{self.buyers_product.id}",
            "headers": [(b"cookie", b"campace_viewer=guest-one")],
            "query_string": b"",
            "server": ("testserver", 80),
            "client": ("testclient", 50000),
            "scheme": "http",
        })
        first_guest_view = self.product_detail_for(None, guest_request)
        repeated_guest_view = self.product_detail_for(None, guest_request)

        self.assertEqual(owner_detail["views"], 4)
        self.assertEqual(first_view["views"], 5)
        self.assertEqual(repeated_view["views"], 5)
        self.assertEqual(first_guest_view["views"], 6)
        self.assertEqual(repeated_guest_view["views"], 6)
        self.assertEqual(
            self.db.query(ProductView).filter(ProductView.product_id == self.buyers_product.id).count(),
            2,
        )

    def test_similar_products_use_fallbacks_and_active_stock(self):
        products = [
            self.add_product("another-seller", "Within lower bound", price="3.00"),
            self.add_product("another-seller", "Within upper bound", price="30.00"),
            self.add_product("another-seller", "Too cheap", price="2.99"),
            self.add_product("another-seller", "Too expensive", price="30.01"),
            self.add_product("another-seller", "Hidden", price="5.00", status="Paused"),
            self.add_product("another-seller", "Sold out", price="5.00", stock=0),
            self.add_product("another-seller", "Different category", price="5.00", category="Books"),
        ]
        self.db.commit()

        detail = self.product_detail_for(None)
        similar_ids = {item["id"] for item in detail["similar_products"]}

        self.assertEqual(similar_ids, {
            self.legacy_name_product.id,
            self.sellers_product.id,
            products[0].id,
            products[1].id,
            products[2].id,
            products[3].id,
            products[6].id,
        })

    def test_seller_trust_data_is_computed_across_completed_sales_and_messages(self):
        completed_orders = [
            Order(
                student_id=self.seller.student_id,
                product_id=self.buyers_product.id,
                title=f"Completed sale {index}",
                price="20.00",
                seller_id=self.buyer.student_id,
                quantity=quantity,
                status="Completed",
            )
            for index, quantity in enumerate((2, 3))
        ]
        self.db.add_all(completed_orders)
        self.db.flush()
        self.db.add_all([
            Review(order_id=completed_orders[0].id, student_id=self.seller.student_id, rating=5, comment="Great"),
            Review(order_id=completed_orders[1].id, student_id=self.seller.student_id, rating=3, comment="Good"),
        ])
        message_time = datetime.now() - timedelta(hours=2)
        self.db.add_all([
            Message(
                sender_id=self.seller.student_id,
                receiver_id=self.buyer.student_id,
                product_id=self.sellers_product.id,
                message_text="Is this available?",
                created_at=message_time,
            ),
            Message(
                sender_id=self.buyer.student_id,
                receiver_id=self.seller.student_id,
                product_id=self.sellers_product.id,
                message_text="Yes.",
                created_at=message_time + timedelta(minutes=30),
            ),
        ])
        self.db.commit()

        detail = self.product_detail_for(self.buyer)

        self.assertEqual(detail["seller_average_rating"], 4.0)
        self.assertEqual(detail["seller_review_count"], 2)
        self.assertEqual(detail["seller_items_sold"], 5)
        self.assertEqual(detail["seller_member_since"], self.buyer.created_at)
        self.assertIsNone(detail["seller_typical_response_bucket"])

    def test_more_from_seller_is_limited_to_four_active_other_products(self):
        listings = [
            self.add_product(self.buyer.student_id, f"Seller listing {index}")
            for index in range(6)
        ]
        self.add_product(self.buyer.student_id, "Hidden seller listing", status="Paused")
        self.add_product(self.buyer.student_id, "Sold-out seller listing", stock=0)
        self.db.commit()

        detail = self.product_detail_for(self.buyer)
        more_from_ids = {item["id"] for item in detail["more_from_seller"]}

        self.assertEqual(len(detail["more_from_seller"]), 4)
        self.assertNotIn(self.buyers_product.id, more_from_ids)
        self.assertTrue(more_from_ids.issubset({listing.id for listing in listings} | {self.legacy_name_product.id}))

    def test_owner_can_view_only_inquiries_for_their_product(self):
        inquiry = Message(
            sender_id=self.seller.student_id,
            receiver_id=self.buyer.student_id,
            product_id=self.buyers_product.id,
            message_text="Is this available?",
        )
        self.db.add_all([
            inquiry,
            Message(
                sender_id=self.buyer.student_id,
                receiver_id=self.seller.student_id,
                product_id=self.sellers_product.id,
                message_text="I am interested in your listing.",
            ),
        ])
        self.db.commit()

        with patch.object(main_module, "_student_from_authorization", return_value=self.buyer):
            result = main_module.get_product_inquiries(
                self.buyers_product.id,
                authorization="******",
                db=self.db,
            )

        self.assertEqual(result["product_id"], self.buyers_product.id)
        self.assertEqual([conversation["studentId"] for conversation in result["conversations"]], [
            self.seller.student_id,
        ])
        self.assertEqual(result["conversations"][0]["lastMessage"], "Is this available?")
        self.assertFalse(inquiry.is_read)

    def test_non_owner_cannot_view_product_inquiries(self):
        with patch.object(main_module, "_student_from_authorization", return_value=self.seller):
            with self.assertRaises(HTTPException) as error:
                main_module.get_product_inquiries(
                    self.buyers_product.id,
                    authorization="******",
                    db=self.db,
                )

        self.assertEqual(error.exception.status_code, 403)

    def test_non_owner_product_details_do_not_include_owner_stats(self):
        detail = self.product_detail_for(self.seller)

        self.assertFalse(detail["is_owner"])
        self.assertNotIn("stats", detail)
        self.assertEqual(detail["views"], self.buyers_product.views)

    def test_owner_cannot_pay_for_own_product(self):
        payload = main_module.ProductPaymentRequest(password="test-password", quantity=1)
        with patch.object(main_module, "_student_from_authorization", return_value=self.buyer):
            with self.assertRaises(HTTPException) as error:
                main_module.pay_for_product(
                    self.buyers_product.id,
                    payload,
                    Request({
                        "type": "http",
                        "method": "POST",
                        "path": f"/api/products/{self.buyers_product.id}/pay",
                        "headers": [],
                        "query_string": b"",
                        "server": ("testserver", 80),
                        "client": ("testclient", 50000),
                        "scheme": "http",
                    }),
                    idempotency_key="owner-test-key",
                    authorization="Bearer test-token",
                    db=self.db,
                )

        self.assertEqual(error.exception.status_code, 403)

    def test_owner_cannot_start_chat_about_own_product(self):
        request = main_module.ChatInitiateRequest(
            buyer_id=self.buyer.student_id,
            product_id=self.buyers_product.id,
        )
        with patch.object(main_module, "_student_from_authorization", return_value=self.buyer):
            with self.assertRaises(HTTPException) as error:
                main_module.initiate_chat(request, authorization="Bearer test-token", db=self.db)

        self.assertEqual(error.exception.status_code, 403)

    def test_owner_cannot_send_product_message_about_own_product(self):
        request = main_module.SendMessageRequest(
            sender_id=self.buyer.student_id,
            receiver_id=self.seller.student_id,
            product_id=self.buyers_product.id,
            message_text="Is this available?",
        )
        with patch.object(main_module, "_student_from_authorization", return_value=self.buyer):
            with self.assertRaises(HTTPException) as error:
                main_module.send_student_message(
                    request,
                    authorization="Bearer test-token",
                    db=self.db,
                )

        self.assertEqual(error.exception.status_code, 403)

    def test_owner_cannot_report_own_product(self):
        with patch.object(main_module, "_student_from_authorization", return_value=self.buyer):
            with self.assertRaises(HTTPException) as error:
                main_module.create_report(
                    student_name=self.buyer.name,
                    email=self.buyer.email,
                    category="Product Report",
                    issue="This listing is inappropriate.",
                    product_id=self.buyers_product.id,
                    student_id=self.buyer.student_id,
                    authorization="Bearer test-token",
                    db=self.db,
                )

        self.assertEqual(error.exception.status_code, 403)

    def test_seller_cannot_add_own_product_to_wishlist(self):
        payload = main_module.WishlistCreate(
            student_id=self.buyer.student_id,
            product_id=self.buyers_product.id,
        )
        with patch.object(main_module, "_student_from_authorization", return_value=self.buyer):
            with self.assertRaises(HTTPException) as error:
                main_module.create_wishlist_item(
                    payload,
                    authorization="Bearer test-token",
                    db=self.db,
                )

        self.assertEqual(error.exception.status_code, 403)
        self.assertEqual(error.exception.detail, main_module.PRODUCT_OWNERSHIP_ERROR)
        self.assertEqual(self.db.query(WishlistItem).count(), 0)

    def add_order(self, product, status):
        order = Order(
            student_id=self.seller.student_id,
            product_id=product.id,
            title=product.title,
            price=product.price,
            seller_id=product.seller,
            status=status,
        )
        self.db.add(order)
        self.db.flush()
        return order

    def delete_product_as_owner(self, product):
        with patch.object(main_module, "_student_from_authorization", return_value=self.buyer):
            return main_module.delete_student_product(
                product.id,
                authorization="Bearer test-token",
                db=self.db,
            )

    def test_delete_is_blocked_for_open_orders(self):
        self.add_order(self.buyers_product, "Processing")
        self.db.commit()

        with self.assertRaises(HTTPException) as error:
            self.delete_product_as_owner(self.buyers_product)

        self.assertEqual(error.exception.status_code, 409)
        self.assertIsNotNone(self.db.get(Product, self.buyers_product.id))

    def test_delete_is_blocked_for_open_disputes(self):
        order = self.add_order(self.buyers_product, "Completed")
        self.db.add(Dispute(
            order_id=order.id,
            buyer_id=self.seller.student_id,
            seller_id=self.buyer.student_id,
            reason="Item issue",
            description="The item was not as described.",
            previous_order_status="Completed",
            status="OPEN",
        ))
        self.db.commit()

        with self.assertRaises(HTTPException) as error:
            self.delete_product_as_owner(self.buyers_product)

        self.assertEqual(error.exception.status_code, 409)
        self.assertIsNotNone(self.db.get(Product, self.buyers_product.id))

    def test_delete_soft_deletes_product_with_closed_order_history(self):
        self.add_order(self.buyers_product, "Completed")
        self.db.commit()

        result = self.delete_product_as_owner(self.buyers_product)

        self.assertTrue(result["soft_deleted"])
        self.assertEqual(self.db.get(Product, self.buyers_product.id).status, "Hidden")
        self.assertEqual(self.db.get(Product, self.buyers_product.id).stock, 0)

    def test_delete_hard_deletes_product_without_order_history(self):
        result = self.delete_product_as_owner(self.buyers_product)

        self.assertFalse(result["soft_deleted"])
        self.assertIsNone(self.db.get(Product, self.buyers_product.id))


if __name__ == "__main__":
    unittest.main()