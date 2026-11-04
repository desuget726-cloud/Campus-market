import os
import unittest

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SESSION_SECRET", "admin-category-update-test-secret")

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import main as main_module
from app.database import Base
from app.models import Category, SubCategory


class AdminCategoryUpdateTests(unittest.TestCase):
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
        self.category = Category(name="Books", icon="📚")
        self.other_category = Category(name="Electronics", icon="💻")
        self.db.add_all([self.category, self.other_category])
        self.db.flush()
        self.subcategory = SubCategory(
            name="Textbooks",
            icon="📖",
            category_id=self.category.id,
        )
        self.db.add(self.subcategory)
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def test_category_update_changes_name_icon_and_active_status(self):
        updated = main_module.update_category(
            self.category.id,
            main_module.CategoryUpdate(name="Course Books", icon="📕", is_active=False),
            self.db,
        )

        self.assertEqual(updated["name"], "Course Books")
        self.assertEqual(updated["icon"], "📕")
        self.assertFalse(updated["is_active"])
        self.assertEqual(updated["status"], "Inactive")

    def test_category_update_rejects_duplicate_name(self):
        with self.assertRaises(HTTPException) as error:
            main_module.update_category(
                self.category.id,
                main_module.CategoryUpdate(name="electronics"),
                self.db,
            )

        self.assertEqual(error.exception.status_code, 400)

    def test_subcategory_update_renames_and_reassigns_parent(self):
        updated = main_module.update_subcategory(
            self.subcategory.id,
            main_module.SubCategoryUpdate(
                name="Reference Books",
                icon="📚",
                parent_category_id=self.other_category.id,
            ),
            self.db,
        )

        self.assertEqual(updated["name"], "Reference Books")
        self.assertEqual(updated["icon"], "📚")
        self.assertEqual(updated["category_id"], self.other_category.id)

    def test_subcategory_update_rejects_duplicate_in_target_parent(self):
        self.db.add(SubCategory(
            name="Textbooks",
            icon="📘",
            category_id=self.other_category.id,
        ))
        self.db.commit()

        with self.assertRaises(HTTPException) as error:
            main_module.update_subcategory(
                self.subcategory.id,
                main_module.SubCategoryUpdate(parent_category_id=self.other_category.id),
                self.db,
            )

        self.assertEqual(error.exception.status_code, 400)


if __name__ == "__main__":
    unittest.main()
