from celery import shared_task

from api.services.ingest import (
    ingest_disease_data,
    ingest_disease_historical as ingest_disease_historical_data,
    ingest_disease_provinces_data,
    ingest_disease_states_data,
)


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
def ingest_disease(self, lastdays: str | int = "30", province_lastdays: str | int = "30"):
    """
    Backwards-compatible aggregate task that runs all disease.sh ingestion steps.
    """
    ingest_disease_historical_data(lastdays=lastdays)
    ingest_disease_data()
    ingest_disease_states_data()
    ingest_disease_provinces_data(lastdays=province_lastdays)
