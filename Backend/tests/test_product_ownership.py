import os
import unittest
from unittest.mock import patch

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["SESSION_SECRET"] = "product-ownership-test-secret"

from fastapi import HTTPException, Request, Response
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import main as main_module
from app.database import Base
from app.models import CartItem, Dispute, Message, Order, Product, Student, WishlistItem


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

    def add_product(self, seller, title):
        product = Product(
            title=title,
            category="Test",
            price="10.00",
            stock=5,
            seller=seller,
            status="Approved",
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

    def product_detail_for(self, student):
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
        self.assertEqual(detail["stats"], {
            "views": 7,
            "wishlist_count": 1,
            "inquiries_count": 1,
            "cart_count": 2,
        })

    def test_non_owner_product_details_do_not_include_owner_stats(self):
        detail = self.product_detail_for(self.seller)

        self.assertFalse(detail["is_owner"])
        self.assertNotIn("stats", detail)
        self.assertNotIn("views", detail)

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