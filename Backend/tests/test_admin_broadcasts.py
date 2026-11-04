import os
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SESSION_SECRET", "admin-broadcast-test-secret")

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import main as main_module
from app.database import Base, get_db
from app.models import (
    Admin,
    BroadcastCampaign,
    EmailOutbox,
    Notification,
    Order,
    Product,
    Student,
)


class AdminBroadcastTests(unittest.TestCase):
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
        self.admin = Admin(
            username="broadcast-admin",
            email="admin@example.test",
            full_name="Broadcast Admin",
            password_hash="not-a-real-password",
            role="Admin",
        )
        self.seller = Student(
            name="Active Seller",
            student_id="STU-SELLER",
            email="seller@example.test",
            is_verified=True,
            password="not-a-real-password",
            department="Engineering",
            status="Active",
        )
        self.buyer = Student(
            name="Active Buyer",
            student_id="STU-BUYER",
            email="buyer@example.test",
            password="not-a-real-password",
            department="Engineering",
            status="Active",
        )
        self.other = Student(
            name="Other Student",
            student_id="STU-OTHER",
            email="other@example.test",
            password="not-a-real-password",
            department="Arts",
            status="Active",
        )
        self.suspended_seller = Student(
            name="Suspended Seller",
            student_id="STU-SUSPENDED",
            email="suspended@example.test",
            password="not-a-real-password",
            department="Engineering",
            status="Suspended",
        )
        self.db.add_all([self.admin, self.seller, self.buyer, self.other, self.suspended_seller])
        self.db.flush()
        product = Product(
            title="Campus book",
            category="Books",
            price="10",
            seller="Active Seller",
            seller_id=self.seller.student_id,
            status="Approved",
        )
        self.db.add(product)
        self.db.flush()
        self.db.add(Order(
            student_id=self.buyer.student_id,
            product_id=product.id,
            title=product.title,
            price=product.price,
            seller_id=self.seller.student_id,
        ))
        self.db.commit()

        self.app = FastAPI()
        self.app.include_router(main_module.app.router)
        self.app.dependency_overrides[get_db] = lambda: self.db
        self.client = TestClient(self.app)
        self.admin_access_patch = patch.object(
            main_module,
            "_require_admin_dashboard_access",
            return_value=self.admin,
        )
        self.admin_access_patch.start()

    def tearDown(self):
        self.admin_access_patch.stop()
        self.client.close()
        self.db.close()

    def test_broadcast_persists_campaign_and_targets_active_sellers(self):
        response = self.client.post("/api/admin/broadcasts", json={
            "title": "Seller update",
            "message": "A new seller policy is available.",
            "target": "active_sellers",
        })

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["campaign"]["target"], "Active Sellers Only")
        self.assertEqual(payload["campaign"]["delivery_channels"], ["in_app"])
        self.assertEqual(payload["campaign"]["recipient_count"], 1)
        self.assertEqual(
            [notification.student_id for notification in self.db.query(Notification).all()],
            [self.seller.student_id],
        )
        self.assertEqual(self.db.query(BroadcastCampaign).count(), 1)

        history = self.client.get("/api/admin/broadcasts")
        self.assertEqual(history.status_code, 200)
        self.assertEqual(history.json()[0]["read_rate"], 0)

    def test_admin_can_upload_broadcast_image_through_storage_service(self):
        image_url = "https://res.cloudinary.com/campus/image/upload/banner.png"
        with patch.object(main_module, "save_upload", return_value=image_url) as save_upload:
            response = self.client.post(
                "/api/admin/broadcasts/image",
                files={"image": ("banner.png", b"image-bytes", "image/png")},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"image_url": image_url})
        save_upload.assert_called_once()
        self.assertEqual(save_upload.call_args.args[1], "campace/broadcasts")

    def test_active_buyer_target_uses_buyers_with_orders(self):
        response = self.client.post("/api/admin/broadcasts", json={
            "title": "Buyer update",
            "message": "A new buyer feature is available.",
            "target": "active_buyers",
            "deliveryChannels": ["in_app"],
        })

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            {notification.student_id for notification in self.db.query(Notification).all()},
            {self.buyer.student_id},
        )

    def test_department_banner_and_email_channels_are_persisted_and_delivered(self):
        response = self.client.post("/api/admin/broadcasts", json={
            "title": "Engineering notice",
            "message": "The lab will close early today.",
            "image_url": "https://res.cloudinary.com/campus/image/upload/lab.png",
            "target": "department",
            "department": "Engineering",
            "deliveryChannels": ["in_app", "banner", "email"],
        })

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["campaign"]["target"], "Specific Department: Engineering")
        self.assertEqual(payload["campaign"]["recipient_count"], 2)
        self.assertEqual(payload["email_queued_count"], 1)
        self.assertEqual(self.db.query(Notification).count(), 2)
        self.assertEqual(self.db.query(EmailOutbox).count(), 1)
        campaign = self.db.query(BroadcastCampaign).one()
        self.assertEqual(campaign.image_url, "https://res.cloudinary.com/campus/image/upload/lab.png")
        self.assertEqual({notification.image_url for notification in self.db.query(Notification).all()}, {campaign.image_url})
        self.assertIn(campaign.image_url, self.db.query(EmailOutbox).one().body)
        self.assertTrue(campaign.is_active)
        self.assertTrue(campaign.banner_pinned)

        with patch.object(main_module, "_student_from_authorization", return_value=self.seller):
            banner_response = self.client.get(
                "/api/student/announcements/urgent?student_id=STU-SELLER",
                headers={"Authorization": "Bearer student-token"},
            )
        self.assertEqual(banner_response.status_code, 200)
        self.assertEqual(banner_response.json()["title"], "Engineering notice")
        self.assertEqual(banner_response.json()["image_url"], campaign.image_url)
        self.assertEqual(self.client.get("/api/announcements/active").json(), [])

    def test_public_active_endpoint_returns_only_active_pinned_everyone_announcements(self):
        response = self.client.post("/api/admin/broadcasts", json={
            "title": "Campus update",
            "message": "The student center is open.",
            "target": "everyone",
            "deliveryChannels": ["banner"],
        })

        self.assertEqual(response.status_code, 200)
        announcements = self.client.get("/api/announcements/active").json()
        self.assertEqual(len(announcements), 1)
        self.assertEqual(announcements[0]["title"], "Campus update")
        self.assertIn("created_at", announcements[0])
        self.assertTrue(announcements[0]["created_at"].endswith("+00:00"))
        self.assertTrue(announcements[0]["banner_pinned"])
        self.assertTrue(announcements[0]["urgent_banner"])

        campaign = self.db.query(BroadcastCampaign).one()
        campaign.is_active = False
        self.db.commit()
        self.assertEqual(self.client.get("/api/announcements/active").json(), [])

    def test_expired_broadcast_is_not_returned_by_public_or_targeted_endpoints(self):
        response = self.client.post("/api/admin/broadcasts", json={
            "title": "Old campus update",
            "message": "This update is outside its retention window.",
            "target": "everyone",
            "deliveryChannels": ["banner"],
        })
        self.assertEqual(response.status_code, 200)
        campaign = self.db.query(BroadcastCampaign).one()
        campaign.sent_at = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=72, minutes=1)
        self.db.commit()

        self.assertEqual(self.client.get("/api/announcements/active").json(), [])
        with patch.object(main_module, "_student_from_authorization", return_value=self.seller):
            targeted_response = self.client.get(
                "/api/student/announcements/urgent?student_id=STU-SELLER",
                headers={"Authorization": "Bearer student-token"},
            )
        self.assertIsNone(targeted_response.json())

    def test_admin_delete_removes_campaign_from_active_announcements(self):
        response = self.client.post("/api/admin/broadcasts", json={
            "title": "Delete this update",
            "message": "It should disappear immediately.",
            "target": "everyone",
            "deliveryChannels": ["banner"],
        })
        campaign_id = response.json()["campaign"]["id"]

        delete_response = self.client.delete(f"/api/admin/broadcasts/{campaign_id}")

        self.assertEqual(delete_response.status_code, 200)
        self.assertEqual(self.db.query(BroadcastCampaign).count(), 0)
        self.assertEqual(self.client.get("/api/announcements/active").json(), [])

    def test_email_delivery_is_queued_only_for_verified_recipients(self):
        with patch.object(main_module, "_schedule_outbox_delivery") as schedule_delivery:
            response = self.client.post("/api/admin/broadcasts", json={
                "title": "Campus update",
                "message": "A verified-recipient email.",
                "target": "everyone",
                "deliveryChannels": ["email"],
            })

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["email_queued_count"], 1)
        self.assertEqual(self.db.query(EmailOutbox).count(), 1)
        schedule_delivery.assert_called_once()
        self.assertIsNotNone(schedule_delivery.call_args.args[0])

    def test_specific_department_broadcast_does_not_include_other_departments(self):
        response = self.client.post("/api/admin/broadcasts", json={
            "title": "Engineering update",
            "message": "For Engineering students only.",
            "target": "department",
            "department": "Engineering",
            "deliveryChannels": ["in_app"],
        })

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            {notification.student_id for notification in self.db.query(Notification).all()},
            {self.seller.student_id, self.buyer.student_id},
        )


if __name__ == "__main__":
    unittest.main()
