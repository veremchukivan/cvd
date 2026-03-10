import csv
import hashlib
import json
import logging
from collections import defaultdict
from datetime import date, datetime, timedelta
from io import StringIO
from statistics import fmean, median, pstdev

from django.conf import settings
from django.core.cache import cache
from django.http import HttpResponse
from django.db.models import Avg, Max, Sum, Value
from django.db.models.functions import Coalesce
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import DataPoint, Location, ProvinceDataPoint, StateDataPoint
from .serializers import DataPointSerializer
from .services.analytics import ChartGenerationError, build_metric_chart_png
from .services.ingest import get_ingest_status, get_province_ingest_status, get_state_ingest_status

log = logging.getLogger(__name__)

BASE_METRICS = {
    "cases",
    "deaths",
    "recovered",
    "active",
    "tests",
    "vaccinations_total",
    "people_vaccinated",
    "people_fully_vaccinated",
    "boosters_total",
}
TODAY_METRICS = {
    "today_cases",
    "today_deaths",
    "today_recovered",
    "today_vaccinations",
    "today_vaccinations_smoothed",
}
DERIVED_METRICS = {"incidence", "mortality"}
SUPPORTED_METRICS = BASE_METRICS | TODAY_METRICS | DERIVED_METRICS
SNAPSHOT_METRICS = (
    "cases",
    "deaths",
    "recovered",
    "active",
    "tests",
    "vaccinations_total",
    "people_vaccinated",
    "people_fully_vaccinated",
    "boosters_total",
    "today_cases",
    "today_deaths",
    "today_recovered",
    "today_vaccinations",
    "today_vaccinations_smoothed",
)
PEAK_TOTAL_METRICS = ("cases", "deaths", "recovered", "vaccinations_total", "active", "tests")
TODAY_METRIC_BY_TOTAL = {
    "cases": "today_cases",
    "deaths": "today_deaths",
    "recovered": "today_recovered",
    "vaccinations_total": "today_vaccinations",
    "people_vaccinated": "today_vaccinations",
    "people_fully_vaccinated": "today_vaccinations",
    "boosters_total": "today_vaccinations",
}
GROUP_BY_VALUES = {"country", "continent"}
DEFAULT_SUMMARY_CACHE_TTL_SECONDS = 300
DEFAULT_SUMMARY_CACHE_KEY_PREFIX = "covid:summary:v1"
DEFAULT_SUMMARY_PRECOMPUTE_METRICS = ("cases", "deaths", "mortality", "active", "vaccinations_total")
DEFAULT_SUMMARY_PRECOMPUTE_GROUP_BY = ("country", "continent")
DEFAULT_SUMMARY_PRECOMPUTE_RANGE_DAYS = 30


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value).date()
    except ValueError:
        return None


def _normalize_date_bounds(from_date: date | None, to_date: date | None) -> tuple[date | None, date | None]:
    if from_date and to_date and from_date > to_date:
        return to_date, from_date
    return from_date, to_date


def _normalize_metric(metric: str | None) -> str:
    normalized = (metric or "cases").strip().lower()
    aliases = {
        "fatality": "mortality",
        "fatality_rate": "mortality",
        "cfr": "mortality",
        "todaycases": "today_cases",
        "todaydeaths": "today_deaths",
        "todayrecovered": "today_recovered",
        "total_vaccinations": "vaccinations_total",
        "todayvaccinations": "today_vaccinations",
        "new_vaccinations": "today_vaccinations",
    }
    normalized = aliases.get(normalized, normalized)
    return normalized if normalized in SUPPORTED_METRICS else "cases"


def _normalize_group_by(group_by: str | None) -> str:
    normalized = (group_by or "country").strip().lower()
    return normalized if normalized in GROUP_BY_VALUES else "country"


def _settings_int(name: str, default: int) -> int:
    try:
        return int(getattr(settings, name, default))
    except (TypeError, ValueError):
        return default


def _settings_list(name: str, default: tuple[str, ...]) -> list[str]:
    value = getattr(settings, name, default)
    if isinstance(value, str):
        items = [part.strip() for part in value.split(",")]
    else:
        try:
            items = [str(item).strip() for item in value]
        except TypeError:
            items = list(default)
    return [item for item in items if item]


def _summary_cache_ttl_seconds() -> int:
    return max(_settings_int("SUMMARY_CACHE_TTL_SECONDS", DEFAULT_SUMMARY_CACHE_TTL_SECONDS), 0)


def _summary_cache_key_prefix() -> str:
    value = str(getattr(settings, "SUMMARY_CACHE_KEY_PREFIX", DEFAULT_SUMMARY_CACHE_KEY_PREFIX) or "").strip()
    return value or DEFAULT_SUMMARY_CACHE_KEY_PREFIX


def _summary_precompute_metrics() -> list[str]:
    metrics: list[str] = []
    for raw_metric in _settings_list("SUMMARY_PRECOMPUTE_METRICS", DEFAULT_SUMMARY_PRECOMPUTE_METRICS):
        metric = _normalize_metric(raw_metric)
        if metric not in metrics:
            metrics.append(metric)
    return metrics or list(DEFAULT_SUMMARY_PRECOMPUTE_METRICS)


def _summary_precompute_group_by() -> list[str]:
    groups: list[str] = []
    for raw_group in _settings_list("SUMMARY_PRECOMPUTE_GROUP_BY", DEFAULT_SUMMARY_PRECOMPUTE_GROUP_BY):
        group_by = _normalize_group_by(raw_group)
        if group_by not in groups:
            groups.append(group_by)
    return groups or list(DEFAULT_SUMMARY_PRECOMPUTE_GROUP_BY)


def _summary_precompute_range_days() -> int:
    return max(_settings_int("SUMMARY_PRECOMPUTE_RANGE_DAYS", DEFAULT_SUMMARY_PRECOMPUTE_RANGE_DAYS), 1)


def _build_summary_cache_key(namespace: str, params: dict[str, str | None]) -> str:
    payload = json.dumps(params, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()
    return f"{_summary_cache_key_prefix()}:{namespace}:{digest}"


def _cache_get_payload(cache_key: str) -> dict | None:
    if _summary_cache_ttl_seconds() <= 0:
        return None

    try:
        cached = cache.get(cache_key)
    except Exception:
        log.warning("Summary cache read failed for key=%s", cache_key, exc_info=True)
        return None
    return cached if isinstance(cached, dict) else None


def _cache_set_payload(cache_key: str, payload: dict) -> None:
    ttl_seconds = _summary_cache_ttl_seconds()
    if ttl_seconds <= 0:
        return

    try:
        cache.set(cache_key, payload, ttl_seconds)
    except Exception:
        log.warning("Summary cache write failed for key=%s", cache_key, exc_info=True)


def _round(value: float | int | None, digits: int = 2) -> float | None:
    if value is None:
        return None
    return round(float(value), digits)


def _daily_deltas(values: list[float]) -> list[float]:
    if len(values) < 2:
        return []
    deltas: list[float] = []
    previous = values[0]
    for current in values[1:]:
        deltas.append(max(current - previous, 0))
        previous = current
    return deltas


def _build_mortality_series(points: list[DataPoint], start_date: date | None = None) -> list[dict]:
    by_date: dict[date, dict[str, float]] = defaultdict(dict)
    for point in sorted(points, key=lambda item: item.date):
        by_date[point.date][point.metric] = float(point.value or 0)

    current_cases: float | None = None
    current_deaths = 0.0
    series = []
    for point_date in sorted(by_date.keys()):
        date_bucket = by_date[point_date]
        if "cases" in date_bucket:
            current_cases = date_bucket["cases"]
        if "deaths" in date_bucket:
            current_deaths = date_bucket["deaths"]
        if current_cases is None or current_cases <= 0:
            continue
        if start_date and point_date < start_date:
            continue
        ratio = (current_deaths / current_cases) * 100
        series.append({"date": point_date.isoformat(), "value": _round(ratio)})
    return series


def _query_grouped_points(
    metric: str,
    from_date: date | None,
    to_date: date | None,
    day_mode: bool,
) -> tuple[dict[str, list[DataPoint]], dict[str, str]]:
    query_metric = "cases" if metric == "incidence" else metric
    qs = DataPoint.objects.select_related("location").filter(metric=query_metric)
    if day_mode:
        if to_date:
            qs = qs.filter(date__lte=to_date)
    else:
        if from_date:
            qs = qs.filter(date__gte=from_date)
        if to_date:
            qs = qs.filter(date__lte=to_date)

    grouped: dict[str, list[DataPoint]] = defaultdict(list)
    names: dict[str, str] = {}
    for point in qs:
        iso = (point.location.iso_code or "").upper()
        if not iso:
            continue
        grouped[iso].append(point)
        if iso not in names:
            names[iso] = point.location.name or iso
    return grouped, names


def _query_grouped_mortality_points(
    from_date: date | None,
    to_date: date | None,
    day_mode: bool,
) -> tuple[dict[str, list[DataPoint]], dict[str, str]]:
    qs = DataPoint.objects.select_related("location").filter(metric__in=["cases", "deaths"])
    if day_mode:
        if to_date:
            qs = qs.filter(date__lte=to_date)
    else:
        if from_date:
            qs = qs.filter(date__gte=from_date)
        if to_date:
            qs = qs.filter(date__lte=to_date)

    grouped: dict[str, list[DataPoint]] = defaultdict(list)
    names: dict[str, str] = {}
    for point in qs:
        iso = (point.location.iso_code or "").upper()
        if not iso:
            continue
        grouped[iso].append(point)
        if iso not in names:
            names[iso] = point.location.name or iso
    return grouped, names


def _latest_points_before_by_iso(
    metrics: list[str],
    before_date: date | None,
) -> dict[tuple[str, str], DataPoint]:
    if not before_date:
        return {}

    qs = (
        DataPoint.objects.select_related("location")
        .filter(metric__in=metrics, date__lt=before_date)
        .order_by("location__iso_code", "metric", "date")
    )

    latest: dict[tuple[str, str], DataPoint] = {}
    for point in qs:
        iso = (point.location.iso_code or "").upper()
        if not iso:
            continue
        latest[(iso, point.metric)] = point
    return latest


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

    # For range mode keep parity with old behavior:
    # include only locations that had at least one update inside the selected window.
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


def _build_map_summary_payload(
    metric: str,
    date_param: str | None,
    from_param: str | None,
    to_param: str | None,
    group_by: str,
) -> dict:
    requested_day = _parse_date(date_param)
    if date_param:
        from_date = None
        to_date = requested_day
        day_mode = True
    else:
        from_date = _parse_date(from_param)
        to_date = _parse_date(to_param)
        from_date, to_date = _normalize_date_bounds(from_date, to_date)
        day_mode = False

    # Interactive map should display "today cases" for `cases` metric:
    # - day mode: latest daily reported value up to selected date
    # - range mode: sum of daily reported values inside selected window
    map_metric = "today_cases" if metric == "cases" else metric
    if map_metric == "mortality":
        response_data = _build_rows_fast_mortality(from_date, to_date, day_mode=day_mode, group_by=group_by)
    else:
        response_data = _build_rows(map_metric, from_date, to_date, day_mode=day_mode)
        if group_by == "continent":
            response_data = _aggregate_country_rows_to_continents(response_data, day_mode=day_mode)

    return {
        "data": response_data,
        "metric": metric,
        "groupBy": group_by,
        "anomalies": _detect_summary_anomalies(response_data),
        "quality": _build_data_quality(map_metric, from_date, to_date, day_mode=day_mode),
        "from": from_date.isoformat() if from_date else from_param,
        "to": to_date.isoformat() if to_date else to_param,
        "date": to_date.isoformat() if day_mode and to_date else date_param,
    }


def _build_summary_payload(
    metric: str,
    from_param: str | None,
    to_param: str | None,
    group_by: str,
) -> dict:
    from_date = _parse_date(from_param)
    to_date = _parse_date(to_param)
    from_date, to_date = _normalize_date_bounds(from_date, to_date)

    if metric == "mortality" and group_by == "continent":
        response_data = _build_rows_fast_mortality(from_date, to_date, day_mode=False, group_by=group_by)
    else:
        response_data = _build_rows(metric, from_date, to_date, day_mode=False)
        if group_by == "continent":
            response_data = _aggregate_country_rows_to_continents(response_data, day_mode=False)

    return {
        "data": response_data,
        "metric": metric,
        "groupBy": group_by,
        "anomalies": _detect_summary_anomalies(response_data),
        "quality": _build_data_quality(metric, from_date, to_date, day_mode=False),
        "from": from_date.isoformat() if from_date else from_param,
        "to": to_date.isoformat() if to_date else to_param,
    }


def _build_map_summary_payload_cached(
    metric: str,
    date_param: str | None,
    from_param: str | None,
    to_param: str | None,
    group_by: str,
) -> dict:
    cache_key = _build_summary_cache_key(
        "map",
        {
            "metric": metric,
            "groupBy": group_by,
            "date": date_param,
            "from": from_param,
            "to": to_param,
        },
    )
    cached_payload = _cache_get_payload(cache_key)
    if cached_payload is not None:
        return cached_payload

    payload = _build_map_summary_payload(metric, date_param, from_param, to_param, group_by)
    _cache_set_payload(cache_key, payload)
    return payload


def _build_summary_payload_cached(
    metric: str,
    from_param: str | None,
    to_param: str | None,
    group_by: str,
) -> dict:
    cache_key = _build_summary_cache_key(
        "summary",
        {
            "metric": metric,
            "groupBy": group_by,
            "from": from_param,
            "to": to_param,
        },
    )
    cached_payload = _cache_get_payload(cache_key)
    if cached_payload is not None:
        return cached_payload

    payload = _build_summary_payload(metric, from_param, to_param, group_by)
    _cache_set_payload(cache_key, payload)
    return payload


def _warm_summary_cache_variant(
    *,
    metric: str,
    group_by: str,
    latest_iso: str,
    start_iso: str,
    errors: list[str],
) -> int:
    warmed = 0
    variants = (
        ("map_day", _build_map_summary_payload_cached, (metric, latest_iso, None, None, group_by)),
        ("map_range", _build_map_summary_payload_cached, (metric, None, start_iso, latest_iso, group_by)),
        ("map_total", _build_map_summary_payload_cached, (metric, None, None, None, group_by)),
        ("summary_range", _build_summary_payload_cached, (metric, start_iso, latest_iso, group_by)),
        ("summary_total", _build_summary_payload_cached, (metric, None, None, group_by)),
    )

    for label, builder, builder_args in variants:
        try:
            builder(*builder_args)
            warmed += 1
        except Exception as exc:
            error = f"{label}:{metric}:{group_by}:{exc}"
            errors.append(error)
            log.exception("Summary cache precompute failed (%s)", error)
    return warmed


def precompute_summary_cache() -> dict:
    if _summary_cache_ttl_seconds() <= 0:
        return {"enabled": False, "warmed": 0, "reason": "SUMMARY_CACHE_TTL_SECONDS<=0"}

    latest_date = DataPoint.objects.aggregate(latest=Max("date")).get("latest")
    if not latest_date:
        return {"enabled": True, "warmed": 0, "latestDate": None, "errors": []}

    latest_iso = latest_date.isoformat()
    start_date = latest_date - timedelta(days=_summary_precompute_range_days() - 1)
    start_iso = start_date.isoformat()
    metrics = _summary_precompute_metrics()
    group_values = _summary_precompute_group_by()

    warmed = 0
    errors: list[str] = []
    for metric in metrics:
        for group_by in group_values:
            warmed += _warm_summary_cache_variant(
                metric=metric,
                group_by=group_by,
                latest_iso=latest_iso,
                start_iso=start_iso,
                errors=errors,
            )

    return {
        "enabled": True,
        "warmed": warmed,
        "latestDate": latest_iso,
        "rangeDays": _summary_precompute_range_days(),
        "metrics": metrics,
        "groups": group_values,
        "errors": errors,
    }


def _quality_metrics_for_metric(metric: str) -> list[str]:
    if metric == "mortality":
        return ["cases", "deaths"]
    return [metric]


def _detect_summary_anomalies(rows: list[dict], threshold: float = 3.5, max_items: int = 12) -> dict:
    numeric_rows: list[tuple[dict, float]] = []
    for row in rows:
        value = row.get("value")
        if isinstance(value, (int, float)):
            numeric_rows.append((row, float(value)))

    if len(numeric_rows) < 5:
        return {
            "method": "robust_zscore",
            "threshold": threshold,
            "count": 0,
            "items": [],
        }

    values = [value for _, value in numeric_rows]
    med = median(values)
    abs_deviations = [abs(value - med) for value in values]
    mad = median(abs_deviations)

    anomalies: list[dict] = []
    if mad > 0:
        for row, value in numeric_rows:
            score = 0.6745 * (value - med) / mad
            if abs(score) < threshold:
                continue
            anomalies.append(
                {
                    "isoCode": row.get("isoCode"),
                    "name": row.get("name"),
                    "value": _round(value),
                    "score": _round(score),
                    "direction": "high" if score > 0 else "low",
                }
            )
        method = "robust_zscore"
    else:
        mean = fmean(values)
        std = pstdev(values)
        fallback_threshold = 2.5
        for row, value in numeric_rows:
            score = 0.0 if std <= 0 else (value - mean) / std
            if abs(score) < fallback_threshold:
                continue
            anomalies.append(
                {
                    "isoCode": row.get("isoCode"),
                    "name": row.get("name"),
                    "value": _round(value),
                    "score": _round(score),
                    "direction": "high" if score > 0 else "low",
                }
            )
        method = "zscore"
        threshold = fallback_threshold

    anomalies.sort(key=lambda item: abs(float(item.get("score") or 0)), reverse=True)
    items = anomalies[:max_items]
    return {
        "method": method,
        "threshold": threshold,
        "count": len(anomalies),
        "median": _round(med),
        "mad": _round(mad),
        "items": items,
    }


def _build_data_quality(
    metric: str,
    from_date: date | None,
    to_date: date | None,
    day_mode: bool,
) -> dict:
    metrics = _quality_metrics_for_metric(metric)
    qs = DataPoint.objects.filter(metric__in=metrics)

    if day_mode:
        if to_date:
            qs = qs.filter(date__lte=to_date)
    else:
        if from_date:
            qs = qs.filter(date__gte=from_date)
        if to_date:
            qs = qs.filter(date__lte=to_date)

    source_rows = list(qs.values("source").annotate(latest=Max("date")).order_by("-latest", "source"))
    metric_rows = list(qs.values("metric").annotate(latest=Max("date")))
    latest_by_metric = {
        row["metric"]: (row["latest"].isoformat() if row.get("latest") else None)
        for row in metric_rows
    }
    overall_latest = max((row["latest"] for row in metric_rows if row.get("latest")), default=None)
    sources = [
        {
            "source": row["source"],
            "latest": row["latest"].isoformat() if row.get("latest") else None,
        }
        for row in source_rows
    ]

    return {
        "metrics": metrics,
        "primarySource": sources[0]["source"] if sources else None,
        "sources": sources,
        "latestByMetric": latest_by_metric,
        "overallLatest": overall_latest.isoformat() if overall_latest else None,
    }


def _build_summary_export_filename(
    metric: str,
    group_by: str,
    date_param: str | None,
    from_param: str | None,
    to_param: str | None,
    export_format: str,
) -> str:
    if date_param:
        window = date_param
    elif from_param or to_param:
        window = f"{from_param or 'start'}_{to_param or 'end'}"
    else:
        window = "all_time"
    safe_window = window.replace(":", "-").replace("/", "-").replace(" ", "")
    return f"covid_{group_by}_{metric}_{safe_window}.{export_format}"


def _build_rows(metric: str, from_date: date | None, to_date: date | None, day_mode: bool) -> list[dict]:
    if metric in (BASE_METRICS | TODAY_METRICS):
        if day_mode:
            return _build_rows_fast_day_snapshot(metric, to_date)
        if metric in TODAY_METRICS:
            return _build_rows_fast_range_sum(metric, from_date, to_date)
        return _build_rows_fast_range_change(metric, from_date, to_date)

    if metric == "mortality":
        grouped, names = _query_grouped_mortality_points(from_date, to_date, day_mode)
        seed_points = (
            _latest_points_before_by_iso(["cases", "deaths"], from_date)
            if (not day_mode and from_date)
            else {}
        )
        rows = []
        for iso_code, points in grouped.items():
            source_points = list(points)
            if seed_points:
                seeded = [
                    seed_points[key]
                    for key in ((iso_code, "cases"), (iso_code, "deaths"))
                    if key in seed_points
                ]
                if seeded:
                    source_points = [*seeded, *source_points]

            series = _build_mortality_series(source_points, start_date=from_date if not day_mode else None)
            values = [float(item.get("value") or 0) for item in series]
            if not values:
                continue
            first = values[0]
            last = values[-1]
            value = _round(last) or 0
            delta = None if day_mode else _round(last - first)
            average = _round(sum(values) / len(values)) or 0
            max_val = _round(max(values)) or 0
            rows.append(
                {
                    "isoCode": iso_code,
                    "name": names.get(iso_code, iso_code),
                    "value": value,
                    "delta": delta,
                    "average": average,
                    "max": max_val,
                }
            )
        rows.sort(key=lambda item: item.get("value") or 0, reverse=True)
        return rows

    grouped, names = _query_grouped_points(metric, from_date, to_date, day_mode)
    incidence_seed_points = (
        _latest_points_before_by_iso(["cases"], from_date)
        if (metric == "incidence" and not day_mode and from_date)
        else {}
    )
    rows = []
    for iso_code, points in grouped.items():
        ordered = sorted(points, key=lambda item: item.date)

        if metric == "incidence":
            if incidence_seed_points:
                seed = incidence_seed_points.get((iso_code, "cases"))
                if seed:
                    ordered = [seed, *ordered]
            values = [float(point.value or 0) for point in ordered]
            if not values:
                continue
            deltas = _daily_deltas(values)
            if day_mode:
                value = _round(deltas[-1]) if deltas else 0
                delta = None
            else:
                total = sum(deltas)
                value = _round(total) if deltas else 0
                delta = value
            average = _round(sum(deltas) / len(deltas)) if deltas else 0
            max_val = _round(max(deltas)) if deltas else 0
        elif metric in TODAY_METRICS:
            values = [float(point.value or 0) for point in ordered]
            if not values:
                continue
            if day_mode:
                value = _round(values[-1]) or 0
                delta = None
            else:
                total = sum(values)
                value = _round(total) if values else 0
                delta = value
            average = _round(sum(values) / len(values)) if values else 0
            max_val = _round(max(values)) if values else 0
        else:
            values = [float(point.value or 0) for point in ordered]
            if not values:
                continue
            first = values[0]
            last = values[-1]
            if day_mode:
                value = _round(last) or 0
                delta = None
            else:
                change = _round(last - first) or 0
                # Range mode should always represent the selected window only.
                value = change
                delta = change
            average = _round(sum(values) / len(values)) or 0
            max_val = _round(max(values)) or 0

        rows.append(
            {
                "isoCode": iso_code,
                "name": names.get(iso_code, iso_code),
                "value": value,
                "delta": delta,
                "average": average,
                "max": max_val,
            }
        )

    rows.sort(key=lambda item: item.get("value") or 0, reverse=True)
    return rows


def _build_country_snapshot(location: Location, anchor_date: date | None) -> dict:
    qs = DataPoint.objects.filter(location=location, metric__in=SNAPSHOT_METRICS)
    if anchor_date:
        qs = qs.filter(date__lte=anchor_date)
    qs = qs.order_by("metric", "date")

    latest_values: dict[str, float | None] = {}
    for point in qs:
        latest_values[point.metric] = point.value

    snapshot = {metric: latest_values.get(metric) for metric in SNAPSHOT_METRICS}
    cases = float(snapshot.get("cases") or 0)
    deaths = float(snapshot.get("deaths") or 0)
    snapshot["mortality"] = _round((deaths / cases) * 100) if cases > 0 else None

    cases_qs = DataPoint.objects.filter(location=location, metric="cases")
    if anchor_date:
        cases_qs = cases_qs.filter(date__lte=anchor_date)
    tail = list(cases_qs.order_by("-date")[:2])
    if len(tail) == 2:
        incidence = max((tail[0].value or 0) - (tail[1].value or 0), 0)
        snapshot["incidence"] = _round(incidence)
    elif len(tail) == 1:
        snapshot["incidence"] = _round(tail[0].value or 0)
    else:
        snapshot["incidence"] = None

    return snapshot


def _build_country_daily_peak(
    location: Location,
    total_metric: str,
    anchor_date: date | None,
) -> dict:
    today_metric = TODAY_METRIC_BY_TOTAL.get(total_metric)
    if today_metric:
        today_qs = DataPoint.objects.filter(location=location, metric=today_metric)
        if anchor_date:
            today_qs = today_qs.filter(date__lte=anchor_date)
        peak_point = today_qs.order_by("-value", "date").first()
        if peak_point and float(peak_point.value or 0) > 0:
            return {
                "value": _round(peak_point.value),
                "date": peak_point.date.isoformat(),
            }

    total_qs = DataPoint.objects.filter(location=location, metric=total_metric)
    if anchor_date:
        total_qs = total_qs.filter(date__lte=anchor_date)
    ordered = list(total_qs.order_by("date"))
    if len(ordered) < 2:
        return {"value": None, "date": None}

    peak_value = 0.0
    peak_date: date | None = None
    previous = float(ordered[0].value or 0)
    for point in ordered[1:]:
        current = float(point.value or 0)
        delta = max(current - previous, 0)
        if delta > peak_value:
            peak_value = delta
            peak_date = point.date
        previous = current

    if peak_date is None or peak_value <= 0:
        return {"value": None, "date": None}
    return {
        "value": _round(peak_value),
        "date": peak_date.isoformat(),
    }


def _build_country_daily_peaks(location: Location, anchor_date: date | None) -> dict:
    return {
        metric: _build_country_daily_peak(location, metric, anchor_date=anchor_date)
        for metric in PEAK_TOTAL_METRICS
    }


def _build_country_coverage(location: Location, anchor_date: date | None) -> dict:
    latest_by_metric: dict[str, str | None] = {}
    latest_dates: list[date] = []

    for metric in SNAPSHOT_METRICS:
        qs = DataPoint.objects.filter(location=location, metric=metric)
        if anchor_date:
            qs = qs.filter(date__lte=anchor_date)
        latest = qs.order_by("-date").first()
        if latest:
            latest_by_metric[metric] = latest.date.isoformat()
            latest_dates.append(latest.date)
        else:
            latest_by_metric[metric] = None

    overall_latest = max(latest_dates) if latest_dates else None
    return {
        "latestByMetric": latest_by_metric,
        "overallLatest": overall_latest.isoformat() if overall_latest else None,
    }


def _build_country_base_details(
    location: Location,
    metric: str,
    date_mode: str,
    target_date: date | None,
    from_date: date | None,
    to_date: date | None,
) -> tuple[float | None, list[dict]]:
    if date_mode == "day":
        qs = DataPoint.objects.filter(location=location, metric=metric)
        if target_date:
            qs = qs.filter(date__lte=target_date)
        values = list(qs.order_by("date"))
        headline = values[-1].value if values else None

        window_start = (target_date or datetime.today().date()) - timedelta(days=30)
        series_qs = DataPoint.objects.filter(location=location, metric=metric, date__gte=window_start)
        if target_date:
            series_qs = series_qs.filter(date__lte=target_date)
        series_qs = series_qs.order_by("date")
    else:
        series_qs = DataPoint.objects.filter(location=location, metric=metric)
        if from_date:
            series_qs = series_qs.filter(date__gte=from_date)
        if to_date:
            series_qs = series_qs.filter(date__lte=to_date)
        series_qs = series_qs.order_by("date")
        values = list(series_qs)
        if values:
            if metric in TODAY_METRICS:
                headline = _round(sum(float(point.value or 0) for point in values))
            else:
                headline = _round((values[-1].value or 0) - (values[0].value or 0))
        else:
            headline = None

    series = [{"date": dp.date.isoformat(), "value": _round(dp.value)} for dp in series_qs]
    return _round(headline) if headline is not None else None, series


def _build_country_incidence_details(
    location: Location,
    date_mode: str,
    target_date: date | None,
    from_date: date | None,
    to_date: date | None,
) -> tuple[float | None, list[dict]]:
    def build_series(points: list[DataPoint]) -> list[dict]:
        if len(points) < 2:
            return []
        series = []
        previous = float(points[0].value or 0)
        for point in points[1:]:
            current = float(point.value or 0)
            delta = max(current - previous, 0)
            series.append({"date": point.date.isoformat(), "value": _round(delta)})
            previous = current
        return series

    if date_mode == "day":
        window_end = target_date or datetime.today().date()
        window_start = window_end - timedelta(days=30)
        window_points = list(
            DataPoint.objects.filter(
                location=location,
                metric="cases",
                date__gte=window_start,
                date__lte=window_end,
            ).order_by("date")
        )
        previous_point = (
            DataPoint.objects.filter(location=location, metric="cases", date__lt=window_start)
            .order_by("-date")
            .first()
        )
        source_points = [previous_point, *window_points] if previous_point else window_points
        series = build_series(source_points)
        headline = series[-1]["value"] if series else None
        return _round(headline) if headline is not None else None, series

    window_points = list(DataPoint.objects.filter(location=location, metric="cases").order_by("date"))
    if from_date:
        window_points = [point for point in window_points if point.date >= from_date]
    if to_date:
        window_points = [point for point in window_points if point.date <= to_date]
    previous_point = (
        DataPoint.objects.filter(location=location, metric="cases", date__lt=from_date).order_by("-date").first()
        if from_date
        else None
    )
    source_points = [previous_point, *window_points] if previous_point else window_points
    series = build_series(source_points)
    headline = _round(sum(float(point.get("value") or 0) for point in series)) if series else None
    return headline, series


def _build_country_mortality_details(
    location: Location,
    date_mode: str,
    target_date: date | None,
    from_date: date | None,
    to_date: date | None,
) -> tuple[float | None, list[dict]]:
    if date_mode == "day":
        window_end = target_date or datetime.today().date()
        window_start = window_end - timedelta(days=30)
        points = list(
            DataPoint.objects.filter(
                location=location,
                metric__in=["cases", "deaths"],
                date__gte=window_start,
                date__lte=window_end,
            ).order_by("date")
        )
        previous_cases = (
            DataPoint.objects.filter(location=location, metric="cases", date__lt=window_start)
            .order_by("-date")
            .first()
        )
        previous_deaths = (
            DataPoint.objects.filter(location=location, metric="deaths", date__lt=window_start)
            .order_by("-date")
            .first()
        )
        seed_points = [point for point in [previous_cases, previous_deaths] if point]
        series = _build_mortality_series([*seed_points, *points], start_date=window_start)
        headline = series[-1]["value"] if series else None
        return _round(headline) if headline is not None else None, series

    points_qs = DataPoint.objects.filter(location=location, metric__in=["cases", "deaths"])
    if from_date:
        points_qs = points_qs.filter(date__gte=from_date)
    if to_date:
        points_qs = points_qs.filter(date__lte=to_date)
    points = list(points_qs.order_by("date"))

    previous_cases = (
        DataPoint.objects.filter(location=location, metric="cases", date__lt=from_date).order_by("-date").first()
        if from_date
        else None
    )
    previous_deaths = (
        DataPoint.objects.filter(location=location, metric="deaths", date__lt=from_date).order_by("-date").first()
        if from_date
        else None
    )
    seed_points = [point for point in [previous_cases, previous_deaths] if point]
    series = _build_mortality_series([*seed_points, *points], start_date=from_date)
    if len(series) >= 2:
        headline = _round((series[-1]["value"] or 0) - (series[0]["value"] or 0))
    elif len(series) == 1:
        headline = _round(series[0]["value"])
    else:
        headline = None
    return headline, series

@api_view(["GET"])
def timeseries(request):
    location = request.GET.get("location")
    metric = _normalize_metric(request.GET.get("metric", "cases"))
    source = request.GET.get("source")

    qs = DataPoint.objects.select_related("location").all()
    if location:
        qs = qs.filter(location__name__icontains=location)
    if metric:
        query_metric = "cases" if metric == "incidence" else metric
        if query_metric == "mortality":
            qs = qs.filter(metric__in=["cases", "deaths"])
        else:
            qs = qs.filter(metric=query_metric)
    if source:
        qs = qs.filter(source=source)

    data = DataPointSerializer(qs, many=True).data
    return Response(data)


@api_view(["GET"])
def summary(request):
    metric = _normalize_metric(request.GET.get("metric", "cases"))
    from_param = request.GET.get("from")
    to_param = request.GET.get("to")
    group_by = _normalize_group_by(request.GET.get("groupBy") or request.GET.get("group_by"))
    payload = _build_summary_payload_cached(metric, from_param, to_param, group_by)
    return Response(payload)


@api_view(["GET"])
def map_summary(request):
    metric = _normalize_metric(request.GET.get("metric", "cases"))
    date_param = request.GET.get("date")
    from_param = request.GET.get("from")
    to_param = request.GET.get("to")
    group_by = _normalize_group_by(request.GET.get("groupBy") or request.GET.get("group_by"))

    payload = _build_map_summary_payload_cached(metric, date_param, from_param, to_param, group_by)
    return Response(payload)


@api_view(["GET"])
def export_summary(request):
    metric = _normalize_metric(request.GET.get("metric", "cases"))
    date_param = request.GET.get("date")
    from_param = request.GET.get("from")
    to_param = request.GET.get("to")
    group_by = _normalize_group_by(request.GET.get("groupBy") or request.GET.get("group_by"))
    export_format = (request.GET.get("exportFormat") or "csv").strip().lower()

    if export_format not in {"csv", "json"}:
        return Response({"detail": "Unsupported format. Use 'csv' or 'json'."}, status=400)

    payload = _build_map_summary_payload_cached(metric, date_param, from_param, to_param, group_by)
    filename = _build_summary_export_filename(metric, group_by, date_param, from_param, to_param, export_format)

    if export_format == "json":
        response = HttpResponse(json.dumps(payload), content_type="application/json")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response

    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(["groupBy", "metric", "date", "from", "to", "isoCode", "name", "value", "delta", "average", "max"])
    for row in payload["data"]:
        writer.writerow(
            [
                payload.get("groupBy"),
                payload.get("metric"),
                payload.get("date"),
                payload.get("from"),
                payload.get("to"),
                row.get("isoCode"),
                row.get("name"),
                row.get("value"),
                row.get("delta"),
                row.get("average"),
                row.get("max"),
            ]
        )

    response = HttpResponse(output.getvalue(), content_type="text/csv")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


@api_view(["GET"])
def country_details(request, iso: str):
    metric = _normalize_metric(request.GET.get("metric", "cases"))
    date_param = request.GET.get("date")
    from_param = request.GET.get("from")
    to_param = request.GET.get("to")

    iso_upper = iso.upper()
    try:
        location = Location.objects.get(iso_code__iexact=iso_upper)
    except Location.DoesNotExist:
        return Response({"detail": "Location not found"}, status=404)

    if date_param:
        target_date = _parse_date(date_param)
        from_date = None
        to_date = target_date
        date_mode = "day"
    else:
        target_date = None
        from_date = _parse_date(from_param)
        to_date = _parse_date(to_param)
        from_date, to_date = _normalize_date_bounds(from_date, to_date)
        date_mode = "range"

    if metric == "mortality":
        headline, series = _build_country_mortality_details(
            location=location,
            date_mode=date_mode,
            target_date=target_date,
            from_date=from_date,
            to_date=to_date,
        )
    elif metric == "incidence":
        headline, series = _build_country_incidence_details(
            location=location,
            date_mode=date_mode,
            target_date=target_date,
            from_date=from_date,
            to_date=to_date,
        )
    else:
        headline, series = _build_country_base_details(
            location=location,
            metric=metric,
            date_mode=date_mode,
            target_date=target_date,
            from_date=from_date,
            to_date=to_date,
        )

    series_values = [float(item["value"] or 0) for item in series]
    average = _round(sum(series_values) / len(series_values)) if series_values else None
    max_val = _round(max(series_values)) if series_values else None
    anchor_date = to_date if date_mode == "range" else target_date
    snapshot = _build_country_snapshot(location, anchor_date=anchor_date)
    daily_peaks = _build_country_daily_peaks(location, anchor_date=anchor_date)
    coverage = _build_country_coverage(location, anchor_date=anchor_date)

    payload = {
        "iso3": iso_upper,
        "name": location.name,
        "metric": metric,
        "headline": _round(headline) if headline is not None else None,
        "series": series,
        "average": average,
        "max": max_val,
        "from": from_date.isoformat() if from_date else from_param,
        "to": to_date.isoformat() if to_date else to_param,
        "date": target_date.isoformat() if target_date else date_param,
        "totals": snapshot,
        "dailyPeaks": daily_peaks,
        "coverage": coverage,
        "snapshot": snapshot,
    }
    return Response(payload)


@api_view(["GET"])
def country_chart(request):
    iso_code = request.GET.get("iso")
    metric = request.GET.get("metric", "cases")

    if not iso_code:
        return Response({"detail": "Query parameter 'iso' is required."}, status=400)

    try:
        png_bytes = build_metric_chart_png(iso_code, metric)
    except ChartGenerationError as exc:
        return Response({"detail": str(exc)}, status=404)

    return HttpResponse(png_bytes, content_type="image/png")


@api_view(["GET"])
def sync_status(request):
    source = request.GET.get("source", "disease.sh")
    return Response(get_ingest_status(source=source))


@api_view(["GET"])
def sync_status_states(request):
    source = request.GET.get("source", "disease.sh_states")
    return Response(get_state_ingest_status(source=source))


@api_view(["GET"])
def sync_status_provinces(request):
    source = request.GET.get("source", "disease.sh_provinces")
    return Response(get_province_ingest_status(source=source))


@api_view(["GET"])
def states_summary(request):
    metric = (request.GET.get("metric") or "cases").strip().lower()
    date_param = request.GET.get("date")
    source = request.GET.get("source", "disease.sh_states")
    requested_day = _parse_date(date_param)

    qs = StateDataPoint.objects.select_related("state").filter(metric=metric, source=source)
    if requested_day:
        qs = qs.filter(date__lte=requested_day)

    latest_per_state: dict[str, dict] = {}
    for point in qs.order_by("state__code", "date"):
        latest_per_state[point.state.code] = {
            "code": point.state.code,
            "name": point.state.name,
            "country": point.state.country_iso,
            "date": point.date.isoformat(),
            "metric": metric,
            "value": _round(point.value),
        }

    rows = sorted(latest_per_state.values(), key=lambda item: item.get("value") or 0, reverse=True)
    return Response(
        {
            "metric": metric,
            "date": requested_day.isoformat() if requested_day else date_param,
            "source": source,
            "data": rows,
        }
    )


@api_view(["GET"])
def provinces_summary(request):
    metric = (request.GET.get("metric") or "cases").strip().lower()
    date_param = request.GET.get("date")
    country_param = request.GET.get("country")
    country_iso_param = (request.GET.get("countryIso") or request.GET.get("country_iso") or "").strip()
    source = request.GET.get("source", "disease.sh_provinces")
    requested_day = _parse_date(date_param)

    qs = ProvinceDataPoint.objects.select_related("province", "province__country").filter(metric=metric, source=source)
    if country_iso_param:
        qs = qs.filter(province__country__iso_code__iexact=country_iso_param)
    if country_param:
        qs = qs.filter(province__country_name__iexact=country_param)
    if requested_day:
        qs = qs.filter(date__lte=requested_day)

    latest_per_province: dict[str, dict] = {}
    for point in qs.order_by("province__code", "date"):
        latest_per_province[point.province.code] = {
            "code": point.province.code,
            "name": point.province.name,
            "country": point.province.country_name,
            "countryIso": point.province.country.iso_code if point.province.country else None,
            "date": point.date.isoformat(),
            "metric": metric,
            "value": _round(point.value),
        }

    rows = sorted(latest_per_province.values(), key=lambda item: item.get("value") or 0, reverse=True)
    return Response(
        {
            "metric": metric,
            "date": requested_day.isoformat() if requested_day else date_param,
            "country": country_param,
            "countryIso": country_iso_param or None,
            "source": source,
            "data": rows,
        }
    )
