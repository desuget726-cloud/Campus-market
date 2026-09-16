from __future__ import annotations

import os
import json
import logging
from dataclasses import dataclass
from typing import Any, Optional

import httpx


class PayoutProviderError(Exception):
    def __init__(
        self,
        message: str,
        *,
        retryable: bool = False,
        provider_reference: Optional[str] = None,
        status_code: Optional[int] = None,
    ):
        super().__init__(message)
        self.retryable = retryable
        self.provider_reference = provider_reference
        self.status_code = status_code


@dataclass
class PayoutResult:
    status: str
    provider_reference: Optional[str] = None
    message: Optional[str] = None


def _find_provider_reference(payload: Any) -> Optional[str]:
    """Find a transfer identifier in Chapa's varying response envelopes."""
    if isinstance(payload, dict):
        for key in (
            "reference",
            "transfer_reference",
            "transaction_reference",
            "transfer_id",
            "transaction_id",
            "tx_ref",
            "trx_ref",
            "id",
        ):
            value = payload.get(key)
            if value is not None and str(value).strip():
                return str(value).strip()
        data_value = payload.get("data")
        if isinstance(data_value, str) and data_value.strip():
            return data_value.strip()
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

        logger = logging.getLogger("app.payouts")
        payload = {
            "account_name": account_name,
            "account_number": account_number,
            "bank_code": provider_code,
            "amount": amount,
            "currency": currency,
            "reference": reference,
        }
        logged_payload = {
            **payload,
            "account_number": f"***{account_number[-4:]}",
        }
        logger.warning(
            "Chapa transfer request internal_reference=%s tx_ref=%s business_name=%s payload=%s",
            reference,
            reference,
            account_name,
            json.dumps(logged_payload, ensure_ascii=True),
        )
        try:
            response = httpx.post(
                "https://api.chapa.co/v1/transfers",
                headers={"Authorization": f"Bearer {secret}", "Content-Type": "application/json"},
                json=payload,
                timeout=20.0,
            )
        except (httpx.TimeoutException, httpx.ConnectError) as exc:
            raise PayoutProviderError("The payout gateway timed out. The payout remains pending.", retryable=True) from exc
        except httpx.HTTPError as exc:
            raise PayoutProviderError("The payout gateway could not be reached. The payout remains pending.", retryable=True) from exc

        try:
            response_payload: Any = response.json() if response.content else {}
        except ValueError as exc:
            logger.warning(
                "Chapa transfer response for %s: HTTP %s, invalid JSON body=%s",
                reference,
                response.status_code,
                response.text,
            )
            raise PayoutProviderError(
                f"The payout provider returned an invalid response (HTTP {response.status_code}).",
                retryable=False,
            ) from exc

        logger.warning(
            "Chapa transfer response for %s: HTTP %s, JSON=%s",
            reference,
            response.status_code,
            json.dumps(response_payload, ensure_ascii=True, default=str),
        )

        if response.is_error:
            message = response_payload.get("message") if isinstance(response_payload, dict) else None
            raise PayoutProviderError(
                f"Chapa transfer failed (HTTP {response.status_code}): "
                f"{message or 'The payout provider rejected the transfer.'}",
                retryable=False,
                status_code=response.status_code,
            )

        data = response_payload.get("data") if isinstance(response_payload, dict) and isinstance(response_payload.get("data"), dict) else {}
        provider_reference = _find_provider_reference(response_payload)
        status = str(response_payload.get("status") or data.get("status") or "pending").strip().lower() if isinstance(response_payload, dict) else "pending"
        if status in {"success", "successful", "paid", "completed"}:
            if not provider_reference:
                raise PayoutProviderError("The payout provider did not return a transfer reference.")
            return PayoutResult("processing", str(provider_reference), "Payout accepted by the provider and awaiting confirmation.")
        if status in {"failed", "cancelled", "canceled"}:
            if not provider_reference:
                raise PayoutProviderError("The payout provider did not return a transfer reference.")
            return PayoutResult("failed", str(provider_reference), "The payout provider reported a failed transfer.")
        if not provider_reference:
            raise PayoutProviderError("The payout provider did not return a transfer reference.")
        return PayoutResult("pending", str(provider_reference) if provider_reference else None, "Payout accepted and awaiting provider confirmation.")

    def get_transfer_status(self, reference: str) -> PayoutResult:
        secret = os.getenv("CHAPA_SECRET_KEY", "").strip()
        if not secret:
            raise PayoutProviderError("The configured payout gateway is unavailable.")
        try:
            response = httpx.get(
                f"https://api.chapa.co/v1/transfers/verify/{reference}",
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
