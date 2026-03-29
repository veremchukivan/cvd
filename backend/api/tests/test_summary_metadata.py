from datetime import date

from django.test import TestCase

from api.models import DataPoint, Location


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
