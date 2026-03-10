from datetime import date
from io import StringIO
from unittest.mock import patch

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase

from api.models import Continent, DataPoint, Location, Province, ProvinceDataPoint, State, StateDataPoint
from api.services.ingest import (
    _estimate_absolute_from_per_hundred,
    _estimate_absolute_from_per_million,
    _estimate_absolute_from_per_thousand,
    _fetch_single_country_province_record,
)


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


class PerMillionCasesCommandTests(TestCase):
    @patch("api.management.commands.ingest_per_million_cases.ingest_per_million_cases_file")
    def test_runs_with_required_file(self, ingest_mock):
        ingest_mock.return_value = (3, 77)
        output = StringIO()

        call_command(
            "ingest_per_million_cases",
            "--file",
            "/tmp/per_million.csv",
            stdout=output,
        )

        ingest_mock.assert_called_once_with(
            file_path="/tmp/per_million.csv",
            source="disease.sh",
            overwrite=True,
        )
        self.assertIn("Per-million cases import updated: 3 affected locations, 77 records", output.getvalue())

    @patch("api.management.commands.ingest_per_million_cases.ingest_per_million_cases_file")
    def test_passes_no_overwrite_flag(self, ingest_mock):
        ingest_mock.return_value = (1, 5)

        call_command(
            "ingest_per_million_cases",
            "--file",
            "/tmp/per_million.csv",
            "--no-overwrite",
        )

        ingest_mock.assert_called_once_with(
            file_path="/tmp/per_million.csv",
            source="disease.sh",
            overwrite=False,
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


class MortalityMapSummaryTests(TestCase):
    def setUp(self):
        self.ukr = Location.objects.create(iso_code="UKR", name="Ukraine")
        self.pol = Location.objects.create(iso_code="POL", name="Poland")

        ukr_rows = [
            (date(2023, 1, 1), "cases", 100),
            (date(2023, 1, 1), "deaths", 10),
            (date(2023, 1, 2), "deaths", 15),
            (date(2023, 1, 3), "cases", 150),
            (date(2023, 1, 3), "deaths", 15),
        ]
        for point_date, metric, value in ukr_rows:
            DataPoint.objects.create(
                location=self.ukr,
                date=point_date,
                metric=metric,
                value=value,
                source="disease.sh",
            )

        # This country has no updates in the selected range window.
        DataPoint.objects.create(
            location=self.pol,
            date=date(2023, 1, 1),
            metric="cases",
            value=200,
            source="disease.sh",
        )
        DataPoint.objects.create(
            location=self.pol,
            date=date(2023, 1, 1),
            metric="deaths",
            value=20,
            source="disease.sh",
        )

    def test_map_summary_mortality_day_mode_returns_latest_ratio(self):
        response = self.client.get(
            "/api/v1/map/",
            {"metric": "mortality", "date": "2023-01-03"},
        )
        payload = response.json()

        self.assertEqual(response.status_code, 200)
        rows_by_iso = {item["isoCode"]: item for item in payload["data"]}
        self.assertEqual(rows_by_iso["UKR"]["value"], 10.0)
        self.assertEqual(rows_by_iso["UKR"]["delta"], None)

    def test_map_summary_mortality_range_mode_filters_to_active_locations(self):
        response = self.client.get(
            "/api/v1/map/",
            {"metric": "mortality", "from": "2023-01-02", "to": "2023-01-03"},
        )
        payload = response.json()

        self.assertEqual(response.status_code, 200)
        rows_by_iso = {item["isoCode"]: item for item in payload["data"]}

        self.assertIn("UKR", rows_by_iso)
        self.assertNotIn("POL", rows_by_iso)
        self.assertEqual(rows_by_iso["UKR"]["value"], 10.0)
        self.assertEqual(rows_by_iso["UKR"]["delta"], -5.0)


class ContinentAggregationEndpointTests(TestCase):
    def setUp(self):
        self.eu = Continent.objects.create(code="EU", name="Europe")
        self.asia = Continent.objects.create(code="AS", name="Asia")

        self.ukr = Location.objects.create(iso_code="UKR", name="Ukraine", continent=self.eu)
        self.pol = Location.objects.create(iso_code="POL", name="Poland", continent=self.eu)
        self.jpn = Location.objects.create(iso_code="JPN", name="Japan", continent=self.asia)

    def test_map_summary_groups_cases_by_continent(self):
        rows = [
            (self.ukr, date(2023, 1, 3), "today_cases", 10),
            (self.pol, date(2023, 1, 3), "today_cases", 20),
            (self.jpn, date(2023, 1, 3), "today_cases", 5),
        ]
        for location, point_date, metric, value in rows:
            DataPoint.objects.create(
                location=location,
                date=point_date,
                metric=metric,
                value=value,
                source="disease.sh",
            )

        response = self.client.get(
            "/api/v1/map/",
            {"metric": "cases", "date": "2023-01-03", "groupBy": "continent"},
        )
        payload = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload["groupBy"], "continent")
        rows_by_iso = {item["isoCode"]: item for item in payload["data"]}
        self.assertEqual(rows_by_iso["EU"]["value"], 30.0)
        self.assertEqual(rows_by_iso["AS"]["value"], 5.0)

    def test_summary_groups_range_change_by_continent(self):
        rows = [
            (self.ukr, date(2023, 1, 1), "cases", 100),
            (self.ukr, date(2023, 1, 3), "cases", 150),
            (self.pol, date(2023, 1, 1), "cases", 200),
            (self.pol, date(2023, 1, 3), "cases", 260),
            (self.jpn, date(2023, 1, 1), "cases", 80),
            (self.jpn, date(2023, 1, 3), "cases", 100),
        ]
        for location, point_date, metric, value in rows:
            DataPoint.objects.create(
                location=location,
                date=point_date,
                metric=metric,
                value=value,
                source="disease.sh",
            )

        response = self.client.get(
            "/api/v1/summary/",
            {"metric": "cases", "from": "2023-01-01", "to": "2023-01-03", "groupBy": "continent"},
        )
        payload = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload["groupBy"], "continent")
        rows_by_iso = {item["isoCode"]: item for item in payload["data"]}
        self.assertEqual(rows_by_iso["EU"]["value"], 110.0)
        self.assertEqual(rows_by_iso["AS"]["value"], 20.0)

    def test_map_summary_groups_mortality_by_continent(self):
        rows = [
            (self.ukr, date(2023, 1, 3), "cases", 100),
            (self.ukr, date(2023, 1, 3), "deaths", 10),
            (self.pol, date(2023, 1, 3), "cases", 200),
            (self.pol, date(2023, 1, 3), "deaths", 40),
            (self.jpn, date(2023, 1, 3), "cases", 100),
            (self.jpn, date(2023, 1, 3), "deaths", 5),
        ]
        for location, point_date, metric, value in rows:
            DataPoint.objects.create(
                location=location,
                date=point_date,
                metric=metric,
                value=value,
                source="disease.sh",
            )

        response = self.client.get(
            "/api/v1/map/",
            {"metric": "mortality", "date": "2023-01-03", "groupBy": "continent"},
        )
        payload = response.json()

        self.assertEqual(response.status_code, 200)
        rows_by_iso = {item["isoCode"]: item for item in payload["data"]}
        self.assertEqual(rows_by_iso["EU"]["value"], 16.67)
        self.assertEqual(rows_by_iso["AS"]["value"], 5.0)


class CountryDetailsPanelPayloadTests(TestCase):
    def setUp(self):
        self.location = Location.objects.create(iso_code="USA", name="United States")
        timeline_rows = [
            (date(2023, 1, 1), "cases", 100),
            (date(2023, 1, 2), "cases", 130),
            (date(2023, 1, 3), "cases", 180),
            (date(2023, 1, 1), "deaths", 10),
            (date(2023, 1, 2), "deaths", 15),
            (date(2023, 1, 3), "deaths", 18),
            (date(2023, 1, 1), "recovered", 50),
            (date(2023, 1, 2), "recovered", 80),
            (date(2023, 1, 3), "recovered", 140),
            (date(2023, 1, 1), "active", 40),
            (date(2023, 1, 2), "active", 35),
            (date(2023, 1, 3), "active", 22),
            (date(2023, 1, 1), "tests", 1000),
            (date(2023, 1, 2), "tests", 1200),
            (date(2023, 1, 3), "tests", 1900),
            (date(2023, 1, 2), "today_cases", 30),
            (date(2023, 1, 3), "today_cases", 50),
            (date(2023, 1, 2), "today_deaths", 5),
            (date(2023, 1, 3), "today_deaths", 3),
            (date(2023, 1, 2), "today_recovered", 30),
            (date(2023, 1, 3), "today_recovered", 60),
        ]
        for point_date, metric, value in timeline_rows:
            DataPoint.objects.create(
                location=self.location,
                date=point_date,
                metric=metric,
                value=value,
                source="disease.sh",
            )

    def test_country_details_returns_totals_peaks_and_coverage(self):
        response = self.client.get("/api/v1/country/USA/", {"metric": "cases", "date": "2023-01-03"})
        payload = response.json()

        self.assertEqual(response.status_code, 200)

        totals = payload["totals"]
        self.assertEqual(totals["cases"], 180.0)
        self.assertEqual(totals["deaths"], 18.0)
        self.assertEqual(totals["recovered"], 140.0)
        self.assertEqual(totals["active"], 22.0)
        self.assertEqual(totals["tests"], 1900.0)
        self.assertEqual(totals["incidence"], 50.0)
        self.assertEqual(totals["mortality"], 10.0)

        peaks = payload["dailyPeaks"]
        self.assertEqual(peaks["cases"], {"value": 50.0, "date": "2023-01-03"})
        self.assertEqual(peaks["deaths"], {"value": 5.0, "date": "2023-01-02"})
        self.assertEqual(peaks["recovered"], {"value": 60.0, "date": "2023-01-03"})
        self.assertEqual(peaks["tests"], {"value": 700.0, "date": "2023-01-03"})
        self.assertEqual(peaks["active"], {"value": None, "date": None})

        coverage = payload["coverage"]
        self.assertEqual(coverage["overallLatest"], "2023-01-03")
        self.assertEqual(coverage["latestByMetric"]["cases"], "2023-01-03")
        self.assertEqual(coverage["latestByMetric"]["today_recovered"], "2023-01-03")


class VaccinationMetricsEndpointTests(TestCase):
    def setUp(self):
        self.location = Location.objects.create(iso_code="UKR", name="Ukraine")
        timeline_rows = [
            (date(2023, 1, 1), "vaccinations_total", 100.0),
            (date(2023, 1, 2), "vaccinations_total", 170.0),
            (date(2023, 1, 1), "today_vaccinations", 40.0),
            (date(2023, 1, 2), "today_vaccinations", 70.0),
            (date(2023, 1, 2), "today_vaccinations_smoothed", 55.0),
        ]
        for point_date, metric, value in timeline_rows:
            DataPoint.objects.create(
                location=self.location,
                date=point_date,
                metric=metric,
                value=value,
                source="disease.sh",
            )

    def test_map_summary_supports_vaccination_total_metric(self):
        response = self.client.get(
            "/api/v1/map/",
            {"metric": "vaccinations_total", "from": "2023-01-01", "to": "2023-01-02"},
        )
        payload = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload["metric"], "vaccinations_total")
        self.assertEqual(payload["data"][0]["isoCode"], "UKR")
        self.assertEqual(payload["data"][0]["value"], 70.0)

    def test_country_details_supports_vaccination_alias_metric(self):
        response = self.client.get(
            "/api/v1/country/UKR/",
            {"metric": "total_vaccinations", "from": "2023-01-01", "to": "2023-01-02"},
        )
        payload = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload["metric"], "vaccinations_total")
        self.assertEqual(payload["headline"], 70.0)

    def test_country_details_supports_today_vaccinations_metric(self):
        response = self.client.get(
            "/api/v1/country/UKR/",
            {"metric": "today_vaccinations", "from": "2023-01-01", "to": "2023-01-02"},
        )
        payload = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload["metric"], "today_vaccinations")
        self.assertEqual(payload["headline"], 110.0)
