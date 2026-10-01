import os
import tempfile
import unittest
from io import BytesIO
from unittest.mock import patch

os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from fastapi import FastAPI
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import main as main_module
from app.database import Base, get_db
from app.models import Admin


class AdminAvatarEndpointTests(unittest.TestCase):
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
            username="avatar-admin",
            email="avatar-admin@example.test",
            password_hash="test-hash",
            role="sub_admin",
            status="Active",
        )
        self.db.add(self.admin)
        self.db.commit()
        self.avatar_dir = tempfile.TemporaryDirectory()
        self.app = FastAPI()
        self.app.include_router(main_module.app.router)
        self.app.dependency_overrides[get_db] = lambda: self.db
        self.client = TestClient(self.app)
        self.session_patch = patch.object(
            main_module,
            "_admin_for_session",
            return_value=(self.admin, object()),
        )
        self.session_patch.start()

    def tearDown(self):
        self.session_patch.stop()
        self.client.close()
        self.db.close()
        self.avatar_dir.cleanup()

    @staticmethod
    def make_image(image_format="PNG", size=(32, 24)):
        output = BytesIO()
        Image.new("RGB", size, color=(30, 120, 80)).save(output, format=image_format)
        return output.getvalue()

    def post_avatar(self, content, filename="photo.png", content_type="image/png"):
        return self.client.post(
            "/api/admin/profile/avatar",
            headers={"Authorization": "Bearer test-session"},
            files={"avatar": (filename, content, content_type)},
        )

    def test_uploads_supported_formats_as_square_webp_for_sub_admin(self):
        with patch.object(main_module, "AVATAR_DIR", self.avatar_dir.name):
            previous_avatar_path = None
            for image_format, extension in (("PNG", "png"), ("JPEG", "jpg"), ("WEBP", "webp")):
                response = self.post_avatar(self.make_image(image_format), f"avatar.{extension}")
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json()["message"], "Profile photo updated")
                avatar_url = response.json()["avatar_url"]
                self.assertTrue(avatar_url.startswith("/uploads/avatars/admin_"))
                avatar_path = os.path.join(self.avatar_dir.name, os.path.basename(avatar_url))
                if previous_avatar_path:
                    self.assertFalse(os.path.exists(previous_avatar_path))
                with Image.open(avatar_path) as saved_image:
                    self.assertEqual(saved_image.format, "WEBP")
                    self.assertEqual(saved_image.size, (512, 512))
                self.db.refresh(self.admin)
                self.assertEqual(self.admin.avatar_url, avatar_url)
                profile_response = self.client.get(
                    "/api/admin/me",
                    headers={"Authorization": "Bearer test-session"},
                )
                self.assertEqual(profile_response.status_code, 200)
                self.assertEqual(profile_response.json()["avatar_url"], avatar_url)
                previous_avatar_path = avatar_path

    def test_rejects_pdf_even_when_named_as_jpeg(self):
        response = self.post_avatar(b"%PDF-1.7 not an image", "renamed.jpg", "image/jpeg")
        self.assertEqual(response.status_code, 415)
        self.assertIn("valid JPEG", response.json()["detail"])

    def test_rejects_files_larger_than_five_megabytes(self):
        response = self.post_avatar(b"x" * (10 * 1024 * 1024))
        self.assertEqual(response.status_code, 413)
        self.assertIn("5 MB", response.json()["detail"])

    def test_rejects_request_without_authentication(self):
        response = self.client.post(
            "/api/admin/profile/avatar",
            files={"avatar": ("photo.png", self.make_image(), "image/png")},
        )
        self.assertEqual(response.status_code, 401)


if __name__ == "__main__":
    unittest.main()