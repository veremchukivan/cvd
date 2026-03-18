from django.core.management.base import BaseCommand

from api.tasks import ingest_disease_provinces as ingest_disease_provinces_task

from ._queue import queue_task


class Command(BaseCommand):
    help = "Loads province-level historical COVID-19 data from disease.sh into the database"

    def add_arguments(self, parser):
        parser.add_argument(
            "--lastdays",
            default="all",
            help="Historical window for province timeline requests. Use integer or 'all'.",
        )

    def handle(self, *args, **options):
        lastdays = options.get("lastdays") or "all"
        queue_task(
            task=ingest_disease_provinces_task,
            label="disease.sh provinces ingest",
            stdout=self.stdout,
            style=self.style,
            kwargs={"lastdays": lastdays},
        )
