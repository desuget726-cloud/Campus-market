import asyncio
import os
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, Mock, patch
from urllib.parse import parse_qs, urlparse

os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import main as main_module
from app.models import GoogleOAuthState


class GoogleOAuthTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        GoogleOAuthState.__table__.create(bind=self.engine)
        self.db = sessionmaker(bind=self.engine, autoflush=False, autocommit=False)()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def _environment(self, frontend_url="https://frontend.example.test"):
        return {
            "GOOGLE_CLIENT_ID": "oauth-test.apps.googleusercontent.com",
            "GOOGLE_CLIENT_SECRET": "oauth-test-secret",
            "GOOGLE_REDIRECT_URI": "https://api.example.test/auth/google/callback",
            "FRONTEND_URL": frontend_url,
        }

    def _assert_state_rejected(self, supplied_state, stored_state, reason, used=False, created_at=None):
        if stored_state is not None:
            self.db.add(GoogleOAuthState(
                state=stored_state,
                verifier="test-verifier",
                used=used,
                created_at=created_at or datetime.now(timezone.utc).replace(tzinfo=None),
            ))
            self.db.commit()

        with patch.dict(os.environ, self._environment(), clear=True), patch.object(
            main_module,
            "_exchange_oauth_code",
            new_callable=AsyncMock,
        ) as exchange_code, self.assertLogs("app.auth", level="WARNING") as logs:
            response = asyncio.run(main_module.google_callback(
                code="test-code",
                state=supplied_state,
                db=self.db,
            ))

        self.assertEqual(
            response.headers["location"],
            "https://frontend.example.test/login?error=google_state",
        )
        self.assertIn(f"reason={reason}", " ".join(logs.output))
        exchange_code.assert_not_awaited()

    def test_valid_state_is_consumed_once_and_exchange_is_mocked(self):
        environment = self._environment()
        with patch.dict(os.environ, environment, clear=True), patch.object(
            main_module.secrets,
            "token_urlsafe",
            side_effect=["test-state", "test-verifier"],
        ):
            authorization_response = main_module.google_login(db=self.db)
            authorization_query = parse_qs(urlparse(authorization_response.headers["location"]).query)
            self.assertEqual(authorization_query["redirect_uri"], [environment["GOOGLE_REDIRECT_URI"]])
            state_record = self.db.query(GoogleOAuthState).filter_by(state="test-state").one()
            self.assertFalse(state_record.used)
            self.assertNotIn("set-cookie", authorization_response.headers)

            identity_response = Mock(is_success=True)
            identity_response.json.return_value = {
                "email": "student@example.test",
                "email_verified": True,
                "name": "Test Student",
            }
            google_client = Mock()
            google_client.get = AsyncMock(return_value=identity_response)
            http_client_context = Mock()
            http_client_context.__aenter__ = AsyncMock(return_value=google_client)
            http_client_context.__aexit__ = AsyncMock(return_value=None)

            with patch.object(
                main_module,
                "_exchange_oauth_code",
                new_callable=AsyncMock,
                return_value={"access_token": "mock-access-token"},
            ) as exchange_code, patch.object(
                main_module.httpx,
                "AsyncClient",
                return_value=http_client_context,
            ), patch.object(
                main_module,
                "_get_or_create_oauth_student",
                return_value=object(),
            ), patch.object(main_module, "_create_secure_session_for_student"):
                response = asyncio.run(main_module.google_callback(
                    code="test-code",
                    state="test-state",
                    db=self.db,
                ))

        self.db.refresh(state_record)
        self.assertTrue(state_record.used)
        exchanged_payload = exchange_code.await_args.args[1]
        self.assertEqual(exchanged_payload["redirect_uri"], environment["GOOGLE_REDIRECT_URI"])
        self.assertEqual(exchanged_payload["code_verifier"], "test-verifier")
        self.assertEqual(response.headers["location"], environment["FRONTEND_URL"])

    def test_expired_state_redirects_to_frontend(self):
        created_at = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=11)
        self._assert_state_rejected("expired-state", "expired-state", "expired", created_at=created_at)

    def test_tampered_state_redirects_to_frontend(self):
        self._assert_state_rejected("tampered-state", "original-state", "unknown")

    def test_reused_state_redirects_to_frontend(self):
        self._assert_state_rejected("used-state", "used-state", "reused", used=True)


if __name__ == "__main__":
    unittest.main()
