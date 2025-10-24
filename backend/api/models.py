from django.db import models

class Location(models.Model):
    iso_code = models.CharField(max_length=10, unique=True)
    name = models.CharField(max_length=100)

    def __str__(self):
        return self.name

class DataPoint(models.Model):
    location = models.ForeignKey(Location, on_delete=models.CASCADE, related_name="datapoints")
    date = models.DateField()
    metric = models.CharField(max_length=50)
    value = models.FloatField(null=True, blank=True)
    source = models.CharField(max_length=50)

    class Meta:
        unique_together = ("location", "date", "metric", "source")
        ordering = ["date"]

    def __str__(self):
        return f"{self.location} - {self.metric} - {self.date}"
