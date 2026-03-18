from datetime import date

from celery import shared_task

from api.services.ingest import (
    OWID_CSV_URL,
    ingest_disease_data,
    ingest_disease_historical as ingest_disease_historical_data,
    ingest_disease_provinces_data,
    ingest_disease_states_data,
    ingest_owid_backfill as ingest_owid_backfill_data,
    ingest_per_million_cases_file as ingest_per_million_cases_file_data,
)
from api.views import precompute_summary_cache as precompute_summary_cache_payloads


def _parse_optional_iso_date(value: str | None) -> date | None:
    if not value:
        return None
    return date.fromisoformat(value)


@shared_task(bind=True, autoretry_for=(RuntimeError,), retry_backoff=True, retry_kwargs={"max_retries": 3})
def ingest_disease_latest(self):
    ingest_disease_data()


@shared_task(bind=True, autoretry_for=(RuntimeError,), retry_backoff=True, retry_kwargs={"max_retries": 3})
def ingest_disease_states(self):
    ingest_disease_states_data()


@shared_task(bind=True, autoretry_for=(RuntimeError,), retry_backoff=True, retry_kwargs={"max_retries": 3})
def ingest_disease_historical(self, lastdays: str | int = "30"):
    ingest_disease_historical_data(lastdays=lastdays)


@shared_task(bind=True, autoretry_for=(RuntimeError,), retry_backoff=True, retry_kwargs={"max_retries": 3})
def ingest_disease_provinces(self, lastdays: str | int = "30"):
    ingest_disease_provinces_data(lastdays=lastdays)


@shared_task(bind=True, autoretry_for=(RuntimeError,), retry_backoff=True, retry_kwargs={"max_retries": 3})
def ingest_disease(
    self,
    lastdays: str | int = "30",
    province_lastdays: str | int = "30",
    skip_historical: bool = False,
    skip_latest: bool = False,
    skip_states: bool = False,
    skip_provinces: bool = False,
):
    """
    Backwards-compatible aggregate task that runs all disease.sh ingestion steps.
    """
    if skip_historical and skip_latest and skip_states and skip_provinces:
        raise RuntimeError("Nothing to run: all skip flags were provided.")

    if not skip_historical:
        ingest_disease_historical_data(lastdays=lastdays)
    if not skip_latest:
        ingest_disease_data()
    if not skip_states:
        ingest_disease_states_data()
    if not skip_provinces:
        ingest_disease_provinces_data(lastdays=province_lastdays)


@shared_task(bind=True, autoretry_for=(RuntimeError,), retry_backoff=True, retry_kwargs={"max_retries": 3})
def precompute_summary_cache(self):
    return precompute_summary_cache_payloads()


@shared_task(bind=True, autoretry_for=(RuntimeError,), retry_backoff=True, retry_kwargs={"max_retries": 3})
def ingest_owid_backfill(
    self,
    from_date: str | None = None,
    to_date: str | None = None,
    source: str = "disease.sh",
    csv_url: str = OWID_CSV_URL,
):
    return ingest_owid_backfill_data(
        from_date=_parse_optional_iso_date(from_date),
        to_date=_parse_optional_iso_date(to_date),
        source=source,
        csv_url=csv_url,
    )


@shared_task(bind=True, autoretry_for=(RuntimeError,), retry_backoff=True, retry_kwargs={"max_retries": 3})
def ingest_per_million_cases_file(
    self,
    file_path: str,
    source: str = "disease.sh",
    overwrite: bool = True,
):
    return ingest_per_million_cases_file_data(
        file_path=file_path,
        source=source,
        overwrite=overwrite,
    )
