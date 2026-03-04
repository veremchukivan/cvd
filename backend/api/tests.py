from datetime import date
from io import StringIO
from unittest.mock import patch

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase

from api.models import DataPoint, Location, Province, ProvinceDataPoint, State, StateDataPoint
from api.services.ingest import _fetch_single_country_province_record


class SyncStatusEndpointTests(TestCase):
    def test_returns_empty_status(self):
        response = self.client.get("/api/v1/sync/status/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "source": "disease.sh",
                "datapoints": 0,
                "locations": {"total": 0, "countries": 0, "includesWorld": False},
                "metrics": [],
                "metricCounts": {},
                "range": {"from": None, "to": None},
            },
        )

    def test_returns_aggregated_status_for_source(self):
        world = Location.objects.create(iso_code="WORLD", name="World")
        usa = Location.objects.create(iso_code="USA", name="United States")
        ukr = Location.objects.create(iso_code="UKR", name="Ukraine")

        DataPoint.objects.create(
            location=usa, date=date(2020, 1, 22), metric="cases", value=1, source="disease.sh"
        )
        DataPoint.objects.create(
            location=usa, date=date(2020, 1, 23), metric="deaths", value=2, source="disease.sh"
        )
        DataPoint.objects.create(
            location=world, date=date(2020, 1, 24), metric="cases", value=5, source="disease.sh"
        )
        DataPoint.objects.create(
            location=ukr, date=date(2020, 1, 25), metric="cases", value=10, source="other-source"
        )

        response = self.client.get("/api/v1/sync/status/")
        payload = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload["source"], "disease.sh")
        self.assertEqual(payload["datapoints"], 3)
        self.assertEqual(payload["locations"], {"total": 2, "countries": 1, "includesWorld": True})
        self.assertEqual(payload["metrics"], ["cases", "deaths"])
        self.assertEqual(payload["metricCounts"], {"cases": 2, "deaths": 1})
        self.assertEqual(payload["range"], {"from": "2020-01-22", "to": "2020-01-24"})

    def test_supports_source_query_param(self):
        location = Location.objects.create(iso_code="USA", name="United States")
        DataPoint.objects.create(
            location=location, date=date(2020, 1, 22), metric="cases", value=1, source="custom"
        )
        DataPoint.objects.create(
            location=location, date=date(2020, 1, 23), metric="cases", value=2, source="disease.sh"
        )

        response = self.client.get("/api/v1/sync/status/?source=custom")
        payload = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload["source"], "custom")
        self.assertEqual(payload["datapoints"], 1)
        self.assertEqual(payload["range"], {"from": "2020-01-22", "to": "2020-01-22"})


class SyncDiseaseCommandTests(TestCase):
    @patch("api.management.commands.sync_disease.ingest_disease_data")
    @patch("api.management.commands.sync_disease.ingest_disease_historical")
    @patch("api.management.commands.sync_disease.ingest_disease_provinces_data")
    @patch("api.management.commands.sync_disease.ingest_disease_states_data")
    def test_runs_all_by_default(self, states_mock, provinces_mock, historical_mock, latest_mock):
        historical_mock.return_value = (2, 200)
        latest_mock.return_value = (1, 15)
        provinces_mock.return_value = (5, 60)
        states_mock.return_value = (3, 18)
        output = StringIO()

        call_command("sync_disease", stdout=output)

        historical_mock.assert_called_once_with(lastdays="all")
        latest_mock.assert_called_once_with()
        provinces_mock.assert_called_once_with(lastdays="all")
        states_mock.assert_called_once_with()
        self.assertIn("historical=2 locations, 200 points", output.getvalue())
        self.assertIn("latest=1 locations, 15 points", output.getvalue())
        self.assertIn("states=3 states, 18 points", output.getvalue())
        self.assertIn("provinces=5 provinces, 60 points", output.getvalue())

    @patch("api.management.commands.sync_disease.ingest_disease_data")
    @patch("api.management.commands.sync_disease.ingest_disease_historical")
    @patch("api.management.commands.sync_disease.ingest_disease_provinces_data")
    @patch("api.management.commands.sync_disease.ingest_disease_states_data")
    def test_skip_historical_runs_latest_states_and_provinces(
        self,
        states_mock,
        provinces_mock,
        historical_mock,
        latest_mock,
    ):
        latest_mock.return_value = (4, 40)
        provinces_mock.return_value = (5, 60)
        states_mock.return_value = (3, 18)
        output = StringIO()

        call_command("sync_disease", "--skip-historical", stdout=output)

        historical_mock.assert_not_called()
        latest_mock.assert_called_once_with()
        provinces_mock.assert_called_once_with(lastdays="all")
        states_mock.assert_called_once_with()
        self.assertIn("latest=4 locations, 40 points", output.getvalue())
        self.assertIn("states=3 states, 18 points", output.getvalue())
        self.assertIn("provinces=5 provinces, 60 points", output.getvalue())

    def test_raises_if_both_stages_are_skipped(self):
        with self.assertRaises(CommandError):
            call_command(
                "sync_disease",
                "--skip-historical",
                "--skip-latest",
                "--skip-states",
                "--skip-provinces",
            )


class OwidBackfillCommandTests(TestCase):
    @patch("api.management.commands.ingest_owid_backfill.ingest_owid_backfill")
    def test_runs_with_date_range(self, ingest_mock):
        ingest_mock.return_value = (5, 1234)
        output = StringIO()

        call_command(
            "ingest_owid_backfill",
            "--from",
            "2023-03-10",
            "--to",
            "2023-03-12",
            stdout=output,
        )

        ingest_mock.assert_called_once()
        call_args = ingest_mock.call_args.kwargs
        self.assertEqual(call_args["from_date"], date(2023, 3, 10))
        self.assertEqual(call_args["to_date"], date(2023, 3, 12))
        self.assertEqual(call_args["source"], "disease.sh")
        self.assertIn("OWID backfill updated: 5 affected locations, 1234 records", output.getvalue())

    def test_rejects_invalid_date(self):
        with self.assertRaises(CommandError):
            call_command("ingest_owid_backfill", "--from", "2023/03/10")


class StateSyncStatusEndpointTests(TestCase):
    def test_returns_state_sync_status(self):
        state = State.objects.create(code="US_CALIFORNIA", name="California")
        StateDataPoint.objects.create(
            state=state,
            date=date(2026, 3, 1),
            metric="cases",
            value=123.0,
            source="disease.sh_states",
        )
        StateDataPoint.objects.create(
            state=state,
            date=date(2026, 3, 1),
            metric="deaths",
            value=4.0,
            source="disease.sh_states",
        )

        response = self.client.get("/api/v1/sync/status/states/")
        payload = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload["source"], "disease.sh_states")
        self.assertEqual(payload["states"], 1)
        self.assertEqual(payload["datapoints"], 2)
        self.assertEqual(payload["range"], {"from": "2026-03-01", "to": "2026-03-01"})


class ProvinceSyncStatusEndpointTests(TestCase):
    def test_returns_province_sync_status(self):
        country = Location.objects.create(iso_code="CAN", name="Canada")
        province = Province.objects.create(
            code="CANADA__ONTARIO",
            name="ontario",
            country_name="Canada",
            country=country,
        )
        ProvinceDataPoint.objects.create(
            province=province,
            date=date(2026, 3, 1),
            metric="cases",
            value=100.0,
            source="disease.sh_provinces",
        )
        ProvinceDataPoint.objects.create(
            province=province,
            date=date(2026, 3, 1),
            metric="deaths",
            value=3.0,
            source="disease.sh_provinces",
        )

        response = self.client.get("/api/v1/sync/status/provinces/")
        payload = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload["source"], "disease.sh_provinces")
        self.assertEqual(payload["provinces"], 1)
        self.assertEqual(payload["countries"], 1)
        self.assertEqual(payload["datapoints"], 2)
        self.assertEqual(payload["range"], {"from": "2026-03-01", "to": "2026-03-01"})


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


class TodayMetricsEndpointTests(TestCase):
    def setUp(self):
        self.location = Location.objects.create(iso_code="UKR", name="Ukraine")
        for idx, value in enumerate((10, 20, 5), start=1):
            DataPoint.objects.create(
                location=self.location,
                date=date(2023, 1, idx),
                metric="today_cases",
                value=value,
                source="disease.sh",
            )

    def test_map_summary_sums_today_metric_in_range_mode(self):
        response = self.client.get(
            "/api/v1/map/",
            {"metric": "today_cases", "from": "2023-01-01", "to": "2023-01-03"},
        )
        payload = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload["metric"], "today_cases")
        self.assertEqual(payload["data"][0]["isoCode"], "UKR")
        self.assertEqual(payload["data"][0]["value"], 35.0)

    def test_country_details_sums_today_metric_in_range_mode(self):
        response = self.client.get(
            "/api/v1/country/UKR/",
            {"metric": "today_cases", "from": "2023-01-01", "to": "2023-01-03"},
        )
        payload = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload["metric"], "today_cases")
        self.assertEqual(payload["headline"], 35.0)
        self.assertEqual(len(payload["series"]), 3)


class MapCasesDisplayLogicTests(TestCase):
    def setUp(self):
        self.location = Location.objects.create(iso_code="UKR", name="Ukraine")
        for idx, value in enumerate((10, 20, 5), start=1):
            DataPoint.objects.create(
                location=self.location,
                date=date(2023, 1, idx),
                metric="today_cases",
                value=value,
                source="disease.sh",
            )

    def test_map_summary_uses_daily_new_cases_in_day_mode_for_cases_metric(self):
        response = self.client.get(
            "/api/v1/map/",
            {"metric": "cases", "date": "2023-01-03"},
        )
        payload = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload["metric"], "cases")
        self.assertEqual(payload["data"][0]["isoCode"], "UKR")
        self.assertEqual(payload["data"][0]["value"], 5.0)

    def test_map_summary_sums_daily_new_cases_in_range_mode_for_cases_metric(self):
        response = self.client.get(
            "/api/v1/map/",
            {"metric": "cases", "from": "2023-01-02", "to": "2023-01-03"},
        )
        payload = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload["metric"], "cases")
        self.assertEqual(payload["data"][0]["isoCode"], "UKR")
        self.assertEqual(payload["data"][0]["value"], 25.0)
