from datetime import date

from django.core.management.base import BaseCommand, CommandError

from api.services.ingest import OWID_CSV_URL, ingest_owid_backfill


class Command(BaseCommand):
    help = "Backfills COVID-19 gaps from OWID CSV into DataPoint"

    def add_arguments(self, parser):
        parser.add_argument(
            "--from",
            dest="from_date",
            default="2023-03-10",
            help="Start date (YYYY-MM-DD), defaults to first missing day after disease.sh historical.",
        )
        parser.add_argument(
            "--to",
            dest="to_date",
            default=None,
            help="Optional end date (YYYY-MM-DD).",
        )
        parser.add_argument(
            "--source",
            dest="source",
            default="disease.sh",
            help="DataPoint source value to write (default: disease.sh).",
        )
        parser.add_argument(
            "--csv-url",
            dest="csv_url",
            default=None,
            help="Override OWID CSV URL.",
        )

    def handle(self, *args, **options):
        from_date = self._parse_iso_date(options.get("from_date"), "--from")
        to_date = self._parse_iso_date(options.get("to_date"), "--to")
        source = options.get("source") or "disease.sh"
        csv_url = options.get("csv_url")

        try:
            locations, points = ingest_owid_backfill(
                from_date=from_date,
                to_date=to_date,
                source=source,
                csv_url=csv_url or OWID_CSV_URL,
            )
        except RuntimeError as exc:
            raise CommandError(str(exc)) from exc

        self.stdout.write(
            self.style.SUCCESS(
                f"OWID backfill updated: {locations} affected locations, {points} records"
            )
        )

    @staticmethod
    def _parse_iso_date(value: str | None, flag_name: str) -> date | None:
        if not value:
            return None
        try:
            return date.fromisoformat(value)
        except ValueError as exc:
            raise CommandError(f"Invalid date for {flag_name}: {value}") from exc
