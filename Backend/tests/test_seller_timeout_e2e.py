import json
import os
import unittest
from decimal import Decimal

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["SESSION_SECRET"] = "pay-at-handover-e2e-test-secret"

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import main as main_module
from app.database import Base
from app.models import Order, Product, Student, SystemSetting, Transaction, UserSession, Wallet
from app.password_security import hash_password


class PayWithoutOrderE2ETests(unittest.TestCase):
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
            student_id="buyer-e2e",
            email="buyer-e2e@example.test",
            password=hash_password("buyer-login-password"),
            has_password=True,
            wallet_balance=Decimal("500.00"),
            notif_order_email=False,
            notif_pay_email=False,
            is_verified=True,
        )
        self.seller = Student(
            name="Test Seller",
            student_id="seller-e2e",
            email="seller-e2e@example.test",
            password=hash_password("seller-login-password"),
            has_password=True,
            wallet_balance=Decimal("0.00"),
            notif_order_email=False,
            notif_pay_email=False,
        )
        self.product = Product(
            title="E2E Test Item",
            category="Test",
            price="100.00",
            stock=10,
            seller=self.seller.student_id,
            seller_id=self.seller.student_id,
            status="Approved",
        )
        self.db.add_all([
            self.buyer,
            self.seller,
            self.product,
            Wallet(student_id=self.buyer.student_id, balance=Decimal("500.00")),
            Wallet(student_id=self.seller.student_id, balance=Decimal("0.00")),
        ])
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def _student_token(self):
        session = UserSession(user_id=self.buyer.student_id, device_name="Test device")
        self.db.add(session)
        self.db.flush()
        token = main_module._create_session_token(
            self.buyer.student_id,
            "student",
            60,
            os.environ["SESSION_SECRET"],
            session_id=session.id,
        )
        self.db.commit()
        return token

    def test_buyer_who_does_not_pay_creates_no_order_or_transaction(self):
        headers = {"Authorization": f"Bearer {self._student_token()}"}
        response = self.client.get(
            f"/api/products/{self.product.id}/pay-summary",
            headers=headers,
        )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(self.db.query(Order).count(), 0)
        self.assertEqual(self.db.query(Transaction).count(), 0)
        self.assertEqual(
            self.db.query(Wallet).filter_by(student_id=self.buyer.student_id).one().balance,
            Decimal("500.00"),
        )
        self.assertEqual(self.db.get(Product, self.product.id).stock, 10)

    def test_student_verification_settings_save_reload_and_normalize_legacy_keys(self):
        saved = self.client.put("/api/admin/settings", json={
            "studentVerification": {
                "allowed_email_domain": "Mail.University.edu.et",
                "require_university_email": False,
                "auto_approve_students": True,
            },
        })
        self.assertEqual(saved.status_code, 200, saved.text)
        self.assertEqual(saved.json()["settings"]["studentVerification"], {
            "allowedEmailDomain": "mail.university.edu.et",
            "requireUniversityEmail": False,
            "autoApproveStudents": True,
        })

        reloaded = self.client.get("/api/admin/settings")
        self.assertEqual(reloaded.status_code, 200, reloaded.text)
        self.assertEqual(reloaded.json()["studentVerification"]["allowedEmailDomain"], "mail.university.edu.et")
        self.assertFalse(reloaded.json()["studentVerification"]["requireUniversityEmail"])
        self.assertTrue(reloaded.json()["studentVerification"]["autoApproveStudents"])

        camel_case_saved = self.client.put("/api/admin/settings", json={
            "studentVerification": {
                "allowedEmailDomain": "Students.Campus.edu.et",
                "requireUniversityEmail": True,
                "autoApproveStudents": False,
            },
        })
        self.assertEqual(camel_case_saved.status_code, 200, camel_case_saved.text)
        camel_case_reloaded = self.client.get("/api/admin/settings")
        self.assertEqual(camel_case_reloaded.json()["studentVerification"], {
            "allowedEmailDomain": "students.campus.edu.et",
            "requireUniversityEmail": True,
            "autoApproveStudents": False,
        })

        stored = self.db.query(SystemSetting).filter_by(key="studentVerification").one()
        stored.value = json.dumps({
            "allowed_email_domain": "Legacy.University.edu.et",
            "require_university_email": True,
            "auto_approve_students": False,
        })
        self.db.commit()
        legacy_reloaded = self.client.get("/api/admin/settings")
        self.assertEqual(legacy_reloaded.status_code, 200, legacy_reloaded.text)
        self.assertEqual(legacy_reloaded.json()["studentVerification"], {
            "allowedEmailDomain": "legacy.university.edu.et",
            "requireUniversityEmail": True,
            "autoApproveStudents": False,
        })

        invalid = self.client.put("/api/admin/settings", json={
            "studentVerification": {
                "allowedEmailDomain": "",
                "requireUniversityEmail": True,
                "autoApproveStudents": False,
            },
        })
        self.assertEqual(invalid.status_code, 400)
        self.assertIn("valid domain", invalid.json()["detail"])

    def test_health_and_public_products_are_available_to_vercel_guests(self):
        origin = "https://campus-market-gamma-eight.vercel.app"
        headers = {"Origin": origin}

        health = self.client.get("/health", headers=headers)
        self.assertEqual(health.status_code, 200, health.text)
        self.assertEqual(health.json(), {"status": "ok"})
        self.assertEqual(health.headers.get("access-control-allow-origin"), origin)

        products = self.client.get("/api/products", headers=headers)
        self.assertEqual(products.status_code, 200, products.text)
        self.assertIsInstance(products.json(), list)
        self.assertEqual(products.headers.get("access-control-allow-origin"), origin)
