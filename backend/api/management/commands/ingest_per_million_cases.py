from django.core.management.base import BaseCommand, CommandError

from api.services.ingest import ingest_per_million_cases_file


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

        try:
            locations, points = ingest_per_million_cases_file(
                file_path=file_path,
                source=source,
                overwrite=overwrite,
            )
        except RuntimeError as exc:
            raise CommandError(str(exc)) from exc

        self.stdout.write(
            self.style.SUCCESS(
                f"Per-million cases import updated: {locations} affected locations, {points} records"
            )
        )
