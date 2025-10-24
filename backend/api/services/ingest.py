import logging
from datetime import date, datetime, timezone
from typing import Tuple

import requests
from django.db import transaction
from django.utils.text import slugify
from requests import RequestException

from api.models import DataPoint, Location

log = logging.getLogger(__name__)

COUNTRIES_URL = "https://disease.sh/v3/covid-19/countries"
GLOBAL_URL = "https://disease.sh/v3/covid-19/all"
SOURCE_NAME = "disease.sh"
METRICS = ("cases", "deaths", "recovered", "active", "tests")


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
            location, created = Location.objects.get_or_create(
                iso_code=iso_code,
                defaults={"name": location_name},
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

    global_record = _fetch_json(GLOBAL_URL)
    if isinstance(global_record, dict) and global_record:
        with transaction.atomic():
            location, created = Location.objects.get_or_create(
                iso_code="WORLD",
                defaults={"name": "World"},
            )
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
    else:
        log.warning("Disease.sh global payload missing or invalid: %s", type(global_record))

    log.info(
        "Disease.sh ingest finished: %s locations affected, %s datapoints upserted",
        created_locations,
        upserted_points,
    )
    return created_locations, upserted_points


def _fetch_json(url: str):
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
    except RequestException as exc:
        log.exception("Failed to fetch data from %s: %s", url, exc)
        raise RuntimeError(f"Unable to fetch data from {url}") from exc

    try:
        return response.json()
    except ValueError as exc:
        snippet = response.text[:200]
        log.error("Non-JSON response from %s: snippet=%r", url, snippet)
        raise RuntimeError(f"Invalid JSON from {url}") from exc


def _resolve_iso_code(record: dict) -> str | None:
    info = record.get("countryInfo") or {}
    iso = info.get("iso3") or info.get("iso2")
    if iso:
        return iso.upper()[:10]
    name = record.get("country")
    if not name:
        return None
    normalized = slugify(name, allow_unicode=False).replace("-", "").upper()
    return normalized[:10] or None


def _timestamp_to_date(timestamp_ms) -> date:
    if not timestamp_ms:
        return datetime.now(tz=timezone.utc).date()
    try:
        return datetime.fromtimestamp(timestamp_ms / 1000, tz=timezone.utc).date()
    except (TypeError, ValueError):
        log.warning("Unexpected timestamp %r; defaulting to today", timestamp_ms)
        return datetime.now(tz=timezone.utc).date()
