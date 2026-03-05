import logging
import csv
import time
from hashlib import md5
from datetime import date, datetime, timezone
from typing import Any, Dict, Tuple
from urllib.parse import quote

import requests
from django.db import transaction
from django.db.models import Count, Max, Min
from django.utils.text import slugify
from requests import RequestException

from api.models import (
    Continent,
    DataPoint,
    Location,
    Province,
    ProvinceDataPoint,
    State,
    StateDataPoint,
)

log = logging.getLogger(__name__)

COUNTRIES_URL = "https://disease.sh/v3/covid-19/countries"
GLOBAL_URL = "https://disease.sh/v3/covid-19/all"
HISTORICAL_COUNTRIES_URL = "https://disease.sh/v3/covid-19/historical"
HISTORICAL_GLOBAL_URL = "https://disease.sh/v3/covid-19/historical/all"
STATES_URL = "https://disease.sh/v3/covid-19/states"
OWID_CSV_URL = "https://raw.githubusercontent.com/owid/covid-19-data/master/public/data/owid-covid-data.csv"
SOURCE_NAME = "disease.sh"
STATE_SOURCE_NAME = "disease.sh_states"
PROVINCE_SOURCE_NAME = "disease.sh_provinces"
METRICS = ("cases", "deaths", "recovered", "active", "tests")
STATE_METRICS = ("cases", "deaths", "recovered", "active", "population")
PROVINCE_METRICS = ("cases", "deaths", "recovered", "active")
TODAY_METRIC_BY_TOTAL = {
    "cases": "today_cases",
    "deaths": "today_deaths",
    "recovered": "today_recovered",
}
TODAY_METRICS = tuple(TODAY_METRIC_BY_TOTAL.values())
LIVE_TODAY_FIELD_BY_METRIC = {
    "today_cases": "todayCases",
    "today_deaths": "todayDeaths",
    "today_recovered": "todayRecovered",
}


def ingest_disease_data() -> Tuple[int, int]:
    created_locations = 0
    upserted_points = 0

    country_records = _fetch_json(COUNTRIES_URL)
    if not isinstance(country_records, list) or not country_records:
        log.error("Disease.sh countries payload is empty or invalid")
        raise RuntimeError("Disease.sh countries payload is empty or invalid")

    with transaction.atomic():
        for record in country_records:
            iso_code = _resolve_iso_code(record)
            if not iso_code:
                log.warning("Skipping record without ISO code: %s", record.get("country"))
                continue

            location_name = record.get("country") or iso_code
            location, created = _upsert_location(
                iso_code=iso_code,
                name=location_name,
                continent_name=_resolve_continent_name(record),
            )
            created_locations += int(created)

            point_date = _timestamp_to_date(record.get("updated"))
            for metric in METRICS:
                value = record.get(metric)
                DataPoint.objects.update_or_create(
                    location=location,
                    date=point_date,
                    metric=metric,
                    source=SOURCE_NAME,
                    defaults={"value": value},
                )
                upserted_points += 1

            for total_metric, today_metric in TODAY_METRIC_BY_TOTAL.items():
                today_value = _to_number(record.get(LIVE_TODAY_FIELD_BY_METRIC[today_metric]))
                if today_value is None:
                    today_value = _derive_today_from_previous_location(
                        location=location,
                        point_date=point_date,
                        total_metric=total_metric,
                        current_total=record.get(total_metric),
                        source=SOURCE_NAME,
                    )
                if today_value is None:
                    continue

                DataPoint.objects.update_or_create(
                    location=location,
                    date=point_date,
                    metric=today_metric,
                    source=SOURCE_NAME,
                    defaults={"value": today_value},
                )
                upserted_points += 1

    global_record = _fetch_json(GLOBAL_URL)
    if isinstance(global_record, dict) and global_record:
        with transaction.atomic():
            location, created = _upsert_location(iso_code="WORLD", name="World")
            created_locations += int(created)
            point_date = _timestamp_to_date(global_record.get("updated"))

            for metric in METRICS:
                value = global_record.get(metric)
                DataPoint.objects.update_or_create(
                    location=location,
                    date=point_date,
                    metric=metric,
                    source=SOURCE_NAME,
                    defaults={"value": value},
                )
                upserted_points += 1

            for total_metric, today_metric in TODAY_METRIC_BY_TOTAL.items():
                today_value = _to_number(global_record.get(LIVE_TODAY_FIELD_BY_METRIC[today_metric]))
                if today_value is None:
                    today_value = _derive_today_from_previous_location(
                        location=location,
                        point_date=point_date,
                        total_metric=total_metric,
                        current_total=global_record.get(total_metric),
                        source=SOURCE_NAME,
                    )
                if today_value is None:
                    continue

                DataPoint.objects.update_or_create(
                    location=location,
                    date=point_date,
                    metric=today_metric,
                    source=SOURCE_NAME,
                    defaults={"value": today_value},
                )
                upserted_points += 1
    else:
        log.warning("Disease.sh global payload missing or invalid: %s", type(global_record))

    log.info(
        "Disease.sh ingest finished: %s locations affected, %s datapoints upserted",
        created_locations,
        upserted_points,
    )
    return created_locations, upserted_points


def ingest_disease_historical(lastdays: str | int = "all") -> Tuple[int, int]:
    """
    Loads full time series for every country and global aggregate.
    """
    created_locations = 0
    upserted_points = 0
    country_iso_lookup = _build_country_iso_lookup()

    countries_url = f"{HISTORICAL_COUNTRIES_URL}?lastdays={lastdays}"
    country_records = _fetch_json(countries_url)
    if not isinstance(country_records, list) or not country_records:
        log.error("Disease.sh historical countries payload is empty or invalid")
        raise RuntimeError("Disease.sh historical countries payload is empty or invalid")

    for record in country_records:
        iso_code = _resolve_iso_code(record, country_iso_lookup=country_iso_lookup)
        if not iso_code:
            log.warning("Skipping historical record without ISO code: %s", record.get("country"))
            continue

        location_name = record.get("country") or iso_code
        location, created = _upsert_location(
            iso_code=iso_code,
            name=location_name,
            continent_name=_resolve_continent_name(record),
        )
        created_locations += int(created)

        timeline = record.get("timeline") or {}
        upserted_points += _upsert_timeline(location, timeline)

    global_url = f"{HISTORICAL_GLOBAL_URL}?lastdays={lastdays}"
    global_record = _fetch_json(global_url)
    if isinstance(global_record, dict) and global_record:
        location, created = _upsert_location(iso_code="WORLD", name="World")
        created_locations += int(created)
        upserted_points += _upsert_timeline(location, global_record)
    else:
        log.warning("Disease.sh global historical payload missing or invalid: %s", type(global_record))

    log.info(
        "Disease.sh historical ingest finished: %s locations affected, %s datapoints upserted",
        created_locations,
        upserted_points,
    )
    return created_locations, upserted_points


def ingest_owid_backfill(
    from_date: date | None = date(2023, 3, 10),
    to_date: date | None = None,
    source: str = SOURCE_NAME,
    csv_url: str = OWID_CSV_URL,
) -> Tuple[int, int]:
    """
    Backfills country/world daily totals from OWID into DataPoint.

    Notes:
    - OWID currently provides totals/new values for cases/deaths/tests and vaccination metrics,
      but not recovered totals.
    - Non-country OWID aggregates (OWID_*) are skipped except OWID_WRL -> WORLD.
    """
    if from_date and to_date and from_date > to_date:
        from_date, to_date = to_date, from_date

    source_name = (source or SOURCE_NAME).strip() or SOURCE_NAME
    response = requests.get(csv_url, timeout=120, stream=True)
    try:
        response.raise_for_status()
    except RequestException as exc:
        raise RuntimeError(f"Unable to fetch OWID CSV from {csv_url}") from exc

    lines = (raw.decode("utf-8") for raw in response.iter_lines() if raw)
    reader = csv.DictReader(lines)

    upserted_points = 0
    affected_locations: set[str] = set()
    location_cache: dict[str, Location] = {}
    pending_records: list[DataPoint] = []

    def flush_records() -> int:
        if not pending_records:
            return 0
        count = len(pending_records)
        DataPoint.objects.bulk_create(
            pending_records,
            batch_size=5000,
            update_conflicts=True,
            unique_fields=["location", "date", "metric", "source"],
            update_fields=["value"],
        )
        pending_records.clear()
        return count

    for row in reader:
        raw_iso = (row.get("iso_code") or "").strip().upper()
        if not raw_iso:
            continue

        if raw_iso.startswith("OWID_") and raw_iso != "OWID_WRL":
            continue

        point_date = _parse_iso_date(row.get("date"))
        if not point_date:
            continue
        if from_date and point_date < from_date:
            continue
        if to_date and point_date > to_date:
            continue

        iso_code = "WORLD" if raw_iso == "OWID_WRL" else raw_iso
        iso_code = iso_code[:10]
        location_name = (row.get("location") or iso_code).strip() or iso_code

        location = location_cache.get(iso_code)
        if location is None:
            location, _ = _upsert_location(
                iso_code=iso_code,
                name=location_name,
                continent_name=row.get("continent"),
            )
            location_cache[iso_code] = location

        affected_locations.add(iso_code)

        population = _to_number(row.get("population"))
        total_cases = _to_number(row.get("total_cases"))
        if total_cases is None:
            total_cases = _estimate_absolute_from_per_million(
                per_million=row.get("total_cases_per_million"),
                population=population,
            )

        total_deaths = _to_number(row.get("total_deaths"))
        if total_deaths is None:
            total_deaths = _estimate_absolute_from_per_million(
                per_million=row.get("total_deaths_per_million"),
                population=population,
            )

        total_tests = _to_number(row.get("total_tests"))
        if total_tests is None:
            total_tests = _estimate_absolute_from_per_thousand(
                per_thousand=row.get("total_tests_per_thousand"),
                population=population,
            )

        total_vaccinations = _to_number(row.get("total_vaccinations"))
        if total_vaccinations is None:
            total_vaccinations = _estimate_absolute_from_per_hundred(
                per_hundred=row.get("total_vaccinations_per_hundred"),
                population=population,
            )

        people_vaccinated = _to_number(row.get("people_vaccinated"))
        if people_vaccinated is None:
            people_vaccinated = _estimate_absolute_from_per_hundred(
                per_hundred=row.get("people_vaccinated_per_hundred"),
                population=population,
            )

        people_fully_vaccinated = _to_number(row.get("people_fully_vaccinated"))
        if people_fully_vaccinated is None:
            people_fully_vaccinated = _estimate_absolute_from_per_hundred(
                per_hundred=row.get("people_fully_vaccinated_per_hundred"),
                population=population,
            )

        total_boosters = _to_number(row.get("total_boosters"))
        if total_boosters is None:
            total_boosters = _estimate_absolute_from_per_hundred(
                per_hundred=row.get("total_boosters_per_hundred"),
                population=population,
            )

        new_cases = _to_number(row.get("new_cases"))
        if new_cases is None:
            new_cases = _estimate_absolute_from_per_million(
                per_million=row.get("new_cases_per_million"),
                population=population,
            )

        new_deaths = _to_number(row.get("new_deaths"))
        if new_deaths is None:
            new_deaths = _estimate_absolute_from_per_million(
                per_million=row.get("new_deaths_per_million"),
                population=population,
            )

        new_vaccinations = _to_number(row.get("new_vaccinations"))
        new_vaccinations_smoothed = _to_number(row.get("new_vaccinations_smoothed"))
        if new_vaccinations_smoothed is None:
            new_vaccinations_smoothed = _estimate_absolute_from_per_million(
                per_million=row.get("new_vaccinations_smoothed_per_million"),
                population=population,
            )

        metric_values = {
            "cases": total_cases,
            "deaths": total_deaths,
            "tests": total_tests,
            "vaccinations_total": total_vaccinations,
            "people_vaccinated": people_vaccinated,
            "people_fully_vaccinated": people_fully_vaccinated,
            "boosters_total": total_boosters,
            "today_cases": new_cases,
            "today_deaths": new_deaths,
            "today_vaccinations": new_vaccinations,
            "today_vaccinations_smoothed": new_vaccinations_smoothed,
        }

        for metric, value in metric_values.items():
            if value is None:
                continue
            pending_records.append(
                DataPoint(
                    location=location,
                    date=point_date,
                    metric=metric,
                    source=source_name,
                    value=value,
                )
            )

        if len(pending_records) >= 10000:
            upserted_points += flush_records()

    upserted_points += flush_records()
    response.close()

    log.info(
        "OWID backfill finished: %s locations affected, %s datapoints upserted (source=%s, from=%s, to=%s)",
        len(affected_locations),
        upserted_points,
        source_name,
        from_date,
        to_date,
    )
    return len(affected_locations), upserted_points


def ingest_per_million_cases_file(
    file_path: str,
    source: str = SOURCE_NAME,
    overwrite: bool = True,
) -> Tuple[int, int]:
    """
    Imports a CSV with columns:
    Entity, Code, Day, New cases (per 1M)
    and writes absolute values to today_cases using population from disease.sh /countries.
    """
    source_name = (source or SOURCE_NAME).strip() or SOURCE_NAME
    population_by_iso = _build_live_population_lookup()
    if not population_by_iso:
        raise RuntimeError("Unable to build population lookup from disease.sh countries endpoint")

    try:
        handle = open(file_path, newline="", encoding="utf-8")
    except OSError as exc:
        raise RuntimeError(f"Unable to open CSV file: {file_path}") from exc

    with handle:
        reader = csv.DictReader(handle)
        required_columns = {"Entity", "Code", "Day", "New cases (per 1M)"}
        missing_columns = required_columns - set(reader.fieldnames or [])
        if missing_columns:
            raise RuntimeError(
                f"CSV does not contain required columns: {', '.join(sorted(missing_columns))}"
            )

        location_cache: dict[str, Location] = {}
        pending_records: list[DataPoint] = []
        affected_locations: set[str] = set()
        processed_points = 0

        def flush_records() -> int:
            if not pending_records:
                return 0
            count = len(pending_records)
            if overwrite:
                DataPoint.objects.bulk_create(
                    pending_records,
                    batch_size=5000,
                    update_conflicts=True,
                    unique_fields=["location", "date", "metric", "source"],
                    update_fields=["value"],
                )
            else:
                DataPoint.objects.bulk_create(
                    pending_records,
                    batch_size=5000,
                    ignore_conflicts=True,
                )
            pending_records.clear()
            return count

        for row in reader:
            iso_code = (row.get("Code") or "").strip().upper()[:10]
            if not iso_code:
                continue

            point_date = _parse_iso_date(row.get("Day"))
            if not point_date:
                continue

            population = population_by_iso.get(iso_code)
            if population is None:
                continue

            today_cases = _estimate_absolute_from_per_million(
                per_million=row.get("New cases (per 1M)"),
                population=population,
            )
            if today_cases is None:
                continue

            location = location_cache.get(iso_code)
            if location is None:
                location = Location.objects.filter(iso_code=iso_code).first()
                if location is None:
                    location, _ = _upsert_location(
                        iso_code=iso_code,
                        name=(row.get("Entity") or iso_code).strip() or iso_code,
                    )
                location_cache[iso_code] = location

            affected_locations.add(iso_code)
            pending_records.append(
                DataPoint(
                    location=location,
                    date=point_date,
                    metric="today_cases",
                    source=source_name,
                    value=today_cases,
                )
            )

            if len(pending_records) >= 10000:
                processed_points += flush_records()

        processed_points += flush_records()

    log.info(
        "Per-million cases import finished: %s locations affected, %s datapoints processed (source=%s, overwrite=%s)",
        len(affected_locations),
        processed_points,
        source_name,
        overwrite,
    )
    return len(affected_locations), processed_points


def ingest_disease_states_data() -> Tuple[int, int]:
    created_states = 0
    upserted_points = 0

    state_records = _fetch_json(STATES_URL)
    if not isinstance(state_records, list) or not state_records:
        log.error("Disease.sh states payload is empty or invalid")
        raise RuntimeError("Disease.sh states payload is empty or invalid")

    with transaction.atomic():
        for record in state_records:
            state_name = _resolve_state_name(record)
            if not state_name:
                log.warning("Skipping state record without state name: %s", record)
                continue

            state_code = _resolve_state_code(state_name)
            state, created = State.objects.get_or_create(
                code=state_code,
                defaults={"name": state_name, "country_iso": "USA"},
            )
            if not created and state.name != state_name:
                state.name = state_name
                state.save(update_fields=["name"])

            created_states += int(created)
            point_date = _timestamp_to_date(record.get("updated"))

            metric_values = {metric: record.get(metric) for metric in ("cases", "deaths", "recovered", "population")}
            cases = metric_values.get("cases")
            deaths = metric_values.get("deaths")
            recovered = metric_values.get("recovered")
            if cases is not None and deaths is not None and recovered is not None:
                metric_values["active"] = cases - deaths - recovered
            else:
                metric_values["active"] = None

            for metric in STATE_METRICS:
                StateDataPoint.objects.update_or_create(
                    state=state,
                    date=point_date,
                    metric=metric,
                    source=STATE_SOURCE_NAME,
                    defaults={"value": metric_values.get(metric)},
                )
                upserted_points += 1

            for total_metric, today_metric in TODAY_METRIC_BY_TOTAL.items():
                today_value = _derive_today_from_previous_state(
                    state=state,
                    point_date=point_date,
                    total_metric=total_metric,
                    current_total=metric_values.get(total_metric),
                    source=STATE_SOURCE_NAME,
                )
                if today_value is None:
                    continue

                StateDataPoint.objects.update_or_create(
                    state=state,
                    date=point_date,
                    metric=today_metric,
                    source=STATE_SOURCE_NAME,
                    defaults={"value": today_value},
                )
                upserted_points += 1

    log.info(
        "Disease.sh states ingest finished: %s states affected, %s datapoints upserted",
        created_states,
        upserted_points,
    )
    return created_states, upserted_points


def ingest_disease_provinces_data(lastdays: str | int = "all") -> Tuple[int, int]:
    created_provinces = 0
    upserted_points = 0

    country_names = _discover_countries_with_provinces()
    if not country_names:
        log.info("Disease.sh provinces ingest skipped: no countries with province data discovered")
        return created_provinces, upserted_points

    fallback_map = _build_province_fallback_map(lastdays=lastdays)

    for country_name in country_names:
        province_names = _fetch_country_province_names(country_name)
        if not province_names:
            continue

        log.info("Syncing %s provinces for %s", len(province_names), country_name)

        for chunk in _chunked(province_names, 10):
            records = _fetch_country_province_records(country_name=country_name, province_names=chunk, lastdays=lastdays)
            chunk_fetched: set[str] = set()

            for record in records:
                province_name = _normalize_province_name(record.get("province"))
                if not province_name:
                    continue

                chunk_fetched.add(province_name.casefold())
                province, created = _upsert_province(country_name=country_name, province_name=province_name)
                created_provinces += int(created)
                upserted_points += _upsert_province_timeline(province, record.get("timeline") or {})

            missing = [name for name in chunk if name.casefold() not in chunk_fetched]
            for missing_name in missing:
                record = _fetch_single_country_province_record(
                    country_name=country_name,
                    province_name=missing_name,
                    lastdays=lastdays,
                    fallback_map=fallback_map,
                )
                if not record:
                    continue

                province_name = _normalize_province_name(record.get("province"))
                if not province_name:
                    continue

                province, created = _upsert_province(country_name=country_name, province_name=province_name)
                created_provinces += int(created)
                upserted_points += _upsert_province_timeline(province, record.get("timeline") or {})

    log.info(
        "Disease.sh provinces ingest finished: %s provinces affected, %s datapoints upserted",
        created_provinces,
        upserted_points,
    )
    return created_provinces, upserted_points


def get_ingest_status(source: str = SOURCE_NAME) -> dict[str, Any]:
    source_name = (source or SOURCE_NAME).strip() or SOURCE_NAME

    datapoints_qs = DataPoint.objects.filter(source=source_name)
    aggregates = datapoints_qs.aggregate(
        datapoints=Count("id"),
        first_date=Min("date"),
        latest_date=Max("date"),
    )

    metric_counts = {
        row["metric"]: row["total"]
        for row in datapoints_qs.values("metric").annotate(total=Count("id")).order_by("metric")
    }
    locations_qs = Location.objects.filter(datapoints__source=source_name).distinct()

    first_date = aggregates["first_date"]
    latest_date = aggregates["latest_date"]

    return {
        "source": source_name,
        "datapoints": aggregates["datapoints"] or 0,
        "locations": {
            "total": locations_qs.count(),
            "countries": locations_qs.exclude(iso_code="WORLD").count(),
            "includesWorld": locations_qs.filter(iso_code="WORLD").exists(),
        },
        "metrics": list(metric_counts.keys()),
        "metricCounts": metric_counts,
        "range": {
            "from": first_date.isoformat() if first_date else None,
            "to": latest_date.isoformat() if latest_date else None,
        },
    }


def get_state_ingest_status(source: str = STATE_SOURCE_NAME) -> dict[str, Any]:
    source_name = (source or STATE_SOURCE_NAME).strip() or STATE_SOURCE_NAME

    datapoints_qs = StateDataPoint.objects.filter(source=source_name)
    aggregates = datapoints_qs.aggregate(
        datapoints=Count("id"),
        first_date=Min("date"),
        latest_date=Max("date"),
    )
    metric_counts = {
        row["metric"]: row["total"]
        for row in datapoints_qs.values("metric").annotate(total=Count("id")).order_by("metric")
    }
    states_qs = State.objects.filter(datapoints__source=source_name).distinct()

    first_date = aggregates["first_date"]
    latest_date = aggregates["latest_date"]

    return {
        "source": source_name,
        "datapoints": aggregates["datapoints"] or 0,
        "states": states_qs.count(),
        "metrics": list(metric_counts.keys()),
        "metricCounts": metric_counts,
        "range": {
            "from": first_date.isoformat() if first_date else None,
            "to": latest_date.isoformat() if latest_date else None,
        },
    }


def get_province_ingest_status(source: str = PROVINCE_SOURCE_NAME) -> dict[str, Any]:
    source_name = (source or PROVINCE_SOURCE_NAME).strip() or PROVINCE_SOURCE_NAME

    datapoints_qs = ProvinceDataPoint.objects.filter(source=source_name)
    aggregates = datapoints_qs.aggregate(
        datapoints=Count("id"),
        first_date=Min("date"),
        latest_date=Max("date"),
    )
    metric_counts = {
        row["metric"]: row["total"]
        for row in datapoints_qs.values("metric").annotate(total=Count("id")).order_by("metric")
    }
    provinces_qs = Province.objects.filter(datapoints__source=source_name).distinct()

    first_date = aggregates["first_date"]
    latest_date = aggregates["latest_date"]

    return {
        "source": source_name,
        "datapoints": aggregates["datapoints"] or 0,
        "provinces": provinces_qs.count(),
        "countries": provinces_qs.values("country_name").distinct().count(),
        "metrics": list(metric_counts.keys()),
        "metricCounts": metric_counts,
        "range": {
            "from": first_date.isoformat() if first_date else None,
            "to": latest_date.isoformat() if latest_date else None,
        },
    }


def _to_number(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _estimate_absolute_from_per_million(per_million: Any, population: float | None) -> float | None:
    per_million_num = _to_number(per_million)
    if per_million_num is None or population is None or population <= 0:
        return None
    estimated = (per_million_num * population) / 1_000_000
    return float(max(round(estimated), 0))


def _estimate_absolute_from_per_thousand(per_thousand: Any, population: float | None) -> float | None:
    per_thousand_num = _to_number(per_thousand)
    if per_thousand_num is None or population is None or population <= 0:
        return None
    estimated = (per_thousand_num * population) / 1_000
    return float(max(round(estimated), 0))


def _estimate_absolute_from_per_hundred(per_hundred: Any, population: float | None) -> float | None:
    per_hundred_num = _to_number(per_hundred)
    if per_hundred_num is None or population is None or population <= 0:
        return None
    estimated = (per_hundred_num * population) / 100
    return float(max(round(estimated), 0))


def _append_today_deltas(date_bucket: Dict[date, Dict[str, float | int | None]]) -> None:
    for total_metric, today_metric in TODAY_METRIC_BY_TOTAL.items():
        previous_total: float | None = None
        has_previous = False
        for point_date in sorted(date_bucket.keys()):
            current_total = _to_number(date_bucket[point_date].get(total_metric))
            if current_total is None:
                continue
            if has_previous and previous_total is not None:
                date_bucket[point_date][today_metric] = max(current_total - previous_total, 0)
            previous_total = current_total
            has_previous = True


def _derive_today_from_previous_location(
    location: Location,
    point_date: date,
    total_metric: str,
    current_total: Any,
    source: str,
) -> float | None:
    current_total_num = _to_number(current_total)
    if current_total_num is None:
        return None

    previous = (
        DataPoint.objects.filter(
            location=location,
            metric=total_metric,
            source=source,
            date__lt=point_date,
        )
        .order_by("-date")
        .first()
    )
    previous_total = _to_number(previous.value if previous else None)
    if previous_total is None:
        return None
    return max(current_total_num - previous_total, 0)


def _derive_today_from_previous_state(
    state: State,
    point_date: date,
    total_metric: str,
    current_total: Any,
    source: str,
) -> float | None:
    current_total_num = _to_number(current_total)
    if current_total_num is None:
        return None

    previous = (
        StateDataPoint.objects.filter(
            state=state,
            metric=total_metric,
            source=source,
            date__lt=point_date,
        )
        .order_by("-date")
        .first()
    )
    previous_total = _to_number(previous.value if previous else None)
    if previous_total is None:
        return None
    return max(current_total_num - previous_total, 0)


def _fetch_json(url: str):
    last_exc: Exception | None = None
    for attempt in range(1, 4):
        try:
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            return response.json()
        except RequestException as exc:
            last_exc = exc
            if attempt >= 3:
                log.exception("Failed to fetch data from %s: %s", url, exc)
                raise RuntimeError(f"Unable to fetch data from {url}") from exc
            wait_seconds = attempt * 1.5
            log.warning(
                "Fetch attempt %s/3 failed for %s: %s. Retrying in %.1fs",
                attempt,
                url,
                exc,
                wait_seconds,
            )
            time.sleep(wait_seconds)
        except ValueError as exc:
            snippet = response.text[:200]
            log.error("Non-JSON response from %s: snippet=%r", url, snippet)
            raise RuntimeError(f"Invalid JSON from {url}") from exc

    raise RuntimeError(f"Unable to fetch data from {url}") from last_exc


def _try_fetch_json(url: str):
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
    except RequestException as exc:
        log.warning("Optional fetch failed for %s: %s", url, exc)
        return None

    try:
        return response.json()
    except ValueError:
        log.warning("Optional fetch returned non-JSON payload for %s", url)
        return None


def _build_country_iso_lookup() -> dict[str, str]:
    payload = _try_fetch_json(COUNTRIES_URL)
    if not isinstance(payload, list):
        return {}

    lookup: dict[str, str] = {}
    for item in payload:
        if not isinstance(item, dict):
            continue
        country_raw = item.get("country")
        if not isinstance(country_raw, str):
            continue
        country_name = country_raw.strip()
        if not country_name:
            continue
        info = item.get("countryInfo") or {}
        if not isinstance(info, dict):
            continue
        iso = info.get("iso3") or info.get("iso2")
        if not iso:
            continue
        lookup[country_name.casefold()] = str(iso).upper()[:10]
    return lookup


def _build_live_population_lookup() -> dict[str, float]:
    payload = _try_fetch_json(COUNTRIES_URL)
    if not isinstance(payload, list):
        return {}

    lookup: dict[str, float] = {}
    for item in payload:
        if not isinstance(item, dict):
            continue
        iso = _resolve_iso_code(item)
        if not iso:
            continue
        population = _to_number(item.get("population"))
        if population is None or population <= 0:
            continue
        lookup[iso] = population
    return lookup


def _resolve_iso_code(record: dict, country_iso_lookup: dict[str, str] | None = None) -> str | None:
    info = record.get("countryInfo") or {}
    iso = info.get("iso3") or info.get("iso2")
    if iso:
        return iso.upper()[:10]
    name = record.get("country")
    if not name:
        return None

    country_name = str(name).strip()
    if not country_name:
        return None

    mapped_iso = None
    if country_iso_lookup:
        mapped_iso = country_iso_lookup.get(country_name.casefold())
    if mapped_iso:
        return mapped_iso

    existing_iso = (
        Location.objects.filter(name__iexact=country_name).values_list("iso_code", flat=True).first()
    )
    if existing_iso:
        return str(existing_iso).upper()[:10]

    normalized = slugify(country_name, allow_unicode=False).replace("-", "").upper()
    return normalized[:10] or None


def _resolve_continent_name(record: dict) -> str | None:
    value = record.get("continent")
    if not isinstance(value, str):
        return None
    normalized = value.strip()
    return normalized or None


def _resolve_state_name(record: dict) -> str | None:
    value = record.get("state")
    if not isinstance(value, str):
        return None
    normalized = value.strip()
    return normalized or None


def _resolve_state_code(state_name: str) -> str:
    normalized = slugify(state_name, allow_unicode=False).replace("-", "_").upper()
    if not normalized:
        normalized = "UNKNOWN"
    raw_code = f"US_{normalized}"
    if len(raw_code) <= 32:
        return raw_code
    suffix = md5(raw_code.encode("utf-8")).hexdigest()[:6].upper()
    return f"{raw_code[:25]}_{suffix}"[:32]


def _normalize_province_name(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    normalized = value.strip()
    return normalized or None


def _province_code(country_name: str, province_name: str) -> str:
    country_token = slugify(country_name, allow_unicode=False).replace("-", "_").upper() or "COUNTRY"
    province_token = slugify(province_name, allow_unicode=False).replace("-", "_").upper() or "PROVINCE"
    raw_code = f"{country_token}__{province_token}"
    if len(raw_code) <= 64:
        return raw_code
    suffix = md5(raw_code.encode("utf-8")).hexdigest()[:8].upper()
    return f"{raw_code[:55]}_{suffix}"[:64]


def _encode_path_part(value: str) -> str:
    return quote(value, safe="")


def _discover_countries_with_provinces() -> list[str]:
    records = _fetch_json(f"{HISTORICAL_COUNTRIES_URL}?lastdays=1")
    if not isinstance(records, list):
        raise RuntimeError("Disease.sh historical discovery payload is invalid")

    countries = sorted(
        {
            str(record.get("country")).strip()
            for record in records
            if _normalize_province_name(record.get("province")) and record.get("country")
        }
    )
    return countries


def _fetch_country_province_names(country_name: str) -> list[str]:
    payload = _fetch_json(f"{HISTORICAL_COUNTRIES_URL}/{_encode_path_part(country_name)}?lastdays=1")
    if not isinstance(payload, dict):
        return []

    province_field = payload.get("province")
    if isinstance(province_field, str):
        province_name = _normalize_province_name(province_field)
        return [province_name] if province_name else []
    if isinstance(province_field, list):
        normalized: list[str] = []
        for item in province_field:
            province_name = _normalize_province_name(item)
            if province_name:
                normalized.append(province_name)
        return normalized
    return []


def _fetch_country_province_records(country_name: str, province_names: list[str], lastdays: str | int) -> list[dict]:
    encoded_provinces = ",".join(_encode_path_part(name) for name in province_names)
    payload = _fetch_json(
        f"{HISTORICAL_COUNTRIES_URL}/{_encode_path_part(country_name)}/{encoded_provinces}?lastdays={lastdays}"
    )
    if isinstance(payload, dict):
        return [payload]
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    return []


def _fetch_single_country_province_record(
    country_name: str,
    province_name: str,
    lastdays: str | int,
    fallback_map: dict[tuple[str, str], dict],
) -> dict | None:
    fallback = fallback_map.get((country_name.casefold(), province_name.casefold()))
    if fallback:
        return fallback

    payload = _try_fetch_json(
        f"{HISTORICAL_COUNTRIES_URL}/{_encode_path_part(country_name)}/{_encode_path_part(province_name)}"
        f"?lastdays={lastdays}"
    )

    if isinstance(payload, dict):
        return payload

    log.warning("Unable to fetch province %s/%s", country_name, province_name)
    return None


def _build_province_fallback_map(lastdays: str | int) -> dict[tuple[str, str], dict]:
    payload = _fetch_json(f"{HISTORICAL_COUNTRIES_URL}?lastdays={lastdays}")
    if not isinstance(payload, list):
        return {}

    mapping: dict[tuple[str, str], dict] = {}
    for item in payload:
        if not isinstance(item, dict):
            continue
        country_name_raw = item.get("country")
        province_name = _normalize_province_name(item.get("province"))
        if not country_name_raw or not province_name:
            continue
        country_name = str(country_name_raw).strip()
        if not country_name:
            continue
        mapping[(country_name.casefold(), province_name.casefold())] = item
    return mapping


def _upsert_province(country_name: str, province_name: str) -> tuple[Province, bool]:
    code = _province_code(country_name=country_name, province_name=province_name)
    country = (
        Location.objects.filter(name__iexact=country_name).first()
        or Location.objects.filter(iso_code__iexact=country_name).first()
    )
    defaults: dict[str, Any] = {
        "name": province_name,
        "country_name": country_name,
        "country": country,
    }
    province, created = Province.objects.get_or_create(code=code, defaults=defaults)
    if created:
        return province, True

    updates: dict[str, Any] = {}
    if province.name != province_name:
        updates["name"] = province_name
    if province.country_name != country_name:
        updates["country_name"] = country_name
    if country and province.country_id != country.id:
        updates["country"] = country

    if updates:
        for field, value in updates.items():
            setattr(province, field, value)
        province.save(update_fields=list(updates.keys()))

    return province, False


def _upsert_province_timeline(province: Province, timeline: Dict) -> int:
    date_bucket: Dict[date, Dict[str, float | int | None]] = {}
    for metric in ("cases", "deaths", "recovered"):
        series = timeline.get(metric) or {}
        if not isinstance(series, dict):
            continue
        for date_str, value in series.items():
            parsed_date = _parse_hist_date(date_str)
            if not parsed_date:
                continue
            date_bucket.setdefault(parsed_date, {})[metric] = value

    _append_today_deltas(date_bucket)

    records = []
    for point_date, metrics in date_bucket.items():
        cases = metrics.get("cases")
        deaths = metrics.get("deaths")
        recovered = metrics.get("recovered")
        if cases is not None and deaths is not None and recovered is not None:
            metrics["active"] = cases - deaths - recovered

        for metric in (*PROVINCE_METRICS, *TODAY_METRICS):
            records.append(
                ProvinceDataPoint(
                    province=province,
                    date=point_date,
                    metric=metric,
                    source=PROVINCE_SOURCE_NAME,
                    value=metrics.get(metric),
                )
            )

    if not records:
        return 0

    ProvinceDataPoint.objects.bulk_create(
        records,
        batch_size=5000,
        update_conflicts=True,
        unique_fields=["province", "date", "metric", "source"],
        update_fields=["value"],
    )
    return len(records)


def _chunked(values: list[str], size: int) -> list[list[str]]:
    if size <= 0:
        return [values]
    return [values[idx : idx + size] for idx in range(0, len(values), size)]


def _continent_code(name: str) -> str:
    code = slugify(name, allow_unicode=False).replace("-", "_").upper()
    if not code:
        code = name.upper().replace(" ", "_")
    return code[:32]


def _ensure_continent(name: str | None) -> Continent | None:
    if not name:
        return None

    continent, created = Continent.objects.get_or_create(
        code=_continent_code(name),
        defaults={"name": name},
    )
    if not created and continent.name != name:
        continent.name = name
        continent.save(update_fields=["name"])
    return continent


def _upsert_location(iso_code: str, name: str, continent_name: str | None = None) -> tuple[Location, bool]:
    continent = _ensure_continent(continent_name)
    defaults = {"name": name}
    if continent:
        defaults["continent"] = continent

    location, created = Location.objects.get_or_create(iso_code=iso_code, defaults=defaults)

    updates: dict[str, Any] = {}
    if location.name != name:
        updates["name"] = name
    if continent and location.continent_id != continent.id:
        updates["continent"] = continent

    if updates:
        for field, value in updates.items():
            setattr(location, field, value)
        location.save(update_fields=list(updates.keys()))

    _merge_location_aliases(location)
    return location, created


def _merge_location_aliases(canonical: Location) -> None:
    aliases = list(
        Location.objects.filter(name__iexact=canonical.name)
        .exclude(pk=canonical.pk)
        .only("id", "iso_code", "name")
    )
    if not aliases:
        return

    for alias in aliases:
        alias_points = list(
            DataPoint.objects.filter(location=alias).only("date", "metric", "source", "value")
        )
        if alias_points:
            DataPoint.objects.bulk_create(
                [
                    DataPoint(
                        location=canonical,
                        date=point.date,
                        metric=point.metric,
                        source=point.source,
                        value=point.value,
                    )
                    for point in alias_points
                ],
                batch_size=5000,
                update_conflicts=True,
                unique_fields=["location", "date", "metric", "source"],
                update_fields=["value"],
            )

        Province.objects.filter(country=alias).update(country=canonical, country_name=canonical.name)
        alias.delete()


def _timestamp_to_date(timestamp_ms) -> date:
    if not timestamp_ms:
        return datetime.now(tz=timezone.utc).date()
    try:
        return datetime.fromtimestamp(timestamp_ms / 1000, tz=timezone.utc).date()
    except (TypeError, ValueError):
        log.warning("Unexpected timestamp %r; defaulting to today", timestamp_ms)
        return datetime.now(tz=timezone.utc).date()


def _parse_hist_date(value: str) -> date | None:
    """Parses dates like '1/22/20' used by disease.sh historical endpoints."""
    if not value:
        return None
    try:
        return datetime.strptime(value, "%m/%d/%y").date()
    except ValueError:
        log.warning("Unexpected historical date format: %r", value)
        return None


def _parse_iso_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        log.warning("Unexpected ISO date format: %r", value)
        return None


def _upsert_timeline(location: Location, timeline: Dict) -> int:
    """Upserts all metrics for a location given a disease.sh timeline object using bulk UPSERT for speed."""
    date_bucket: Dict[date, Dict[str, float | int | None]] = {}
    for metric in ("cases", "deaths", "recovered"):
        series = timeline.get(metric) or {}
        if not isinstance(series, dict):
            continue
        for date_str, value in series.items():
            parsed_date = _parse_hist_date(date_str)
            if not parsed_date:
                continue
            date_bucket.setdefault(parsed_date, {})[metric] = value

    _append_today_deltas(date_bucket)

    records = []
    for point_date, metrics in date_bucket.items():
        cases = metrics.get("cases")
        deaths = metrics.get("deaths")
        recovered = metrics.get("recovered")
        if cases is not None and deaths is not None and recovered is not None:
            metrics["active"] = cases - deaths - recovered

        for metric, value in metrics.items():
            records.append(
                DataPoint(
                    location=location,
                    date=point_date,
                    metric=metric,
                    source=SOURCE_NAME,
                    value=value,
                )
            )

    if not records:
        return 0

    # bulk UPSERT: relies on unique_together (location, date, metric, source)
    DataPoint.objects.bulk_create(
        records,
        batch_size=5000,
        update_conflicts=True,
        unique_fields=["location", "date", "metric", "source"],
        update_fields=["value"],
    )
    return len(records)
