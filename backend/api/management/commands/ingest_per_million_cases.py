from django.core.management.base import BaseCommand

from api.tasks import ingest_per_million_cases_file as ingest_per_million_cases_file_task

from ._queue import queue_task


class Command(BaseCommand):
    help = "Imports per-million daily new cases CSV and stores absolute today_cases"

    def add_arguments(self, parser):
        parser.add_argument(
            "--file",
            required=True,
            help="Path to CSV file with columns Entity, Code, Day, New cases (per 1M).",
        )
        parser.add_argument(
            "--source",
            default="disease.sh",
            help="DataPoint source value to write (default: disease.sh).",
        )
        parser.add_argument(
            "--no-overwrite",
            action="store_true",
            help="Do not overwrite existing today_cases rows; insert only missing rows.",
        )

    def handle(self, *args, **options):
        file_path = options.get("file")
        source = options.get("source") or "disease.sh"
        overwrite = not bool(options.get("no_overwrite"))

        queue_task(
            task=ingest_per_million_cases_file_task,
            label="per-million cases import",
            stdout=self.stdout,
            style=self.style,
            kwargs={
                "file_path": file_path,
                "source": source,
                "overwrite": overwrite,
            },
        )
