from django.core.management.base import BaseCommand, CommandError

from api.services.ingest import ingest_disease_provinces_data


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
        try:
            provinces, points = ingest_disease_provinces_data(lastdays=lastdays)
        except RuntimeError as exc:
            raise CommandError(str(exc)) from exc

        self.stdout.write(
            self.style.SUCCESS(
                f"disease.sh provinces data updated: {provinces} affected provinces, {points} records"
            )
        )
