from __future__ import annotations

import logging
import os
from typing import Any, Dict, List, Optional

import httpx


class OllamaServiceError(Exception):
    """Raised when the local Ollama service cannot complete a request."""


class OllamaService:
    def __init__(self, base_url: Optional[str] = None, model: Optional[str] = None, timeout: float = 60.0):
        self.base_url = (base_url or os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")).rstrip("/")
        self.model = model or os.getenv("OLLAMA_MODEL", "llama3.2")
        self.timeout = timeout
        self.logger = logging.getLogger("ollama")

    async def generate_response(
        self,
        system_prompt: str,
        user_prompt: str,
        *,
        temperature: float = 0.2,
        timeout: Optional[float] = None,
    ) -> str:
        payload: Dict[str, Any] = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "stream": False,
            "options": {"temperature": temperature},
        }

        try:
            async with httpx.AsyncClient(timeout=timeout or self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/api/chat",
                    json=payload,
                )
                response.raise_for_status()
                response_payload = response.json()
        except httpx.TimeoutException as error:
            self.logger.warning("Ollama request timed out for model %s: %s", self.model, error)
            raise OllamaServiceError("Ollama request timed out.") from error
        except httpx.HTTPStatusError as error:
            self.logger.warning(
                "Ollama returned HTTP %s for model %s: %s",
                error.response.status_code,
                self.model,
                error.response.text[:500],
            )
            raise OllamaServiceError("Ollama rejected the request.") from error
        except (httpx.RequestError, ValueError) as error:
            self.logger.warning("Ollama request failed for model %s: %s", self.model, error)
            raise OllamaServiceError("Ollama is unavailable.") from error

        content = response_payload.get("message", {}).get("content")
        if not isinstance(content, str) or not content.strip():
            self.logger.warning("Ollama returned no message content for model %s", self.model)
            raise OllamaServiceError("Ollama returned an empty response.")
        return content.strip()

    async def health(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                if response.is_error:
                    return False
                response_payload = response.json()
            models: List[Dict[str, Any]] = response_payload.get("models", [])
            return any(str(item.get("name", "")).split(":", 1)[0] == self.model.split(":", 1)[0] for item in models)
        except (httpx.RequestError, ValueError, TypeError):
            return False

    def config(self) -> Dict[str, str]:
        return {"base_url": self.base_url, "model": self.model}


def get_ollama_service() -> OllamaService:
    return OllamaService()
