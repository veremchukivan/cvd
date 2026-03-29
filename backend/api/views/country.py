from datetime import date, datetime, timedelta

from django.http import HttpResponse
from rest_framework.decorators import api_view
from rest_framework.response import Response

from ..models import DataPoint, Location
from ..serializers import DataPointSerializer
from ..services.analytics import ChartGenerationError, build_metric_chart_png
from .shared import (
    PEAK_TOTAL_METRICS,
    SNAPSHOT_METRICS,
    TODAY_METRICS,
    TODAY_METRIC_BY_TOTAL,
    _normalize_date_bounds,
    _normalize_metric,
    _parse_date,
    _round,
)
from .summary_rows import _build_mortality_series

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
