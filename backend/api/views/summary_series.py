from collections import defaultdict
from datetime import date

from ..models import DataPoint
from .shared import _round


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
