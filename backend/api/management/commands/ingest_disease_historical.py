from django.core.management.base import BaseCommand

from api.tasks import ingest_disease_historical as ingest_disease_historical_task

from ._queue import queue_task


class Command(BaseCommand):
    help = "Loads full historical COVID-19 time series from disease.sh into the database"

    def add_arguments(self, parser):
        parser.add_argument(
            "--lastdays",
            default="all",
            help="Number of days to fetch (integer) or 'all' for full history (default).",
        )

    def handle(self, *args, **options):
        lastdays = options.get("lastdays") or "all"
        queue_task(
            task=ingest_disease_historical_task,
            label="disease.sh historical ingest",
            stdout=self.stdout,
            style=self.style,
            kwargs={"lastdays": lastdays},
        )
