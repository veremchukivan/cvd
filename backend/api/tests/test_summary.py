import csv
import json
from datetime import date
from unittest.mock import patch

from django.core.cache import cache
from django.test import TestCase, override_settings

from api.models import Continent, DataPoint, Location

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

class SummaryExportEndpointTests(TestCase):
    def setUp(self):
        self.eu = Continent.objects.create(code="EU", name="Europe")
        self.ukr = Location.objects.create(iso_code="UKR", name="Ukraine", continent=self.eu)
        self.pol = Location.objects.create(iso_code="POL", name="Poland", continent=self.eu)

    def test_export_summary_csv_returns_attachment(self):
        DataPoint.objects.create(
            location=self.ukr,
            date=date(2023, 1, 3),
            metric="today_cases",
            value=7,
            source="disease.sh",
        )

        response = self.client.get(
            "/api/v1/export/summary/",
            {"metric": "cases", "date": "2023-01-03", "exportFormat": "csv"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("attachment; filename=", response["Content-Disposition"])
        decoded = response.content.decode("utf-8")
        rows = list(csv.DictReader(decoded.splitlines()))
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["isoCode"], "UKR")
        self.assertEqual(rows[0]["value"], "7.0")

    def test_export_summary_json_supports_continent_grouping(self):
        rows = [
            (self.ukr, date(2023, 1, 3), "cases", 100),
            (self.ukr, date(2023, 1, 3), "deaths", 10),
            (self.pol, date(2023, 1, 3), "cases", 200),
            (self.pol, date(2023, 1, 3), "deaths", 20),
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
            "/api/v1/export/summary/",
            {"metric": "mortality", "date": "2023-01-03", "groupBy": "continent", "exportFormat": "json"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("attachment; filename=", response["Content-Disposition"])
        payload = json.loads(response.content.decode("utf-8"))
        self.assertEqual(payload["groupBy"], "continent")
        rows_by_iso = {item["isoCode"]: item for item in payload["data"]}
        self.assertEqual(rows_by_iso["EU"]["value"], 10.0)

    def test_export_summary_rejects_unsupported_format(self):
        response = self.client.get(
            "/api/v1/export/summary/",
            {"metric": "cases", "date": "2023-01-03", "exportFormat": "xml"},
        )
        self.assertEqual(response.status_code, 400)


@override_settings(
    CACHES={
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "summary-cache-tests",
        }
    },
    SUMMARY_CACHE_TTL_SECONDS=300,
    SUMMARY_CACHE_KEY_PREFIX="test:summary:v1",
)

class SummaryResponseCachingTests(TestCase):
    def setUp(self):
        cache.clear()

    def tearDown(self):
        cache.clear()

    def test_map_endpoint_reuses_cached_payload(self):
        expected_payload = {
            "data": [{"isoCode": "UKR", "name": "Ukraine", "value": 7.0, "delta": None, "average": 7.0, "max": 7.0}],
            "metric": "cases",
            "groupBy": "country",
            "quality": {"metrics": ["today_cases"], "primarySource": "disease.sh"},
            "from": None,
            "to": None,
            "date": "2023-01-03",
        }
        with patch("api.views._build_map_summary_payload", return_value=expected_payload) as build_mock:
            first = self.client.get("/api/v1/map/", {"metric": "cases", "date": "2023-01-03"})
            second = self.client.get("/api/v1/map/", {"metric": "cases", "date": "2023-01-03"})

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(first.json(), expected_payload)
        self.assertEqual(second.json(), expected_payload)
        self.assertEqual(build_mock.call_count, 1)

    def test_summary_endpoint_reuses_cached_payload(self):
        expected_payload = {
            "data": [{"isoCode": "EU", "name": "Europe", "value": 12.0, "delta": 12.0, "average": 12.0, "max": 12.0}],
            "metric": "deaths",
            "groupBy": "continent",
            "quality": {"metrics": ["deaths"], "primarySource": "disease.sh"},
            "from": "2023-01-01",
            "to": "2023-01-03",
        }
        with patch("api.views._build_summary_payload", return_value=expected_payload) as build_mock:
            first = self.client.get(
                "/api/v1/summary/",
                {"metric": "deaths", "from": "2023-01-01", "to": "2023-01-03", "groupBy": "continent"},
            )
            second = self.client.get(
                "/api/v1/summary/",
                {"metric": "deaths", "from": "2023-01-01", "to": "2023-01-03", "groupBy": "continent"},
            )

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(first.json(), expected_payload)
        self.assertEqual(second.json(), expected_payload)
        self.assertEqual(build_mock.call_count, 1)


@override_settings(
    CACHES={
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "summary-precompute-tests",
        }
    },
    SUMMARY_CACHE_TTL_SECONDS=300,
    SUMMARY_CACHE_KEY_PREFIX="test:summary:precompute",
    SUMMARY_PRECOMPUTE_METRICS=("cases", "mortality"),
    SUMMARY_PRECOMPUTE_GROUP_BY=("country", "continent"),
    SUMMARY_PRECOMPUTE_RANGE_DAYS=7,
)

class SummaryCachePrecomputeTests(TestCase):
    def setUp(self):
        cache.clear()
        location = Location.objects.create(iso_code="UKR", name="Ukraine")
        rows = [
            (date(2023, 1, 2), "cases", 100),
            (date(2023, 1, 3), "cases", 120),
            (date(2023, 1, 2), "deaths", 4),
            (date(2023, 1, 3), "deaths", 6),
            (date(2023, 1, 3), "today_cases", 20),
        ]
        for point_date, metric, value in rows:
            DataPoint.objects.create(
                location=location,
                date=point_date,
                metric=metric,
                value=value,
                source="disease.sh",
            )

    def tearDown(self):
        cache.clear()

    def test_precompute_summary_cache_warms_all_variants(self):
        from api.views import precompute_summary_cache

        result = precompute_summary_cache()

        self.assertTrue(result["enabled"])
        self.assertEqual(result["metrics"], ["cases", "mortality"])
        self.assertEqual(result["groups"], ["country", "continent"])
        self.assertEqual(result["rangeDays"], 7)
        self.assertEqual(result["latestDate"], "2023-01-03")
        self.assertEqual(result["errors"], [])
        self.assertEqual(result["warmed"], 20)

class DataQualityPayloadTests(TestCase):
    def setUp(self):
        self.location = Location.objects.create(iso_code="UKR", name="Ukraine")

    def test_map_summary_includes_quality_for_cases(self):
        DataPoint.objects.create(
            location=self.location,
            date=date(2023, 1, 3),
            metric="today_cases",
            value=7,
            source="disease.sh",
        )

        response = self.client.get("/api/v1/map/", {"metric": "cases", "date": "2023-01-03"})
        payload = response.json()

        self.assertEqual(response.status_code, 200)
        quality = payload["quality"]
        self.assertEqual(quality["metrics"], ["today_cases"])
        self.assertEqual(quality["primarySource"], "disease.sh")
        self.assertEqual(quality["overallLatest"], "2023-01-03")
        self.assertEqual(quality["latestByMetric"]["today_cases"], "2023-01-03")

    def test_map_summary_includes_quality_for_mortality(self):
        rows = [
            (date(2023, 1, 3), "cases", 100, "disease.sh"),
            (date(2023, 1, 3), "deaths", 5, "owid"),
        ]
        for point_date, metric, value, source in rows:
            DataPoint.objects.create(
                location=self.location,
                date=point_date,
                metric=metric,
                value=value,
                source=source,
            )

        response = self.client.get("/api/v1/map/", {"metric": "mortality", "date": "2023-01-03"})
        payload = response.json()

        self.assertEqual(response.status_code, 200)
        quality = payload["quality"]
        self.assertEqual(quality["metrics"], ["cases", "deaths"])
        self.assertEqual(quality["overallLatest"], "2023-01-03")
        self.assertEqual(quality["latestByMetric"]["cases"], "2023-01-03")
        self.assertEqual(quality["latestByMetric"]["deaths"], "2023-01-03")

    def test_summary_includes_quality_metadata(self):
        DataPoint.objects.create(
            location=self.location,
            date=date(2023, 1, 2),
            metric="active",
            value=11,
            source="disease.sh",
        )
        response = self.client.get(
            "/api/v1/summary/",
            {"metric": "active", "from": "2023-01-01", "to": "2023-01-03"},
        )
        payload = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload["quality"]["metrics"], ["active"])
        self.assertEqual(payload["quality"]["primarySource"], "disease.sh")

class AnomalyDetectionPayloadTests(TestCase):
    def test_map_summary_detects_outlier_country(self):
        countries = [
            ("UKR", "Ukraine", 10),
            ("POL", "Poland", 11),
            ("DEU", "Germany", 12),
            ("CZE", "Czechia", 9),
            ("SVK", "Slovakia", 13),
            ("USA", "United States", 250),
        ]
        for iso, name, value in countries:
            location = Location.objects.create(iso_code=iso, name=name)
            DataPoint.objects.create(
                location=location,
                date=date(2023, 1, 3),
                metric="today_cases",
                value=value,
                source="disease.sh",
            )

        response = self.client.get("/api/v1/map/", {"metric": "cases", "date": "2023-01-03"})
        payload = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertIn("anomalies", payload)
        self.assertEqual(payload["anomalies"]["method"], "robust_zscore")
        self.assertEqual(payload["anomalies"]["count"], 1)
        self.assertEqual(payload["anomalies"]["items"][0]["isoCode"], "USA")
        self.assertEqual(payload["anomalies"]["items"][0]["direction"], "high")

    def test_summary_anomalies_empty_for_small_sample(self):
        countries = [
            ("UKR", "Ukraine", 100, 120),
            ("POL", "Poland", 150, 170),
            ("DEU", "Germany", 90, 95),
        ]
        for iso, name, start_value, end_value in countries:
            location = Location.objects.create(iso_code=iso, name=name)
            DataPoint.objects.create(
                location=location,
                date=date(2023, 1, 1),
                metric="cases",
                value=start_value,
                source="disease.sh",
            )
            DataPoint.objects.create(
                location=location,
                date=date(2023, 1, 3),
                metric="cases",
                value=end_value,
                source="disease.sh",
            )

        response = self.client.get(
            "/api/v1/summary/",
            {"metric": "cases", "from": "2023-01-01", "to": "2023-01-03"},
        )
        payload = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertIn("anomalies", payload)
        self.assertEqual(payload["anomalies"]["count"], 0)
        self.assertEqual(payload["anomalies"]["items"], [])

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
