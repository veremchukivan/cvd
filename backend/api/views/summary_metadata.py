from datetime import date
from statistics import fmean, median, pstdev

from django.db.models import Max

from ..models import DataPoint
from .shared import _round


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
