import csv
import json
import logging
from datetime import date, timedelta
from io import StringIO
from statistics import fmean, median, pstdev

from django.db.models import Max
from django.http import HttpResponse
from rest_framework.decorators import api_view
from rest_framework.response import Response

from ..models import DataPoint
from .country import country_chart, country_details, timeseries
from .shared import (
    _build_summary_cache_key,
    _cache_get_payload,
    _cache_set_payload,
    _normalize_date_bounds,
    _normalize_group_by,
    _normalize_metric,
    _parse_date,
    _round,
    _summary_cache_ttl_seconds,
    _summary_precompute_group_by,
    _summary_precompute_metrics,
    _summary_precompute_range_days,
)
from .status import provinces_summary, states_summary, sync_status, sync_status_provinces, sync_status_states
from .summary_rows import _aggregate_country_rows_to_continents, _build_rows, _build_rows_fast_mortality

log = logging.getLogger(__name__)

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

__all__ = [
    "_build_map_summary_payload",
    "_build_summary_payload",
    "country_chart",
    "country_details",
    "export_summary",
    "map_summary",
    "precompute_summary_cache",
    "provinces_summary",
    "states_summary",
    "summary",
    "sync_status",
    "sync_status_provinces",
    "sync_status_states",
    "timeseries",
]
