import asyncio
import json
import os
import unittest
from datetime import datetime, timedelta
from decimal import Decimal
from unittest.mock import patch

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["SESSION_SECRET"] = "commission-fee-test-secret"

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import main as main_module
from app.commission_service import commission_fee_from_settings
from app.database import Base
from app.models import (
    CartItem,
    Order,
    Product,
    SellerPaymentAccount,
    Student,
    SystemSetting,
    Transaction,
    Wallet,
)


class CommissionFeeTests(unittest.TestCase):
    def fee(self, **overrides):
        settings = {
            "commission_enabled": True,
            "commission_type": "percentage",
            "commission_rate": "1.0",
            "commission_min_fee": None,
            "commission_max_fee": None,
        }
        settings.update(overrides)
        return commission_fee_from_settings(Decimal("1250.00"), settings)

    def test_disabled_commission_is_zero(self):
        self.assertEqual(self.fee(commission_enabled=False), Decimal("0.00"))

    def test_zero_rate_is_zero_even_with_minimum(self):
        self.assertEqual(
            self.fee(commission_rate="0", commission_min_fee="10"),
            Decimal("0.00"),
        )

    def test_percentage_rate_is_applied_to_subtotal(self):
        self.assertEqual(self.fee(), Decimal("12.50"))

    def test_fixed_rate_is_applied_as_amount(self):
        self.assertEqual(
            self.fee(commission_type="fixed", commission_rate="7.25"),
            Decimal("7.25"),
        )

    def test_minimum_and_maximum_apply_only_when_configured(self):
        self.assertEqual(self.fee(commission_min_fee="20"), Decimal("20.00"))
        self.assertEqual(self.fee(commission_max_fee="5"), Decimal("5.00"))
        self.assertEqual(
            self.fee(commission_enabled=False, commission_min_fee="20"),
            Decimal("0.00"),
        )


class CommissionCheckoutTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        cls.session_factory = sessionmaker(bind=cls.engine, autoflush=False, autocommit=False)
        cls.original_session_local = main_module.SessionLocal
        main_module.SessionLocal = cls.session_factory
        main_module.app.dependency_overrides[main_module.get_db] = cls._override_get_db
        cls.client = TestClient(main_module.app)
        Base.metadata.create_all(bind=cls.engine)

    @classmethod
    def tearDownClass(cls):
        cls.client.close()
        main_module.app.dependency_overrides.pop(main_module.get_db, None)
        main_module.SessionLocal = cls.original_session_local
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
        self.buyer = Student(
            name="Test Buyer",
            student_id="commission-buyer",
            email="commission-buyer@example.test",
            password="test-password",
            college="Test College",
            department="Testing",
            wallet_balance=Decimal("2000.00"),
            is_verified=True,
            notif_order_inapp=True,
            notif_order_email=False,
            notif_pay_inapp=True,
            notif_pay_email=False,
        )
        self.seller = Student(
            name="Test Seller",
            student_id="commission-seller",
            email="commission-seller@example.test",
            password="test-password",
            college="Test College",
            department="Testing",
            wallet_balance=Decimal("0.00"),
            notif_order_inapp=True,
            notif_order_email=False,
        )
        self.product = Product(
            title="Commission Test Item",
            category="Test",
            price="1250.00",
            stock=10,
            seller=self.seller.student_id,
            status="Approved",
        )
        self.seller_account = SellerPaymentAccount(
            student_id=self.seller.student_id,
            chapa_sub_account_id="test-sub-account",
            business_name="Test Seller",
            bank_code="TEST",
            account_name="Test Seller",
            account_status="Active",
        )
        self.wallet = Wallet(student_id=self.buyer.student_id, balance=Decimal("2000.00"))
        self.db.add_all([self.buyer, self.seller, self.product, self.seller_account, self.wallet])
        self.db.flush()
        self.db.add(CartItem(student_id=self.buyer.student_id, product_id=self.product.id, quantity=1))
        self._set_commission_settings()
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def _set_commission_settings(self, **overrides):
        commission = {
            "commission_enabled": True,
            "commission_type": "percentage",
            "commission_rate": "1.0",
            "commission_min_fee": None,
            "commission_max_fee": None,
        }
        commission.update(overrides)
        payment_setting = self.db.query(SystemSetting).filter(SystemSetting.key == "payment").first()
        value = {"commission": commission}
        if payment_setting:
            payment_setting.value = json.dumps(value)
        else:
            self.db.add(SystemSetting(key="payment", value=json.dumps(value)))
        self.db.flush()

    def _student_token(self):
        return main_module._create_session_token(
            self.buyer.student_id,
            "student",
            60,
            os.environ["SESSION_SECRET"],
        )

    def _checkout(self):
        response = self.client.post(
            "/api/student/cart/checkout",
            headers={"Authorization": f"Bearer {self._student_token()}"},
            json={"student_id": self.buyer.student_id, "platform_fee": 0},
        )
        self.assertEqual(response.status_code, 200, response.text)
        self.db.expire_all()
        return response.json(), self.db.query(Order).order_by(Order.id.desc()).first()

    def test_cart_preview_matches_server_checkout_and_client_fee_is_ignored(self):
        preview = self.client.get(f"/api/student/cart?student_id={self.buyer.student_id}").json()
        self.assertEqual(preview["platform_fee"], 12.5)
        self.assertEqual(preview["checkout_total"], 1262.5)

        result, order = self._checkout()

        self.assertEqual(result["platform_fee"], preview["platform_fee"])
        self.assertEqual(result["total"], preview["checkout_total"])
        self.assertEqual(Decimal(str(order.platform_fee)), Decimal("12.50"))
        self.assertEqual(Decimal(str(order.seller_commission)), Decimal("12.50"))
        hold = self.db.query(Transaction).filter(Transaction.type == "Escrow Hold").one()
        self.assertEqual(Decimal(str(hold.amount)), Decimal("1262.50"))

    def test_disabled_commission_charges_buyer_and_seller_zero(self):
        self._set_commission_settings(commission_enabled=False)
        self.db.commit()
        result, order = self._checkout()

        self.assertEqual(result["platform_fee"], 0)
        self.assertEqual(Decimal(str(order.platform_fee)), Decimal("0.00"))
        self.assertEqual(Decimal(str(order.seller_commission)), Decimal("0.00"))
        order.status = "Completed"
        order.buyer_confirmed = True
        order.seller_confirmed = True
        self.db.commit()
        seller_payout = main_module._release_escrow_funds(order.id, self.db)
        self.assertEqual(seller_payout, Decimal("1250.00"))

    def test_enabled_zero_rate_charges_zero(self):
        self._set_commission_settings(commission_rate="0")
        self.db.commit()
        result, order = self._checkout()

        self.assertEqual(result["platform_fee"], 0)
        self.assertEqual(Decimal(str(order.platform_fee)), Decimal("0.00"))
        self.assertEqual(Decimal(str(order.seller_commission)), Decimal("0.00"))

    def test_timeout_refund_returns_subtotal_plus_stored_fee(self):
        result, order = self._checkout()
        self.assertEqual(result["total"], 1262.5)
        order.seller_accept_deadline = datetime.now() - timedelta(seconds=1)
        self.db.commit()

        asyncio.run(main_module._process_seller_acceptance_deadlines())
        self.db.expire_all()
        refund = self.db.query(Transaction).filter(
            Transaction.type == "Refund",
            Transaction.description.like(f"%order #{order.id}%"),
        ).one()

        self.assertEqual(Decimal(str(refund.amount)), Decimal("1262.50"))
        self.assertEqual(self.db.query(Wallet).filter_by(student_id=self.buyer.student_id).one().balance, Decimal("2000.00"))

    def test_dispute_refund_returns_subtotal_plus_stored_fee(self):
        self._checkout()
        order = self.db.query(Order).one()

        refunded_amount = main_module.refund_escrow_funds(order.id, self.db)

        self.assertEqual(refunded_amount, Decimal("1262.50"))
        self.assertEqual(self.db.query(Wallet).filter_by(student_id=self.buyer.student_id).one().balance, Decimal("2000.00"))


if __name__ == "__main__":
    unittest.main()