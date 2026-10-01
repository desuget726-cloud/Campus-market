import os
import unittest
from unittest.mock import patch

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["SESSION_SECRET"] = "product-ownership-test-secret"

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import main as main_module
from app.database import Base
from app.models import Product, Student, WishlistItem


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

    def test_seller_cannot_add_own_product_to_cart(self):
        payload = main_module.CartItemCreate(
            student_id=self.buyer.student_id,
            product_id=self.buyers_product.id,
            quantity=1,
        )
        with patch.object(main_module, "_student_from_authorization", return_value=self.buyer):
            with self.assertRaises(HTTPException) as error:
                main_module.add_to_cart(payload, authorization="Bearer test-token", db=self.db)

        self.assertEqual(error.exception.status_code, 400)
        self.assertEqual(error.exception.detail, main_module.PRODUCT_OWNERSHIP_ERROR)

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

        self.assertEqual(error.exception.status_code, 400)
        self.assertEqual(error.exception.detail, main_module.PRODUCT_OWNERSHIP_ERROR)
        self.assertEqual(self.db.query(WishlistItem).count(), 0)


if __name__ == "__main__":
    unittest.main()