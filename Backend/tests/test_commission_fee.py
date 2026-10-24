import os
from decimal import Decimal

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

from app.commission_service import commission_fee_from_settings


def _fee(**overrides):
    settings = {
        "commission_enabled": True,
        "commission_type": "percentage",
        "commission_rate": "1.0",
        "commission_min_fee": None,
        "commission_max_fee": None,
    }
    settings.update(overrides)
    return commission_fee_from_settings(Decimal("1250.00"), settings)


def test_disabled_commission_is_zero():
    assert _fee(commission_enabled=False) == Decimal("0.00")


def test_zero_rate_is_zero_even_with_minimum():
    assert _fee(commission_rate="0", commission_min_fee="10") == Decimal("0.00")


def test_percentage_rate_is_applied_to_subtotal():
    assert _fee() == Decimal("12.50")


def test_fixed_rate_is_applied_as_amount():
    assert _fee(commission_type="fixed", commission_rate="7.25") == Decimal("7.25")


def test_minimum_and_maximum_apply_only_when_configured():
    assert _fee(commission_min_fee="20") == Decimal("20.00")
    assert _fee(commission_max_fee="5") == Decimal("5.00")
    assert _fee(commission_enabled=False, commission_min_fee="20") == Decimal("0.00")
