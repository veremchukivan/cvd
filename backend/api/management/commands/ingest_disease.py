from django.core.management.base import BaseCommand

from api.tasks import ingest_disease_latest as ingest_disease_latest_task

from ._queue import queue_task


class Command(BaseCommand):
    help = "Loads COVID-19 data from disease.sh into the database"

    def handle(self, *args, **options):
        queue_task(
            task=ingest_disease_latest_task,
            label="disease.sh latest ingest",
            stdout=self.stdout,
            style=self.style,
        )
