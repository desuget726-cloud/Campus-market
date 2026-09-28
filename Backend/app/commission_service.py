from __future__ import annotations

from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Optional

CENT = Decimal("0.01")
DEFAULT_COMMISSION_SETTINGS = {
    "commission_enabled": True,
    "commission_type": "percentage",
    "commission_rate": Decimal("1.0"),
    "commission_min_fee": None,
    "commission_max_fee": None,
}


def as_decimal(value: object, *, field_name: str) -> Decimal:
    """Parse decimal text without introducing binary floating-point values."""
    if isinstance(value, float):
        raise ValueError(f"{field_name} must be a decimal value, not a float.")
    try:
        result = value if isinstance(value, Decimal) else Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValueError(f"{field_name} must be a valid decimal value.") from exc
    if not result.is_finite():
        raise ValueError(f"{field_name} must be finite.")
    return result


def validate_commission_settings(
    commission_type: str,
    commission_rate: Decimal,
    commission_min_fee: Optional[Decimal] = None,
    commission_max_fee: Optional[Decimal] = None,
) -> None:
    normalized_type = str(commission_type or "").strip().lower()
    if normalized_type not in {"percentage", "flat"}:
        raise ValueError('commission_type must be "percentage" or "flat".')
    if not isinstance(commission_rate, Decimal):
        raise ValueError("commission_rate must be Decimal.")
    if not commission_rate.is_finite():
        raise ValueError("commission_rate must be finite.")
    if normalized_type == "percentage" and not Decimal("0") <= commission_rate <= Decimal("20"):
        raise ValueError("Percentage commission rate must be between 0 and 20.")
    if normalized_type == "flat" and commission_rate < 0:
        raise ValueError("Flat commission rate must be at least 0.")
    if commission_min_fee is not None:
        if not isinstance(commission_min_fee, Decimal) or not commission_min_fee.is_finite() or commission_min_fee < 0:
            raise ValueError("commission_min_fee must be a non-negative Decimal or null.")
    if commission_max_fee is not None:
        if not isinstance(commission_max_fee, Decimal) or not commission_max_fee.is_finite() or commission_max_fee < 0:
            raise ValueError("commission_max_fee must be a non-negative Decimal or null.")
    if commission_max_fee is not None and commission_min_fee is not None and commission_max_fee < commission_min_fee:
        raise ValueError("commission_max_fee must be greater than or equal to commission_min_fee.")


def calculate_commission(
    amount: Decimal,
    type: str,
    rate: Decimal,
    min_fee: Optional[Decimal],
    max_fee: Optional[Decimal],
) -> Decimal:
    """Calculate the seller-side platform fee using exact Decimal arithmetic."""
    if not isinstance(amount, Decimal) or not isinstance(rate, Decimal):
        raise TypeError("amount and rate must be Decimal values.")
    if min_fee is not None and not isinstance(min_fee, Decimal):
        raise TypeError("min_fee must be a Decimal or None.")
    if max_fee is not None and not isinstance(max_fee, Decimal):
        raise TypeError("max_fee must be a Decimal or None.")
    validate_commission_settings(type, rate, min_fee, max_fee)
    if not amount.is_finite() or amount < 0:
        raise ValueError("amount must be a finite, non-negative Decimal.")

    fee = amount * rate / Decimal("100") if type == "percentage" else rate
    fee = fee.quantize(CENT, rounding=ROUND_HALF_UP)
    if min_fee is not None:
        fee = max(fee, min_fee.quantize(CENT, rounding=ROUND_HALF_UP))
    if max_fee is not None:
        fee = min(fee, max_fee.quantize(CENT, rounding=ROUND_HALF_UP))
    return min(fee, amount).quantize(CENT, rounding=ROUND_HALF_UP)


def commission_for_order(order) -> Decimal:
    """Return the commission snapshot; legacy orders retain their historical 1% fee."""
    status = str(getattr(order, "status", "") or "").strip().lower()
    if status in {"cancelled", "canceled", "refunded", "returned"}:
        return Decimal("0.00")
    snapshot_amount = getattr(order, "commission_amount", None)
    if snapshot_amount is not None:
        return as_decimal(snapshot_amount, field_name="commission_amount").quantize(CENT, rounding=ROUND_HALF_UP)

    sale_amount = as_decimal(getattr(order, "price", "0"), field_name="amount")
    quantity = int(getattr(order, "quantity", 1) or 1)
    sale_amount = (sale_amount * quantity).quantize(CENT, rounding=ROUND_HALF_UP)
    return calculate_commission(sale_amount, "percentage", Decimal("1.0"), None, None)