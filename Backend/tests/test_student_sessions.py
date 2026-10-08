import os
import unittest
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.middleware.cors import CORSMiddleware
from starlette.requests import Request
from starlette.responses import Response
from fastapi import HTTPException
from unittest.mock import patch

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["SESSION_SECRET"] = "student-session-test-secret"

from app import main as main_module
from app.database import Base
from app.models import Notification, Student, StudentSession, UserSession
from app.password_security import hash_password


class StudentSessionTests(unittest.TestCase):
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
        self.student = Student(
            name="Session User",
            student_id="MAU1600001",
            email="session-user@example.test",
            password=hash_password("SessionPass123!"),
            college="Test College",
            department="Testing",
            is_verified=True,
        )
        self.db.add(self.student)
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def test_cors_allows_local_vite_credentials_methods_and_headers(self):
        cors = next(item for item in main_module.app.user_middleware if item.cls is CORSMiddleware)
        self.assertIn("http://localhost:5173", cors.kwargs["allow_origins"])
        self.assertTrue(cors.kwargs["allow_credentials"])
        self.assertEqual(cors.kwargs["allow_methods"], ["*"])
        self.assertEqual(cors.kwargs["allow_headers"], ["*"])

    @staticmethod
    def _request(ip_address, user_agent, forwarded_for=None, cookie_token=None):
        headers = [(b"user-agent", user_agent.encode("ascii"))]
        if forwarded_for:
            headers.append((b"x-forwarded-for", forwarded_for.encode("ascii")))
        if cookie_token:
            headers.append((b"cookie", f"session_token={cookie_token}".encode("ascii")))
        return Request({
            "type": "http",
            "method": "POST",
            "scheme": "https",
            "path": "/api/login",
            "query_string": b"",
            "headers": headers,
            "client": (ip_address, 12345),
            "server": ("testserver", 443),
        })

    def _login(self, ip_address="8.8.8.8", user_agent=None):
        request = self._request(
            ip_address,
            user_agent or (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
        )
        return main_module.login_user(
            main_module.LoginRequest(
                id_or_email=self.student.student_id,
                password="SessionPass123!",
            ),
            request,
            self.db,
        )

    @staticmethod
    def _session_id(token):
        return main_module._decode_student_jwt(token)["session_id"]

    def test_two_successful_logins_create_two_uuid_sessions(self):
        first = self._login("8.8.8.8")
        second = self._login(
            "1.1.1.1",
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
            "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 "
            "Mobile/15E148 Safari/604.1",
        )

        sessions = self.db.query(UserSession).filter(
            UserSession.user_id == self.student.student_id
        ).all()
        self.assertEqual(len(sessions), 2)
        self.assertNotEqual(self._session_id(first["access_token"]), self._session_id(second["access_token"]))
        self.assertEqual({session.device_name for session in sessions}, {"Windows / Chrome", "iOS / Mobile Safari"})
        self.assertTrue(all(session.revoked_at is None for session in sessions))
        notifications = self.db.query(Notification).filter_by(student_id=self.student.student_id).all()
        self.assertEqual(len(notifications), 2)
        self.assertTrue(all(notification.message.startswith("New login from ") for notification in notifications))

    def test_login_token_expiry_is_fixed_at_seven_days(self):
        started_at = datetime.now(timezone.utc)
        result = self._login()
        payload = main_module._decode_student_jwt(result["access_token"])
        expected_expiry = started_at + timedelta(days=7)

        self.assertAlmostEqual(
            payload["exp"],
            expected_expiry.timestamp(),
            delta=10,
        )

    def test_forwarded_ip_is_only_used_from_a_configured_trusted_proxy(self):
        request = self._request(
            "127.0.0.1",
            "Mozilla/5.0",
            forwarded_for="8.8.8.8, 1.1.1.1",
        )
        with patch.dict(os.environ, {"TRUSTED_PROXY_IPS": "127.0.0.1"}):
            self.assertEqual(main_module._request_client_ip(request), "8.8.8.8")
        with patch.dict(os.environ, {"TRUSTED_PROXY_IPS": ""}):
            self.assertEqual(main_module._request_client_ip(request), "127.0.0.1")

    def test_revoked_token_is_rejected_and_other_session_remains_valid(self):
        first = self._login("8.8.8.8")
        second = self._login("1.1.1.1")

        main_module.revoke_student_session(
            self._session_id(first["access_token"]),
            authorization=f"Bearer {second['access_token']}",
            db=self.db,
        )

        with self.assertRaises(HTTPException) as revoked_error:
            main_module._student_from_authorization(f"Bearer {first['access_token']}", self.db)
        self.assertEqual(revoked_error.exception.status_code, 401)
        self.assertEqual(
            main_module._student_from_authorization(f"Bearer {second['access_token']}", self.db).student_id,
            self.student.student_id,
        )

    def test_token_without_a_persisted_session_is_rejected(self):
        token = main_module._create_session_token(
            self.student.student_id,
            "student",
            30,
            main_module._get_session_secret(),
            session_id=str(uuid.uuid4()),
        )
        with self.assertRaises(HTTPException) as missing_session_error:
            main_module._student_from_authorization(f"Bearer {token}", self.db)
        self.assertEqual(missing_session_error.exception.status_code, 401)

    def test_auth_session_prefers_valid_bearer_over_stale_cookie(self):
        valid_token = self._login()["access_token"]
        stale_token = main_module._create_session_token(
            self.student.student_id,
            "student",
            30,
            main_module._get_session_secret(),
            session_id=str(uuid.uuid4()),
        )
        request = self._request(
            "127.0.0.1",
            "Mozilla/5.0",
            cookie_token=stale_token,
        )

        response = main_module.get_oauth_session(
            request,
            authorization=f"Bearer {valid_token}",
            db=self.db,
        )

        self.assertEqual(response["access_token"], valid_token)
        self.assertEqual(response["user"]["studentId"], self.student.student_id)

    def test_logout_without_token_succeeds_without_database_access(self):
        response = Response()
        with patch.object(main_module, "_ensure_student_session_table", side_effect=AssertionError):
            result = main_module.logout_session(
                self._request("127.0.0.1", "Mozilla/5.0"),
                response,
                authorization=None,
                db=self.db,
            )

        self.assertEqual(result, {"success": True})
        self.assertIn("session_token", response.headers["set-cookie"])

    def test_logout_with_expired_token_succeeds_without_database_access(self):
        expired_token = main_module._create_session_token(
            self.student.student_id,
            "student",
            -1,
            main_module._get_session_secret(),
        )
        response = Response()
        with patch.object(main_module, "_ensure_student_session_table", side_effect=AssertionError):
            result = main_module.logout_session(
                self._request("127.0.0.1", "Mozilla/5.0"),
                response,
                authorization=f"Bearer {expired_token}",
                db=self.db,
            )

        self.assertEqual(result, {"success": True})
        self.assertIn("session_token", response.headers["set-cookie"])

    def test_logout_revokes_a_valid_session(self):
        token = main_module._create_session_token(
            self.student.student_id,
            "student",
            30,
            main_module._get_session_secret(),
        )
        session = StudentSession(
            student_id=self.student.student_id,
            session_token=token,
            is_active=True,
            last_active=datetime.now(timezone.utc),
        )
        self.db.add(session)
        self.db.commit()

        result = main_module.logout_session(
            self._request("127.0.0.1", "Mozilla/5.0"),
            Response(),
            authorization=f"Bearer {token}",
            db=self.db,
        )

        self.assertEqual(result, {"success": True})
        self.assertFalse(session.is_active)

    def test_logout_still_succeeds_when_session_storage_fails(self):
        token = main_module._create_session_token(
            self.student.student_id,
            "student",
            30,
            main_module._get_session_secret(),
        )
        with patch.object(self.db, "query", side_effect=main_module.SQLAlchemyError("database unavailable")):
            result = main_module.logout_session(
                self._request("127.0.0.1", "Mozilla/5.0"),
                Response(),
                authorization=f"Bearer {token}",
                db=self.db,
            )

        self.assertEqual(result, {"success": True})

    def test_student_cannot_revoke_another_users_session(self):
        other_student = Student(
            name="Other User",
            student_id="MAU1600002",
            email="other-user@example.test",
            password=hash_password("OtherPass123!"),
            college="Test College",
            department="Testing",
            is_verified=True,
        )
        self.db.add(other_student)
        self.db.commit()
        other_session = main_module._create_user_session(
            self.db,
            other_student,
            self._request("8.8.4.4", "Mozilla/5.0 (Windows NT 10.0) Chrome/120.0.0.0"),
        )
        other_token = main_module._create_session_token(
            other_student.student_id,
            "student",
            30,
            main_module._get_session_secret(),
            session_id=other_session.id,
        )
        own_token = self._login()["access_token"]

        with self.assertRaises(HTTPException) as missing_error:
            main_module.revoke_student_session(
                other_session.id,
                authorization=f"Bearer {own_token}",
                db=self.db,
            )
        self.assertEqual(missing_error.exception.status_code, 404)
        self.assertIsNone(self.db.query(UserSession).filter(UserSession.id == other_session.id).one().revoked_at)
        self.assertEqual(
            main_module._student_from_authorization(f"Bearer {other_token}", self.db).student_id,
            other_student.student_id,
        )

    def test_revoke_others_keeps_current_session(self):
        current = self._login("8.8.8.8")["access_token"]
        other = self._login("1.1.1.1")["access_token"]

        result = main_module.revoke_other_student_sessions(
            authorization=f"Bearer {current}",
            db=self.db,
        )

        self.assertEqual(result["revoked"], 1)
        self.assertEqual(
            main_module._student_from_authorization(f"Bearer {current}", self.db).student_id,
            self.student.student_id,
        )
        with self.assertRaises(HTTPException) as revoked_error:
            main_module._student_from_authorization(f"Bearer {other}", self.db)
        self.assertEqual(revoked_error.exception.status_code, 401)

    def test_last_active_timestamp_is_throttled_to_five_minutes(self):
        token = self._login()["access_token"]
        session = self.db.query(UserSession).filter(UserSession.id == self._session_id(token)).one()
        original_last_active = datetime.now(timezone.utc) - timedelta(minutes=2)
        session.last_active_at = original_last_active
        self.db.commit()

        main_module._student_from_authorization(f"Bearer {token}", self.db)

        self.assertEqual(main_module._as_utc_datetime(session.last_active_at), original_last_active)

    def test_password_change_revokes_other_sessions_but_keeps_current(self):
        current_token = self._login("8.8.8.8")["access_token"]
        other_token = self._login("1.1.1.1")["access_token"]

        main_module.update_student_password(
            main_module.StudentPasswordUpdate(
                current_password="SessionPass123!",
                new_password="ChangedPass123!",
                confirm_password="ChangedPass123!",
            ),
            self._request("8.8.8.8", "Mozilla/5.0"),
            authorization=f"Bearer {current_token}",
            db=self.db,
        )

        self.assertEqual(
            main_module._student_from_authorization(f"Bearer {current_token}", self.db).student_id,
            self.student.student_id,
        )
        with self.assertRaises(HTTPException) as revoked_error:
            main_module._student_from_authorization(f"Bearer {other_token}", self.db)
        self.assertEqual(revoked_error.exception.status_code, 401)


if __name__ == "__main__":
    unittest.main()
