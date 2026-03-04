from django.core.management.base import BaseCommand, CommandError

from api.services.ingest import ingest_disease_historical


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
        try:
            locations, points = ingest_disease_historical(lastdays=lastdays)
        except RuntimeError as exc:
            raise CommandError(str(exc)) from exc

        self.stdout.write(
            self.style.SUCCESS(
                f"disease.sh historical data updated: {locations} affected locations, {points} records"
            )
        )
