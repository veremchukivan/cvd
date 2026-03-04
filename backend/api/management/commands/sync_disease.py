from django.core.management.base import BaseCommand, CommandError

from api.services.ingest import (
    ingest_disease_data,
    ingest_disease_historical,
    ingest_disease_provinces_data,
    ingest_disease_states_data,
)


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
        run_historical = not options.get("skip_historical")
        run_latest = not options.get("skip_latest")
        run_states = not options.get("skip_states")
        run_provinces = not options.get("skip_provinces")
        lastdays = options.get("lastdays") or "all"
        province_lastdays = options.get("province_lastdays") or "all"

        if not run_historical and not run_latest and not run_states and not run_provinces:
            raise CommandError(
                "Nothing to run: all skip flags were provided."
            )

        total_locations = 0
        total_points = 0
        phase_messages: list[str] = []

        if run_historical:
            try:
                locations, points = ingest_disease_historical(lastdays=lastdays)
            except RuntimeError as exc:
                raise CommandError(f"Historical sync failed: {exc}") from exc
            total_locations += locations
            total_points += points
            phase_messages.append(f"historical={locations} locations, {points} points")

        if run_latest:
            try:
                locations, points = ingest_disease_data()
            except RuntimeError as exc:
                raise CommandError(f"Latest snapshot sync failed: {exc}") from exc
            total_locations += locations
            total_points += points
            phase_messages.append(f"latest={locations} locations, {points} points")

        if run_states:
            try:
                states, points = ingest_disease_states_data()
            except RuntimeError as exc:
                raise CommandError(f"States sync failed: {exc}") from exc
            total_locations += states
            total_points += points
            phase_messages.append(f"states={states} states, {points} points")

        if run_provinces:
            try:
                provinces, points = ingest_disease_provinces_data(lastdays=province_lastdays)
            except RuntimeError as exc:
                raise CommandError(f"Provinces sync failed: {exc}") from exc
            total_locations += provinces
            total_points += points
            phase_messages.append(f"provinces={provinces} provinces, {points} points")

        phases = "; ".join(phase_messages)
        self.stdout.write(
            self.style.SUCCESS(
                f"Sync complete: {phases}. Total affected locations={total_locations}, total records={total_points}."
            )
        )
