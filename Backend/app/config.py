import os


def get_seller_acceptance_hours() -> int:
    raw_hours = os.getenv("SELLER_ACCEPTANCE_HOURS", "24").strip()
    try:
        hours = int(raw_hours)
    except ValueError as error:
        raise ValueError("SELLER_ACCEPTANCE_HOURS must be a positive integer.") from error
    if hours <= 0:
        raise ValueError("SELLER_ACCEPTANCE_HOURS must be a positive integer.")
    return hours
