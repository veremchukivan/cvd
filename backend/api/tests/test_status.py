from datetime import date

from django.test import TestCase

from api.models import DataPoint, Location, Province, ProvinceDataPoint, State, StateDataPoint

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
