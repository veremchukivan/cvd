from django.core.management.base import BaseCommand, CommandError

from api.services.ingest import ingest_disease_states_data


class Command(BaseCommand):
    help = "Loads US state COVID-19 data from disease.sh into the database"

    def handle(self, *args, **options):
        try:
            states, points = ingest_disease_states_data()
        except RuntimeError as exc:
            raise CommandError(str(exc)) from exc

        self.stdout.write(
            self.style.SUCCESS(
                f"disease.sh states data updated: {states} affected states, {points} records"
            )
        )
