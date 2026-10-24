import os


def _positive_int_setting(name: str, default: int) -> int:
    raw_hours = os.getenv(name, str(default)).strip()
    try:
        hours = int(raw_hours)
    except ValueError as error:
        raise ValueError(f"{name} must be a positive integer.") from error
    if hours <= 0:
        raise ValueError(f"{name} must be a positive integer.")
    return hours


def get_pay_max_failed_attempts() -> int:
    return _positive_int_setting("PAY_MAX_FAILED_ATTEMPTS", 5)


def get_pay_lock_minutes() -> int:
    return _positive_int_setting("PAY_LOCK_MINUTES", 15)


def get_dispute_window_hours() -> int:
    return _positive_int_setting("DISPUTE_WINDOW_HOURS", 24)
