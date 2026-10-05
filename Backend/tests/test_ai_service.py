from __future__ import annotations

import os
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

import httpx

from app import ai_service
from app import main as api
from starlette.requests import Request


class FakeResponse:
    def __init__(self, payload, status_code=200):
        self.payload = payload
        self.status_code = status_code
        self.text = str(payload)

    def raise_for_status(self):
        if self.status_code >= 400:
            request = httpx.Request("GET", "https://provider.test")
            response = httpx.Response(
                self.status_code,
                request=request,
                json=self.payload,
            )
            raise httpx.HTTPStatusError(
                "provider rejected the request",
                request=request,
                response=response,
            )

    def json(self):
        return self.payload


class RecordingAsyncClient:
    calls = []
    timeouts = []
    get_responses = []

    def __init__(self, timeout):
        self.timeouts.append(timeout)

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, traceback):
        return False

    async def post(self, url, *, headers=None, json=None):
        self.calls.append({"url": url, "headers": headers, "json": json})
        if url.endswith("/chat/completions"):
            return FakeResponse({"choices": [{"message": {"content": "OpenAI reply"}}]})
        return FakeResponse({"message": {"content": "Ollama reply"}})

    async def get(self, url, *, headers=None):
        self.calls.append({"url": url, "headers": headers})
        return self.get_responses.pop(0)


class AIServiceTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        RecordingAsyncClient.calls = []
        RecordingAsyncClient.timeouts = []
        RecordingAsyncClient.get_responses = []

    async def test_openai_uses_chat_completions_and_configured_timeout(self):
        with patch.dict(os.environ, {
            "OPENAI_API_KEY": "test-key",
            "OPENAI_BASE_URL": "",
            "OPENAI_MODEL": "gpt-test",
            "AI_TIMEOUT": "30",
        }), patch.object(ai_service.httpx, "AsyncClient", RecordingAsyncClient):
            reply = await ai_service.ask_openai("system", "question")

        call = RecordingAsyncClient.calls[0]
        self.assertEqual(reply, "OpenAI reply")
        self.assertEqual(call["url"], "https://api.openai.com/v1/chat/completions")
        self.assertEqual(call["headers"], {"Authorization": "Bearer test-key"})
        self.assertEqual(call["json"]["model"], "gpt-test")
        self.assertEqual(RecordingAsyncClient.timeouts, [30.0])

    async def test_openai_compatible_custom_base_url_is_used_for_chat_and_status(self):
        RecordingAsyncClient.get_responses = [
            FakeResponse({"data": []}),
            FakeResponse({"models": [{"name": "campus-model:latest"}]}),
        ]
        with patch.dict(os.environ, {
            "OPENAI_API_KEY": "compatible-test-key",
            "OPENAI_BASE_URL": "https://api.groq.test/openai/v1/",
            "OPENAI_MODEL": "llama-compatible",
            "OLLAMA_URL": "http://ollama.test:11434",
            "OLLAMA_MODEL": "campus-model",
            "AI_TIMEOUT": "30",
        }), patch.object(ai_service.httpx, "AsyncClient", RecordingAsyncClient):
            reply = await ai_service.ask_openai("system", "question")
            await ai_service.provider_status()

        self.assertEqual(reply, "OpenAI reply")
        self.assertEqual(
            RecordingAsyncClient.calls[0]["url"],
            "https://api.groq.test/openai/v1/chat/completions",
        )
        self.assertEqual(
            RecordingAsyncClient.calls[1]["url"],
            "https://api.groq.test/openai/v1/models",
        )
        self.assertEqual(
            RecordingAsyncClient.calls[0]["headers"],
            {"Authorization": "Bearer compatible-test-key"},
        )
        self.assertEqual(
            RecordingAsyncClient.calls[1]["headers"],
            {"Authorization": "Bearer compatible-test-key"},
        )

    async def test_ollama_uses_non_streaming_chat_endpoint(self):
        with patch.dict(os.environ, {
            "OLLAMA_URL": "http://ollama.test:11434/",
            "OLLAMA_MODEL": "llama-test",
            "AI_TIMEOUT": "30",
        }), patch.object(ai_service.httpx, "AsyncClient", RecordingAsyncClient):
            reply = await ai_service.ask_ollama("system", "question")

        call = RecordingAsyncClient.calls[0]
        self.assertEqual(reply, "Ollama reply")
        self.assertEqual(call["url"], "http://ollama.test:11434/api/chat")
        self.assertEqual(call["json"]["model"], "llama-test")
        self.assertFalse(call["json"]["stream"])
        self.assertEqual(RecordingAsyncClient.timeouts, [30.0])

    async def test_ollama_reads_legacy_base_url_when_primary_url_is_empty(self):
        with patch.dict(os.environ, {
            "OLLAMA_URL": "",
            "OLLAMA_BASE_URL": "http://legacy-ollama.test:11434",
            "OLLAMA_MODEL": "llama-legacy",
            "AI_TIMEOUT": "30",
        }), patch.object(ai_service.httpx, "AsyncClient", RecordingAsyncClient):
            await ai_service.ask_ollama("system", "question")

        self.assertEqual(
            RecordingAsyncClient.calls[0]["url"],
            "http://legacy-ollama.test:11434/api/chat",
        )

    async def test_provider_status_reports_model_missing_without_secrets(self):
        RecordingAsyncClient.get_responses = [
            FakeResponse({"data": []}),
            FakeResponse({"models": [{"name": "other-model:latest"}]}),
        ]
        with patch.dict(os.environ, {
            "OPENAI_API_KEY": "status-test-key",
            "OPENAI_MODEL": "gpt-status",
            "OLLAMA_URL": "http://ollama.test:11434",
            "OLLAMA_MODEL": "campus-model",
            "AI_TIMEOUT": "30",
        }), patch.object(ai_service.httpx, "AsyncClient", RecordingAsyncClient):
            providers = await ai_service.provider_status()

        self.assertEqual(providers["openai"], {
            "configured": True,
            "reachable": True,
            "model": "gpt-status",
            "last_error": None,
            "last_error_type": None,
            "last_http_status": None,
        })
        self.assertEqual(providers["ollama"]["configured"], True)
        self.assertEqual(providers["ollama"]["reachable"], True)
        self.assertEqual(providers["ollama"]["model"], "campus-model")
        self.assertEqual(
            providers["ollama"]["last_error"],
            "model not installed: run ollama pull campus-model",
        )
        self.assertEqual(providers["ollama"]["last_http_status"], 200)
        self.assertNotIn("status-test-key", repr(providers))

    async def test_provider_failure_log_includes_status_and_redacts_key(self):
        with patch.dict(os.environ, {"OPENAI_API_KEY": "never-log-this-key"}):
            request = httpx.Request("GET", "https://provider.test")
            response = httpx.Response(
                401,
                request=request,
                json={
                    "error": {
                        "message": "Incorrect API key provided: sk-proj-************Cf4A."
                    }
                },
            )
            error = httpx.HTTPStatusError(
                "request failed",
                request=request,
                response=response,
            )
            with self.assertLogs("ai_advisor", level="WARNING") as captured:
                details = ai_service.log_provider_failure("openai", error)

        self.assertEqual(details["exception_type"], "HTTPStatusError")
        self.assertEqual(details["http_status"], 401)
        self.assertNotIn("never-log-this-key", captured.output[0])
        self.assertNotIn("sk-proj", captured.output[0])
        self.assertIn("Incorrect API key provided: [REDACTED]", captured.output[0])
        self.assertIn("provider=openai", captured.output[0])
        self.assertIn("http_status=401", captured.output[0])

    def test_ollama_model_not_found_is_reported_for_fallback_reply(self):
        request = httpx.Request("POST", "http://ollama.test/api/chat")
        response = httpx.Response(
            404,
            request=request,
            json={"error": "model campus-model not found, try pulling it first"},
        )
        error = httpx.HTTPStatusError("not found", request=request, response=response)
        details = ai_service.provider_error_details(error)

        self.assertTrue(ai_service.ollama_model_missing(details))
        with patch.dict(os.environ, {"OLLAMA_MODEL": "campus-model"}):
            self.assertEqual(
                ai_service.ollama_model_install_message(),
                "model not installed: run ollama pull campus-model",
            )

    async def test_advisor_returns_ollama_pull_command_after_provider_failures(self):
        def http_error(status_code, url, message):
            request = httpx.Request("POST", url)
            response = httpx.Response(
                status_code,
                request=request,
                json={"error": {"message": message}},
            )
            return httpx.HTTPStatusError(
                "provider request failed",
                request=request,
                response=response,
            )

        request = Request({
            "type": "http",
            "method": "POST",
            "path": "/api/ai/advisor",
            "headers": [],
            "client": ("127.0.0.1", 1234),
            "server": ("testserver", 80),
            "scheme": "http",
            "query_string": b"",
        })
        db = MagicMock()
        with (
            patch.dict(os.environ, {
                "AI_PROVIDER": "auto",
                "OLLAMA_MODEL": "campus-model",
            }),
            patch.object(api, "_public_marketplace_product_query") as product_query,
            patch.object(api, "perform_web_search", return_value=""),
            patch.object(api, "search_products_by_intent", return_value=[]),
            patch.object(
                api,
                "ask_openai",
                new=AsyncMock(side_effect=http_error(401, "https://api.openai.com", "unauthorized")),
            ),
            patch.object(
                api,
                "ask_ollama",
                new=AsyncMock(side_effect=http_error(
                    404,
                    "http://localhost:11434/api/chat",
                    "model campus-model not found, try pulling it first",
                )),
            ),
        ):
            product_query.return_value.all.return_value = []
            result = await api.ai_advisor(
                api.AIAdvisorRequest(message="Help me with campus shopping", student_id="model-missing-test"),
                request,
                db,
            )

        self.assertEqual(
            result["reply"],
            "model not installed: run ollama pull campus-model",
        )
        self.assertEqual(result["provider"], "local-search")


if __name__ == "__main__":
    unittest.main()
