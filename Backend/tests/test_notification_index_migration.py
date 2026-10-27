import os
import unittest
from contextlib import contextmanager
from types import SimpleNamespace
from unittest.mock import patch

os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from sqlalchemy.exc import OperationalError

from app import database


class _FakeConnection:
    def __init__(self, indexes, statements, drop_error_code=None):
        self.indexes = indexes
        self.statements = statements
        self.drop_error_code = drop_error_code

    def execute(self, statement):
        sql = str(statement)
        self.statements.append(sql)
        if sql.startswith("CREATE INDEX idx_notifications_student_id"):
            self.indexes.append({
                "name": "idx_notifications_student_id",
                "column_names": ["student_id"],
                "unique": False,
            })
        elif sql.startswith("ALTER TABLE notifications DROP INDEX"):
            if self.drop_error_code is not None:
                raise OperationalError(
                    sql,
                    {},
                    Exception(self.drop_error_code, "simulated MySQL error"),
                )


class _FakeEngine:
    dialect = SimpleNamespace(name="mysql")

    def __init__(self, connection):
        self.connection = connection

    @contextmanager
    def begin(self):
        yield self.connection


class NotificationIndexMigrationTests(unittest.TestCase):
    def _run_migration(self, drop_error_code=None):
        indexes = [{
            "name": "uq_notifications_user_type_reference",
            "column_names": ["student_id", "type", "reference_id"],
            "unique": True,
        }]
        statements = []
        connection = _FakeConnection(indexes, statements, drop_error_code)
        engine = _FakeEngine(connection)
        inspector = SimpleNamespace(
            get_indexes=lambda table_name: list(indexes)
        )

        with (
            patch.object(database, "engine", engine),
            patch.object(database, "inspect", return_value=inspector),
        ):
            database._migrate_legacy_notification_index()

        return statements

    def test_mysql_adds_foreign_key_index_before_dropping_legacy_index(self):
        statements = self._run_migration()

        self.assertEqual(len(statements), 2)
        self.assertTrue(statements[0].startswith(
            "CREATE INDEX idx_notifications_student_id"
        ))
        self.assertTrue(statements[1].startswith(
            "ALTER TABLE notifications DROP INDEX"
        ))

    def test_mysql_keeps_legacy_index_when_drop_is_blocked_or_missing(self):
        for error_code in (1091, 1553):
            with self.subTest(error_code=error_code):
                statements = self._run_migration(drop_error_code=error_code)
                self.assertEqual(len(statements), 2)
                self.assertTrue(statements[0].startswith(
                    "CREATE INDEX idx_notifications_student_id"
                ))
                self.assertTrue(statements[1].startswith(
                    "ALTER TABLE notifications DROP INDEX"
                ))

    def test_mysql_propagates_unexpected_drop_errors(self):
        indexes = [{
            "name": "uq_notifications_user_type_reference",
            "column_names": ["student_id", "type", "reference_id"],
            "unique": True,
        }, {
            "name": "idx_notifications_student_id",
            "column_names": ["student_id"],
            "unique": False,
        }]
        statements = []
        connection = _FakeConnection(indexes, statements, drop_error_code=9999)
        engine = _FakeEngine(connection)
        inspector = SimpleNamespace(
            get_indexes=lambda table_name: list(indexes)
        )

        with (
            patch.object(database, "engine", engine),
            patch.object(database, "inspect", return_value=inspector),
            self.assertRaises(OperationalError),
        ):
            database._migrate_legacy_notification_index()


if __name__ == "__main__":
    unittest.main()
