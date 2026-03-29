from datetime import date
from io import StringIO
from types import SimpleNamespace
from unittest.mock import patch

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase

from api.services.ingest import (
    _estimate_absolute_from_per_hundred,
    _estimate_absolute_from_per_million,
    _estimate_absolute_from_per_thousand,
    _fetch_single_country_province_record,
)

class SyncDiseaseCommandTests(TestCase):
    @patch("api.management.commands.sync_disease.ingest_disease_task.apply_async")
    def test_runs_all_by_default(self, apply_async_mock):
        apply_async_mock.return_value = SimpleNamespace(id="task-sync-all")
        output = StringIO()

        call_command("sync_disease", stdout=output)

        apply_async_mock.assert_called_once_with(
            args=(),
            kwargs={
                "lastdays": "all",
                "province_lastdays": "all",
                "skip_historical": False,
                "skip_latest": False,
                "skip_states": False,
                "skip_provinces": False,
            },
        )
        self.assertIn("Queued disease.sh sync via Celery worker", output.getvalue())
        self.assertIn("task-sync-all", output.getvalue())

    @patch("api.management.commands.sync_disease.ingest_disease_task.apply_async")
    def test_skip_historical_runs_latest_states_and_provinces(self, apply_async_mock):
        apply_async_mock.return_value = SimpleNamespace(id="task-sync-partial")
        output = StringIO()

        call_command("sync_disease", "--skip-historical", stdout=output)

        apply_async_mock.assert_called_once_with(
            args=(),
            kwargs={
                "lastdays": "all",
                "province_lastdays": "all",
                "skip_historical": True,
                "skip_latest": False,
                "skip_states": False,
                "skip_provinces": False,
            },
        )
        self.assertIn("task-sync-partial", output.getvalue())

    def test_raises_if_both_stages_are_skipped(self):
        with self.assertRaises(CommandError):
            call_command(
                "sync_disease",
                "--skip-historical",
                "--skip-latest",
                "--skip-states",
                "--skip-provinces",
            )

class AsyncIngestCommandTests(TestCase):
    @patch("api.management.commands.ingest_disease.ingest_disease_latest_task.apply_async")
    def test_ingest_disease_queues_latest_task(self, apply_async_mock):
        apply_async_mock.return_value = SimpleNamespace(id="task-latest")
        output = StringIO()

        call_command("ingest_disease", stdout=output)

        apply_async_mock.assert_called_once_with(args=(), kwargs={})
        self.assertIn("task-latest", output.getvalue())

    @patch("api.management.commands.ingest_disease_states.ingest_disease_states_task.apply_async")
    def test_ingest_disease_states_queues_states_task(self, apply_async_mock):
        apply_async_mock.return_value = SimpleNamespace(id="task-states")
        output = StringIO()

        call_command("ingest_disease_states", stdout=output)

        apply_async_mock.assert_called_once_with(args=(), kwargs={})
        self.assertIn("task-states", output.getvalue())

    @patch("api.management.commands.ingest_disease_historical.ingest_disease_historical_task.apply_async")
    def test_ingest_disease_historical_queues_historical_task(self, apply_async_mock):
        apply_async_mock.return_value = SimpleNamespace(id="task-historical")
        output = StringIO()

        call_command("ingest_disease_historical", "--lastdays", "30", stdout=output)

        apply_async_mock.assert_called_once_with(args=(), kwargs={"lastdays": "30"})
        self.assertIn("task-historical", output.getvalue())

    @patch("api.management.commands.ingest_disease_provinces.ingest_disease_provinces_task.apply_async")
    def test_ingest_disease_provinces_queues_provinces_task(self, apply_async_mock):
        apply_async_mock.return_value = SimpleNamespace(id="task-provinces")
        output = StringIO()

        call_command("ingest_disease_provinces", "--lastdays", "14", stdout=output)

        apply_async_mock.assert_called_once_with(args=(), kwargs={"lastdays": "14"})
        self.assertIn("task-provinces", output.getvalue())

class CeleryIngestTaskTests(TestCase):
    @patch("api.tasks.ingest_disease_data")
    def test_ingest_disease_latest_task_calls_latest_ingest(self, latest_mock):
        from api.tasks import ingest_disease_latest

        ingest_disease_latest.run()

        latest_mock.assert_called_once_with()

    @patch("api.tasks.ingest_disease_states_data")
    def test_ingest_disease_states_task_calls_states_ingest(self, states_mock):
        from api.tasks import ingest_disease_states

        ingest_disease_states.run()

        states_mock.assert_called_once_with()

    @patch("api.tasks.ingest_disease_historical_data")
    def test_ingest_disease_historical_task_passes_lastdays(self, historical_mock):
        from api.tasks import ingest_disease_historical

        ingest_disease_historical.run(lastdays="all")

        historical_mock.assert_called_once_with(lastdays="all")

    @patch("api.tasks.ingest_disease_provinces_data")
    def test_ingest_disease_provinces_task_passes_lastdays(self, provinces_mock):
        from api.tasks import ingest_disease_provinces

        ingest_disease_provinces.run(lastdays="all")

        provinces_mock.assert_called_once_with(lastdays="all")

    @patch("api.tasks.ingest_disease_provinces_data")
    @patch("api.tasks.ingest_disease_states_data")
    @patch("api.tasks.ingest_disease_data")
    @patch("api.tasks.ingest_disease_historical_data")
    def test_ingest_disease_aggregate_task_runs_all_steps(
        self,
        historical_mock,
        latest_mock,
        states_mock,
        provinces_mock,
    ):
        from api.tasks import ingest_disease

        ingest_disease.run(lastdays="all", province_lastdays="all")

        historical_mock.assert_called_once_with(lastdays="all")
        latest_mock.assert_called_once_with()
        states_mock.assert_called_once_with()
        provinces_mock.assert_called_once_with(lastdays="all")

    @patch("api.tasks.ingest_disease_provinces_data")
    @patch("api.tasks.ingest_disease_states_data")
    @patch("api.tasks.ingest_disease_data")
    @patch("api.tasks.ingest_disease_historical_data")
    def test_ingest_disease_aggregate_task_respects_skip_flags(
        self,
        historical_mock,
        latest_mock,
        states_mock,
        provinces_mock,
    ):
        from api.tasks import ingest_disease

        ingest_disease.run(skip_historical=True, skip_provinces=True)

        historical_mock.assert_not_called()
        latest_mock.assert_called_once_with()
        states_mock.assert_called_once_with()
        provinces_mock.assert_not_called()

    @patch("api.tasks.precompute_summary_cache_payloads")
    def test_precompute_summary_cache_task_calls_cache_warmup(self, precompute_mock):
        from api.tasks import precompute_summary_cache

        precompute_mock.return_value = {"enabled": True, "warmed": 10}
        result = precompute_summary_cache.run()

        precompute_mock.assert_called_once_with()
        self.assertEqual(result, {"enabled": True, "warmed": 10})

    @patch("api.tasks.ingest_owid_backfill_data")
    def test_ingest_owid_backfill_task_parses_iso_dates(self, backfill_mock):
        from api.tasks import ingest_owid_backfill

        backfill_mock.return_value = (5, 1234)
        result = ingest_owid_backfill.run(
            from_date="2023-03-10",
            to_date="2023-03-12",
            source="disease.sh",
            csv_url="https://example.test/owid.csv",
        )

        backfill_mock.assert_called_once_with(
            from_date=date(2023, 3, 10),
            to_date=date(2023, 3, 12),
            source="disease.sh",
            csv_url="https://example.test/owid.csv",
        )
        self.assertEqual(result, (5, 1234))

    @patch("api.tasks.ingest_per_million_cases_file_data")
    def test_ingest_per_million_cases_file_task_calls_import(self, import_mock):
        from api.tasks import ingest_per_million_cases_file

        import_mock.return_value = (3, 77)
        result = ingest_per_million_cases_file.run(
            file_path="/tmp/per_million.csv",
            source="disease.sh",
            overwrite=False,
        )

        import_mock.assert_called_once_with(
            file_path="/tmp/per_million.csv",
            source="disease.sh",
            overwrite=False,
        )
        self.assertEqual(result, (3, 77))

class OwidBackfillCommandTests(TestCase):
    @patch("api.management.commands.ingest_owid_backfill.ingest_owid_backfill_task.apply_async")
    def test_runs_with_date_range(self, apply_async_mock):
        apply_async_mock.return_value = SimpleNamespace(id="task-owid")
        output = StringIO()

        call_command(
            "ingest_owid_backfill",
            "--from",
            "2023-03-10",
            "--to",
            "2023-03-12",
            stdout=output,
        )

        apply_async_mock.assert_called_once()
        call_args = apply_async_mock.call_args.kwargs
        self.assertEqual(call_args["args"], ())
        self.assertEqual(call_args["kwargs"]["from_date"], "2023-03-10")
        self.assertEqual(call_args["kwargs"]["to_date"], "2023-03-12")
        self.assertEqual(call_args["kwargs"]["source"], "disease.sh")
        self.assertIn("task-owid", output.getvalue())

    def test_rejects_invalid_date(self):
        with self.assertRaises(CommandError):
            call_command("ingest_owid_backfill", "--from", "2023/03/10")

class PerMillionCasesCommandTests(TestCase):
    @patch("api.management.commands.ingest_per_million_cases.ingest_per_million_cases_file_task.apply_async")
    def test_runs_with_required_file(self, apply_async_mock):
        apply_async_mock.return_value = SimpleNamespace(id="task-per-million")
        output = StringIO()

        call_command(
            "ingest_per_million_cases",
            "--file",
            "/tmp/per_million.csv",
            stdout=output,
        )

        apply_async_mock.assert_called_once_with(
            args=(),
            kwargs={
                "file_path": "/tmp/per_million.csv",
                "source": "disease.sh",
                "overwrite": True,
            },
        )
        self.assertIn("task-per-million", output.getvalue())

    @patch("api.management.commands.ingest_per_million_cases.ingest_per_million_cases_file_task.apply_async")
    def test_passes_no_overwrite_flag(self, apply_async_mock):
        apply_async_mock.return_value = SimpleNamespace(id="task-per-million-no-overwrite")

        call_command(
            "ingest_per_million_cases",
            "--file",
            "/tmp/per_million.csv",
            "--no-overwrite",
        )

        apply_async_mock.assert_called_once_with(
            args=(),
            kwargs={
                "file_path": "/tmp/per_million.csv",
                "source": "disease.sh",
                "overwrite": False,
            },
        )

class OwidPerCapitaConversionTests(TestCase):
    def test_converts_per_million_to_absolute(self):
        value = _estimate_absolute_from_per_million(per_million=4.17, population=39_701_744)
        self.assertEqual(value, 166.0)

    def test_converts_per_thousand_to_absolute(self):
        value = _estimate_absolute_from_per_thousand(per_thousand=1.25, population=1_000_000)
        self.assertEqual(value, 1250.0)

    def test_converts_per_hundred_to_absolute(self):
        value = _estimate_absolute_from_per_hundred(per_hundred=75, population=2_000_000)
        self.assertEqual(value, 1_500_000.0)

    def test_returns_none_when_population_missing(self):
        self.assertIsNone(_estimate_absolute_from_per_million(per_million=10, population=None))

class ProvinceFallbackFetchTests(TestCase):
    def test_uses_fallback_before_optional_http_call(self):
        fallback_record = {
            "country": "Netherlands",
            "province": "Bonaire, Sint Eustatius and Saba",
            "timeline": {},
        }

        with patch("api.services.ingest._try_fetch_json") as try_fetch_mock:
            record = _fetch_single_country_province_record(
                country_name="Netherlands",
                province_name="Bonaire, Sint Eustatius and Saba",
                lastdays="all",
                fallback_map={
                    ("netherlands", "bonaire, sint eustatius and saba"): fallback_record
                },
            )

        self.assertEqual(record, fallback_record)
        try_fetch_mock.assert_not_called()

    @patch("api.services.ingest._try_fetch_json")
    def test_fetches_when_fallback_missing(self, try_fetch_mock):
        try_fetch_mock.return_value = {"province": "Ontario", "timeline": {}}

        record = _fetch_single_country_province_record(
            country_name="Canada",
            province_name="Ontario",
            lastdays="all",
            fallback_map={},
        )

        self.assertEqual(record, {"province": "Ontario", "timeline": {}})
        try_fetch_mock.assert_called_once()
