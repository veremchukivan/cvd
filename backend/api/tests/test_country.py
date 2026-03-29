from datetime import date

from django.test import TestCase

from api.models import DataPoint, Location

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
