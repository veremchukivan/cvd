import hashlib
import json
import logging
from datetime import date, datetime

from django.conf import settings
from django.core.cache import cache

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
