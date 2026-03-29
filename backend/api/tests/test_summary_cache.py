from datetime import date
from unittest.mock import patch

from django.core.cache import cache
from django.test import TestCase, override_settings

from api.models import DataPoint, Location


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
