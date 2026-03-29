from datetime import date

from django.db.models import Avg, Max, Sum, Value
from django.db.models.functions import Coalesce

from ..models import DataPoint, Location
from .shared import _round


def _build_rows_fast_day_snapshot(metric: str, to_date: date | None) -> list[dict]:
    qs = DataPoint.objects.filter(metric=metric)
    if to_date:
        qs = qs.filter(date__lte=to_date)

    grouped = qs.values(
        "location_id",
        "location__iso_code",
        "location__name",
    ).annotate(
        average=Avg(Coalesce("value", Value(0.0))),
        max_value=Max(Coalesce("value", Value(0.0))),
    )
    stats_by_location = {
        row["location_id"]: {
            "average": _round(row.get("average")) or 0,
            "max": _round(row.get("max_value")) or 0,
        }
        for row in grouped
    }

    latest_points = qs.order_by("location_id", "-date", "-id").distinct("location_id").values(
        "location_id",
        "location__iso_code",
        "location__name",
        "value",
    )

    rows = []
    for row in latest_points:
        iso_code = (row.get("location__iso_code") or "").upper()
        if not iso_code:
            continue

        stats = stats_by_location.get(row["location_id"]) or {}
        value = _round(row.get("value")) or 0
        rows.append(
            {
                "isoCode": iso_code,
                "name": row.get("location__name") or iso_code,
                "value": value,
                "delta": None,
                "average": stats.get("average", 0),
                "max": stats.get("max", 0),
            }
        )

    rows.sort(key=lambda item: item.get("value") or 0, reverse=True)
    return rows


def _build_rows_fast_range_sum(metric: str, from_date: date | None, to_date: date | None) -> list[dict]:
    qs = DataPoint.objects.filter(metric=metric)
    if from_date:
        qs = qs.filter(date__gte=from_date)
    if to_date:
        qs = qs.filter(date__lte=to_date)

    grouped = qs.values(
        "location__iso_code",
        "location__name",
    ).annotate(
        total=Coalesce(Sum(Coalesce("value", Value(0.0))), Value(0.0)),
        average=Avg(Coalesce("value", Value(0.0))),
        max_value=Max(Coalesce("value", Value(0.0))),
    )

    rows = []
    for row in grouped:
        iso_code = (row.get("location__iso_code") or "").upper()
        if not iso_code:
            continue

        value = _round(row.get("total")) or 0
        rows.append(
            {
                "isoCode": iso_code,
                "name": row.get("location__name") or iso_code,
                "value": value,
                "delta": value,
                "average": _round(row.get("average")) or 0,
                "max": _round(row.get("max_value")) or 0,
            }
        )

    rows.sort(key=lambda item: item.get("value") or 0, reverse=True)
    return rows


def _build_rows_fast_range_change(metric: str, from_date: date | None, to_date: date | None) -> list[dict]:
    qs = DataPoint.objects.filter(metric=metric)
    if from_date:
        qs = qs.filter(date__gte=from_date)
    if to_date:
        qs = qs.filter(date__lte=to_date)

    grouped = qs.values(
        "location_id",
        "location__iso_code",
        "location__name",
    ).annotate(
        average=Avg(Coalesce("value", Value(0.0))),
        max_value=Max(Coalesce("value", Value(0.0))),
    )
    stats_by_location = {
        row["location_id"]: {
            "isoCode": (row.get("location__iso_code") or "").upper(),
            "name": row.get("location__name"),
            "average": _round(row.get("average")) or 0,
            "max": _round(row.get("max_value")) or 0,
        }
        for row in grouped
    }
    first_values = {
        row["location_id"]: float(row.get("value") or 0)
        for row in qs.order_by("location_id", "date", "-id").distinct("location_id").values(
            "location_id",
            "value",
        )
    }
    last_values = {
        row["location_id"]: float(row.get("value") or 0)
        for row in qs.order_by("location_id", "-date", "-id").distinct("location_id").values(
            "location_id",
            "value",
        )
    }

    rows = []
    for location_id, stats in stats_by_location.items():
        iso_code = stats.get("isoCode") or ""
        if not iso_code:
            continue

        first = first_values.get(location_id, 0.0)
        last = last_values.get(location_id, 0.0)
        change = _round(last - first) or 0

        rows.append(
            {
                "isoCode": iso_code,
                "name": stats.get("name") or iso_code,
                "value": change,
                "delta": change,
                "average": stats.get("average", 0),
                "max": stats.get("max", 0),
            }
        )

    rows.sort(key=lambda item: item.get("value") or 0, reverse=True)
    return rows


def _latest_metric_snapshot_by_location(metric: str, anchor_date: date | None) -> dict[int, dict]:
    qs = DataPoint.objects.filter(metric=metric)
    if anchor_date:
        qs = qs.filter(date__lte=anchor_date)

    return {
        row["location_id"]: row
        for row in qs.order_by("location_id", "-date", "-id").distinct("location_id").values(
            "location_id",
            "location__iso_code",
            "location__name",
            "location__continent__code",
            "location__continent__name",
            "value",
        )
    }


def _continent_lookup_by_iso(iso_codes: set[str]) -> dict[str, tuple[str, str]]:
    if not iso_codes:
        return {}

    lookup: dict[str, tuple[str, str]] = {}
    qs = Location.objects.filter(iso_code__in=iso_codes).values("iso_code", "continent__code", "continent__name")
    for row in qs:
        iso_code = (row.get("iso_code") or "").upper()
        continent_code = (row.get("continent__code") or "").upper()
        continent_name = row.get("continent__name") or ""
        if not iso_code or not continent_code or not continent_name:
            continue
        lookup[iso_code] = (continent_code, continent_name)
    return lookup


def _aggregate_country_rows_to_continents(rows: list[dict], day_mode: bool) -> list[dict]:
    iso_codes = {(row.get("isoCode") or "").upper() for row in rows if row.get("isoCode")}
    continent_by_iso = _continent_lookup_by_iso(iso_codes)

    buckets: dict[str, dict] = {}
    for row in rows:
        iso_code = (row.get("isoCode") or "").upper()
        continent = continent_by_iso.get(iso_code)
        if not continent:
            continue

        continent_code, continent_name = continent
        bucket = buckets.setdefault(
            continent_code,
            {
                "name": continent_name,
                "value_sum": 0.0,
                "delta_sum": 0.0,
                "has_delta": False,
                "average_sum": 0.0,
                "max_sum": 0.0,
                "count": 0,
            },
        )
        bucket["value_sum"] += float(row.get("value") or 0)
        if row.get("delta") is not None:
            bucket["delta_sum"] += float(row.get("delta") or 0)
            bucket["has_delta"] = True
        bucket["average_sum"] += float(row.get("average") or 0)
        bucket["max_sum"] += float(row.get("max") or 0)
        bucket["count"] += 1

    aggregated: list[dict] = []
    for continent_code, bucket in buckets.items():
        count = bucket["count"] or 1
        aggregated.append(
            {
                "isoCode": continent_code,
                "name": bucket["name"],
                "value": _round(bucket["value_sum"]) or 0,
                "delta": None if day_mode or not bucket["has_delta"] else _round(bucket["delta_sum"]),
                "average": _round(bucket["average_sum"] / count) or 0,
                "max": _round(bucket["max_sum"] / count) or 0,
            }
        )

    aggregated.sort(key=lambda item: item.get("value") or 0, reverse=True)
    return aggregated


def _build_rows_fast_mortality(
    from_date: date | None,
    to_date: date | None,
    day_mode: bool,
    group_by: str = "country",
) -> list[dict]:
    latest_cases = _latest_metric_snapshot_by_location("cases", to_date)
    latest_deaths = _latest_metric_snapshot_by_location("deaths", to_date)

    active_location_ids: set[int] | None = None
    if not day_mode and from_date:
        window_qs = DataPoint.objects.filter(metric__in=["cases", "deaths"], date__gte=from_date)
        if to_date:
            window_qs = window_qs.filter(date__lte=to_date)
        active_location_ids = set(window_qs.values_list("location_id", flat=True).distinct())

    start_cases: dict[int, dict] = {}
    start_deaths: dict[int, dict] = {}
    if not day_mode and from_date:
        start_cases = _latest_metric_snapshot_by_location("cases", from_date)
        start_deaths = _latest_metric_snapshot_by_location("deaths", from_date)

    if group_by == "continent":
        continent_totals: dict[str, dict] = {}
        for location_id, case_row in latest_cases.items():
            if active_location_ids is not None and location_id not in active_location_ids:
                continue

            cases_value = float(case_row.get("value") or 0)
            if cases_value <= 0:
                continue

            continent_code = (case_row.get("location__continent__code") or "").upper()
            continent_name = case_row.get("location__continent__name") or ""
            if not continent_code or not continent_name:
                continue

            death_row = latest_deaths.get(location_id)
            deaths_value = float((death_row or {}).get("value") or 0)
            bucket = continent_totals.setdefault(
                continent_code,
                {
                    "name": continent_name,
                    "end_cases": 0.0,
                    "end_deaths": 0.0,
                    "start_cases": 0.0,
                    "start_deaths": 0.0,
                    "has_start": False,
                },
            )
            bucket["end_cases"] += cases_value
            bucket["end_deaths"] += deaths_value

            if not day_mode and from_date:
                start_case_row = start_cases.get(location_id)
                start_cases_value = float((start_case_row or {}).get("value") or 0)
                if start_case_row and start_cases_value > 0:
                    start_deaths_value = float((start_deaths.get(location_id) or {}).get("value") or 0)
                    bucket["start_cases"] += start_cases_value
                    bucket["start_deaths"] += start_deaths_value
                    bucket["has_start"] = True

        rows = []
        for continent_code, bucket in continent_totals.items():
            end_cases = bucket["end_cases"]
            if end_cases <= 0:
                continue

            value = _round((bucket["end_deaths"] / end_cases) * 100)
            if value is None:
                continue

            delta = None
            if not day_mode and from_date and bucket["has_start"] and bucket["start_cases"] > 0:
                start_ratio = (bucket["start_deaths"] / bucket["start_cases"]) * 100
                delta = _round(value - start_ratio)

            rows.append(
                {
                    "isoCode": continent_code,
                    "name": bucket["name"],
                    "value": value,
                    "delta": delta,
                    "average": value,
                    "max": value,
                }
            )
        rows.sort(key=lambda item: item.get("value") or 0, reverse=True)
        return rows

    rows = []
    for location_id, case_row in latest_cases.items():
        if active_location_ids is not None and location_id not in active_location_ids:
            continue

        iso_code = (case_row.get("location__iso_code") or "").upper()
        if not iso_code:
            continue

        cases_value = float(case_row.get("value") or 0)
        if cases_value <= 0:
            continue

        death_row = latest_deaths.get(location_id)
        deaths_value = float((death_row or {}).get("value") or 0)
        value = _round((deaths_value / cases_value) * 100)
        if value is None:
            continue

        delta = None
        if not day_mode and from_date:
            start_case_row = start_cases.get(location_id)
            start_cases_value = float((start_case_row or {}).get("value") or 0)
            if start_case_row and start_cases_value > 0:
                start_deaths_value = float((start_deaths.get(location_id) or {}).get("value") or 0)
                start_ratio = (start_deaths_value / start_cases_value) * 100
                delta = _round(value - start_ratio)

        rows.append(
            {
                "isoCode": iso_code,
                "name": case_row.get("location__name") or iso_code,
                "value": value,
                "delta": delta,
                "average": value,
                "max": value,
            }
        )

    rows.sort(key=lambda item: item.get("value") or 0, reverse=True)
    return rows
