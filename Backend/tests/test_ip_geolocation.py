import asyncio
import unittest
from unittest.mock import patch

import httpx
from starlette.requests import Request

from app import main as main_module


class IpGeolocationTests(unittest.TestCase):
    @staticmethod
    def _request(headers=None, client=("127.0.0.1", 12345)):
        return Request({
            "type": "http",
            "method": "GET",
            "scheme": "https",
            "path": "/",
            "query_string": b"",
            "headers": headers or [],
            "client": client,
            "server": ("testserver", 443),
        })

    def test_real_client_ip_prefers_forwarded_for_then_cloudflare(self):
        forwarded_request = self._request([
            (b"x-forwarded-for", b"198.51.100.10, 10.0.0.1"),
            (b"cf-connecting-ip", b"198.51.100.20"),
        ])
        cloudflare_request = self._request([
            (b"cf-connecting-ip", b"198.51.100.20"),
        ])

        self.assertEqual(main_module.get_real_client_ip(forwarded_request), "198.51.100.10")
        self.assertEqual(main_module.get_real_client_ip(cloudflare_request), "198.51.100.20")
        self.assertEqual(
            main_module.get_real_client_ip(self._request(client=("203.0.113.1", 443))),
            "203.0.113.1",
        )
        self.assertEqual(
            main_module.get_real_client_ip(self._request(client=None)),
            "127.0.0.1",
        )

    def test_private_loopback_and_invalid_ips_are_local_network(self):
        for ip_address in ("192.168.1.20", "127.0.0.1", "not-an-ip"):
            with self.subTest(ip_address=ip_address):
                self.assertEqual(
                    asyncio.run(main_module.resolve_ip_location(ip_address)),
                    "Local network",
                )

    def test_public_ip_resolves_city_and_country(self):
        class FakeResponse:
            status_code = 200

            @staticmethod
            def json():
                return {
                    "status": "success",
                    "city": "Addis Ababa",
                    "country": "Ethiopia",
                }

        class FakeClient:
            timeouts = []
            urls = []

            def __init__(self, timeout):
                self.timeout = timeout
                self.timeouts.append(timeout)

            async def __aenter__(self):
                return self

            async def __aexit__(self, _exc_type, _exc_value, _traceback):
                return None

            async def get(self, url):
                self.urls.append(url)
                return FakeResponse()

        with patch("app.main.httpx.AsyncClient", FakeClient):
            result = asyncio.run(main_module.resolve_ip_location("8.8.8.8"))

        self.assertEqual(result, "Addis Ababa, Ethiopia")
        self.assertEqual(FakeClient.timeouts, [2.0])
        self.assertEqual(
            FakeClient.urls,
            ["http://ip-api.com/json/8.8.8.8?fields=status,city,country"],
        )

    def test_public_lookup_failure_returns_unknown_location(self):
        class FailingClient:
            def __init__(self, timeout):
                self.timeout = timeout

            async def __aenter__(self):
                return self

            async def __aexit__(self, _exc_type, _exc_value, _traceback):
                return None

            async def get(self, url):
                raise httpx.TimeoutException("lookup timed out")

        with patch("app.main.httpx.AsyncClient", FailingClient):
            result = asyncio.run(main_module.resolve_ip_location("8.8.8.8"))

        self.assertEqual(result, "Unknown location")


if __name__ == "__main__":
    unittest.main()
