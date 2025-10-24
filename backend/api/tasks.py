from celery import shared_task

from api.services.ingest import ingest_disease_data


@shared_task(bind=True, autoretry_for=(RuntimeError,), retry_backoff=True, retry_kwargs={"max_retries": 3})
def ingest_disease(self):
    ingest_disease_data()
