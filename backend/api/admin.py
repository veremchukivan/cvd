from django.contrib import admin

from .models import (
    Continent,
    DataPoint,
    Location,
    Province,
    ProvinceDataPoint,
    State,
    StateDataPoint,
)


@admin.register(Continent)
class ContinentAdmin(admin.ModelAdmin):
    list_display = ("name", "code")
    search_fields = ("name", "code")


@admin.register(Location)
class LocationAdmin(admin.ModelAdmin):
    list_display = ("iso_code", "name", "continent")
    search_fields = ("iso_code", "name")
    list_filter = ("continent",)


@admin.register(DataPoint)
class DataPointAdmin(admin.ModelAdmin):
    list_display = ("location", "date", "metric", "value", "source")
    search_fields = ("location__name", "location__iso_code", "metric", "source")
    list_filter = ("metric", "source", "date")


@admin.register(State)
class StateAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "country_iso")
    search_fields = ("name", "code", "country_iso")


@admin.register(StateDataPoint)
class StateDataPointAdmin(admin.ModelAdmin):
    list_display = ("state", "date", "metric", "value", "source")
    search_fields = ("state__name", "state__code", "metric", "source")
    list_filter = ("metric", "source", "date")


@admin.register(Province)
class ProvinceAdmin(admin.ModelAdmin):
    list_display = ("country_name", "name", "code", "country")
    search_fields = ("country_name", "name", "code", "country__iso_code", "country__name")
    list_filter = ("country_name",)


@admin.register(ProvinceDataPoint)
class ProvinceDataPointAdmin(admin.ModelAdmin):
    list_display = ("province", "date", "metric", "value", "source")
    search_fields = ("province__name", "province__country_name", "province__code", "metric", "source")
    list_filter = ("metric", "source", "date", "province__country_name")
