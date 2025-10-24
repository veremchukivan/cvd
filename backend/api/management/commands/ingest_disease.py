from django.core.management.base import BaseCommand, CommandError

from api.services.ingest import ingest_disease_data


class Command(BaseCommand):
    help = "Loads COVID-19 data from disease.sh into the database"

    def handle(self, *args, **options):
        try:
            locations, points = ingest_disease_data()
        except RuntimeError as exc:
            raise CommandError(str(exc)) from exc

        self.stdout.write(
            self.style.SUCCESS(
                f"disease.sh data updated: {locations} affected locations, {points} records"
            )
        )
