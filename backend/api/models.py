from django.db import models


class Continent(models.Model):
    code = models.CharField(max_length=32, unique=True)
    name = models.CharField(max_length=100, unique=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Location(models.Model):
    iso_code = models.CharField(max_length=10, unique=True)
    name = models.CharField(max_length=100)
    continent = models.ForeignKey(
        Continent,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="locations",
    )

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


class State(models.Model):
    code = models.CharField(max_length=32, unique=True)
    name = models.CharField(max_length=100, unique=True)
    country_iso = models.CharField(max_length=10, default="USA")

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class StateDataPoint(models.Model):
    state = models.ForeignKey(State, on_delete=models.CASCADE, related_name="datapoints")
    date = models.DateField()
    metric = models.CharField(max_length=50)
    value = models.FloatField(null=True, blank=True)
    source = models.CharField(max_length=50)

    class Meta:
        unique_together = ("state", "date", "metric", "source")
        ordering = ["date"]

    def __str__(self):
        return f"{self.state} - {self.metric} - {self.date}"


class Province(models.Model):
    code = models.CharField(max_length=64, unique=True)
    name = models.CharField(max_length=160)
    country_name = models.CharField(max_length=100)
    country = models.ForeignKey(
        Location,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="provinces",
    )

    class Meta:
        ordering = ["country_name", "name"]
        unique_together = ("country_name", "name")

    def __str__(self):
        return f"{self.country_name}: {self.name}"


class ProvinceDataPoint(models.Model):
    province = models.ForeignKey(Province, on_delete=models.CASCADE, related_name="datapoints")
    date = models.DateField()
    metric = models.CharField(max_length=50)
    value = models.FloatField(null=True, blank=True)
    source = models.CharField(max_length=50)

    class Meta:
        unique_together = ("province", "date", "metric", "source")
        ordering = ["date"]

    def __str__(self):
        return f"{self.province} - {self.metric} - {self.date}"
