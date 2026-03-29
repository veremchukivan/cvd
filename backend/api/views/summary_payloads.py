from datetime import date

from .summary_fast import _aggregate_country_rows_to_continents, _build_rows_fast_mortality
from .summary_metadata import _build_data_quality, _detect_summary_anomalies
from .summary_rows import _build_rows


def build_map_summary_payload(
    metric: str,
    from_date: date | None,
    to_date: date | None,
    day_mode: bool,
    date_param: str | None,
    from_param: str | None,
    to_param: str | None,
    group_by: str,
) -> dict:
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


def build_summary_payload(
    metric: str,
    from_date: date | None,
    to_date: date | None,
    from_param: str | None,
    to_param: str | None,
    group_by: str,
) -> dict:
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
