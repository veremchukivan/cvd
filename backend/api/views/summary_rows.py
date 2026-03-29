from datetime import date

from ..models import DataPoint
from .summary_fast import (
    _build_rows_fast_day_snapshot,
    _build_rows_fast_range_change,
    _build_rows_fast_range_sum,
)
from .summary_series import (
    _build_mortality_series,
    _latest_points_before_by_iso,
    _query_grouped_mortality_points,
    _query_grouped_points,
)
from .shared import BASE_METRICS, TODAY_METRICS, _daily_deltas, _round

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
