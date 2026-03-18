from django.core.management.base import BaseCommand, CommandError

from api.tasks import ingest_disease as ingest_disease_task

from ._queue import queue_task


class Command(BaseCommand):
    help = "Runs full disease.sh sync (historical + latest + states + provinces) into local database"

    def add_arguments(self, parser):
        parser.add_argument(
            "--lastdays",
            default="all",
            help="Historical window for disease.sh/historical endpoint. Use integer or 'all'.",
        )
        parser.add_argument(
            "--skip-historical",
            action="store_true",
            help="Skip historical backfill and only sync latest snapshot.",
        )
        parser.add_argument(
            "--skip-latest",
            action="store_true",
            help="Skip latest snapshot and only sync historical data.",
        )
        parser.add_argument(
            "--skip-states",
            action="store_true",
            help="Skip US states sync.",
        )
        parser.add_argument(
            "--skip-provinces",
            action="store_true",
            help="Skip province sync for countries that expose province timelines.",
        )
        parser.add_argument(
            "--province-lastdays",
            default="all",
            help="Historical window for province timelines. Use integer or 'all'.",
        )

    def handle(self, *args, **options):
        skip_historical = bool(options.get("skip_historical"))
        skip_latest = bool(options.get("skip_latest"))
        skip_states = bool(options.get("skip_states"))
        skip_provinces = bool(options.get("skip_provinces"))
        lastdays = options.get("lastdays") or "all"
        province_lastdays = options.get("province_lastdays") or "all"

        if skip_historical and skip_latest and skip_states and skip_provinces:
            raise CommandError(
                "Nothing to run: all skip flags were provided."
            )

        queue_task(
            task=ingest_disease_task,
            label="disease.sh sync",
            stdout=self.stdout,
            style=self.style,
            kwargs={
                "lastdays": lastdays,
                "province_lastdays": province_lastdays,
                "skip_historical": skip_historical,
                "skip_latest": skip_latest,
                "skip_states": skip_states,
                "skip_provinces": skip_provinces,
            },
        )
