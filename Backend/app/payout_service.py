from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any, Optional

import httpx


class PayoutProviderError(Exception):
    def __init__(self, message: str, *, retryable: bool = False, provider_reference: Optional[str] = None):
        super().__init__(message)
        self.retryable = retryable
        self.provider_reference = provider_reference


@dataclass
class PayoutResult:
    status: str
    provider_reference: Optional[str] = None
    message: Optional[str] = None


def _find_provider_reference(payload: Any) -> Optional[str]:
    """Find a transfer identifier in Chapa's varying response envelopes."""
    if isinstance(payload, dict):
        for key in ("reference", "transfer_id", "transaction_id", "tx_ref", "id"):
            value = payload.get(key)
            if value is not None and str(value).strip():
                return str(value).strip()
        for value in payload.values():
            nested_reference = _find_provider_reference(value)
            if nested_reference:
                return nested_reference
    elif isinstance(payload, list):
        for value in payload:
            nested_reference = _find_provider_reference(value)
            if nested_reference:
                return nested_reference
    return None


class PayoutAdapter:
    def create_transfer(self, *, account_name: str, account_number: str, provider_code: str, amount: str, currency: str, reference: str) -> PayoutResult:
        raise NotImplementedError

    def get_transfer_status(self, reference: str) -> PayoutResult:
        raise NotImplementedError


class ChapaPayoutAdapter(PayoutAdapter):
    """Official Chapa transfer adapter. No other provider is treated as integrated."""

    def create_transfer(self, *, account_name: str, account_number: str, provider_code: str, amount: str, currency: str, reference: str) -> PayoutResult:
        secret = os.getenv("CHAPA_SECRET_KEY", "").strip()
        if not secret:
            raise PayoutProviderError("The configured payout gateway is unavailable.")

        payload = {
            "account_name": account_name,
            "account_number": account_number,
            "bank_code": provider_code,
            "amount": amount,
            "currency": currency,
            "reference": reference,
        }
        try:
            response = httpx.post(
                "https://api.chapa.co/v1/transfers",
                headers={"Authorization": f"Bearer {secret}", "Content-Type": "application/json"},
                json=payload,
                timeout=20.0,
            )
            response_payload: Any = response.json() if response.content else {}
        except (httpx.TimeoutException, httpx.ConnectError) as exc:
            raise PayoutProviderError("The payout gateway timed out. The payout remains pending.", retryable=True) from exc
        except (httpx.HTTPError, ValueError) as exc:
            raise PayoutProviderError("The payout gateway could not be reached. The payout remains pending.", retryable=True) from exc

        data = response_payload.get("data") if isinstance(response_payload, dict) and isinstance(response_payload.get("data"), dict) else {}
        provider_reference = _find_provider_reference(response_payload)
        status = str(response_payload.get("status") or data.get("status") or "pending").strip().lower() if isinstance(response_payload, dict) else "pending"
        if response.is_error:
            message = response_payload.get("message") if isinstance(response_payload, dict) else None
            raise PayoutProviderError(str(message or "The payout provider rejected the transfer."), provider_reference=provider_reference)
        if status in {"success", "successful", "paid", "completed"}:
            if not provider_reference:
                raise PayoutProviderError("The payout provider did not return a transfer reference.")
            return PayoutResult("processing", str(provider_reference), "Payout accepted by the provider and awaiting confirmation.")
        if status in {"failed", "cancelled", "canceled"}:
            return PayoutResult("failed", str(provider_reference) if provider_reference else None, "The payout provider reported a failed transfer.")
        if not provider_reference:
            raise PayoutProviderError("The payout provider did not return a transfer reference.")
        return PayoutResult("pending", str(provider_reference) if provider_reference else None, "Payout accepted and awaiting provider confirmation.")

    def get_transfer_status(self, reference: str) -> PayoutResult:
        secret = os.getenv("CHAPA_SECRET_KEY", "").strip()
        if not secret:
            raise PayoutProviderError("The configured payout gateway is unavailable.")
        try:
            response = httpx.get(
                f"https://api.chapa.co/v1/transfers/{reference}",
                headers={"Authorization": f"Bearer {secret}"},
                timeout=20.0,
            )
            response_payload: Any = response.json() if response.content else {}
        except (httpx.TimeoutException, httpx.ConnectError) as exc:
            raise PayoutProviderError("The payout gateway timed out.", retryable=True) from exc
        except (httpx.HTTPError, ValueError) as exc:
            raise PayoutProviderError("The payout gateway could not be reached.", retryable=True) from exc

        data = response_payload.get("data") if isinstance(response_payload, dict) and isinstance(response_payload.get("data"), dict) else {}
        provider_reference = _find_provider_reference(response_payload)
        status = str(response_payload.get("status") or data.get("status") or "pending").strip().lower() if isinstance(response_payload, dict) else "pending"
        if response.is_error:
            message = response_payload.get("message") if isinstance(response_payload, dict) else None
            raise PayoutProviderError(str(message or "The payout provider could not resolve the transfer."), retryable=True)
        if status in {"success", "successful", "paid", "completed"}:
            if not provider_reference:
                raise PayoutProviderError("The payout provider did not return a transfer reference.")
            return PayoutResult("completed", str(provider_reference), "Payout completed by the provider.")
        if status in {"failed", "cancelled", "canceled"}:
            return PayoutResult("cancelled" if status in {"cancelled", "canceled"} else "failed", str(provider_reference) if provider_reference else None, "The payout provider reported a failed transfer.")
        return PayoutResult("processing", str(provider_reference) if provider_reference else None, "Payout remains pending with the provider.")


def get_payout_adapter(provider_code: str) -> Optional[PayoutAdapter]:
    if provider_code.isdigit() and os.getenv("CHAPA_SECRET_KEY", "").strip():
        return ChapaPayoutAdapter()
    return None
