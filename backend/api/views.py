from collections import defaultdict
from datetime import date, datetime, timedelta

from django.http import HttpResponse
from django.db.models import Avg, Max, Sum, Value
from django.db.models.functions import Coalesce
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import DataPoint, Location, ProvinceDataPoint, StateDataPoint
from .serializers import DataPointSerializer
from .services.analytics import ChartGenerationError, build_metric_chart_png
from .services.ingest import get_ingest_status, get_province_ingest_status, get_state_ingest_status

BASE_METRICS = {"cases", "deaths", "recovered", "active", "tests"}
TODAY_METRICS = {"today_cases", "today_deaths", "today_recovered"}
DERIVED_METRICS = {"incidence", "mortality"}
SUPPORTED_METRICS = BASE_METRICS | TODAY_METRICS | DERIVED_METRICS
SNAPSHOT_METRICS = (
    "cases",
    "deaths",
    "recovered",
    "active",
    "tests",
    "today_cases",
    "today_deaths",
    "today_recovered",
)
PEAK_TOTAL_METRICS = ("cases", "deaths", "recovered", "active", "tests")
TODAY_METRIC_BY_TOTAL = {
    "cases": "today_cases",
    "deaths": "today_deaths",
    "recovered": "today_recovered",
}


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
    }
    normalized = aliases.get(normalized, normalized)
    return normalized if normalized in SUPPORTED_METRICS else "cases"


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

    from_date = _parse_date(from_param)
    to_date = _parse_date(to_param)
    from_date, to_date = _normalize_date_bounds(from_date, to_date)
    response_data = _build_rows(metric, from_date, to_date, day_mode=False)

    return Response(
        {
            "data": response_data,
            "metric": metric,
            "from": from_date.isoformat() if from_date else from_param,
            "to": to_date.isoformat() if to_date else to_param,
        }
    )


@api_view(["GET"])
def map_summary(request):
    metric = _normalize_metric(request.GET.get("metric", "cases"))
    date_param = request.GET.get("date")
    from_param = request.GET.get("from")
    to_param = request.GET.get("to")

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
    response_data = _build_rows(map_metric, from_date, to_date, day_mode=day_mode)

    return Response(
        {
            "data": response_data,
            "metric": metric,
            "from": from_date.isoformat() if from_date else from_param,
            "to": to_date.isoformat() if to_date else to_param,
            "date": to_date.isoformat() if day_mode and to_date else date_param,
        }
    )


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
