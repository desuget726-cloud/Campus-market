from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo


ANALYTICS_TIMEZONE = ZoneInfo("Africa/Addis_Ababa")


@dataclass(frozen=True)
class SalesTrendBuckets:
    period: str
    buckets: tuple[date | datetime, ...]
    labels: tuple[str, ...]
    start: datetime
    end: datetime


def analytics_local_now() -> datetime:
    return datetime.now(ANALYTICS_TIMEZONE).replace(tzinfo=None)


def get_sales_trend_buckets(period: str, now: datetime | None = None) -> SalesTrendBuckets:
    if period not in {"7d", "30d", "3m", "year"}:
        raise ValueError(f"Unsupported sales analytics range: {period}")

    current = now or datetime.now(ANALYTICS_TIMEZONE)
    if current.tzinfo is None:
        current = current.replace(tzinfo=ANALYTICS_TIMEZONE)
    else:
        current = current.astimezone(ANALYTICS_TIMEZONE)
    local_now = current.replace(tzinfo=None)

    if period in {"7d", "30d"}:
        bucket_count = 7 if period == "7d" else 30
        end_date = local_now.date() + timedelta(days=1)
        first_date = end_date - timedelta(days=bucket_count)
        buckets = tuple(first_date + timedelta(days=offset) for offset in range(bucket_count))
        return SalesTrendBuckets(
            period=period,
            buckets=buckets,
            labels=tuple(bucket.strftime("%d %b") for bucket in buckets),
            start=datetime.combine(first_date, time.min),
            end=datetime.combine(end_date, time.min),
        )

    month_count = 3 if period == "3m" else 12
    current_month = local_now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    month_buckets = []
    for month_offset in range(month_count - 1, -1, -1):
        absolute_month = current_month.year * 12 + current_month.month - 1 - month_offset
        year, zero_based_month = divmod(absolute_month, 12)
        month_buckets.append(datetime(year, zero_based_month + 1, 1))
    end = datetime(
        current_month.year + (current_month.month == 12),
        current_month.month % 12 + 1,
        1,
    )
    return SalesTrendBuckets(
        period=period,
        buckets=tuple(month_buckets),
        labels=tuple(
            bucket.strftime("%b" if period == "3m" else "%b %y")
            for bucket in month_buckets
        ),
        start=month_buckets[0],
        end=end,
    )


def build_sales_trend_response(
    buckets: SalesTrendBuckets,
    sales_rows: list[tuple[datetime, float]],
) -> dict[str, list]:
    revenue_by_bucket = {bucket: 0.0 for bucket in buckets.buckets}
    for sale_date, revenue in sales_rows:
        bucket = sale_date.date() if buckets.period in {"7d", "30d"} else datetime(
            sale_date.year,
            sale_date.month,
            1,
        )
        if bucket in revenue_by_bucket:
            revenue_by_bucket[bucket] += float(revenue or 0)

    return {
        "labels": list(buckets.labels),
        "revenue": [round(revenue_by_bucket[bucket], 2) for bucket in buckets.buckets],
    }
