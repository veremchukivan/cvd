from rest_framework import serializers

from .models import DataPoint, Location


class LocationSerializer(serializers.ModelSerializer):
    continent = serializers.CharField(source="continent.name", read_only=True)

    class Meta:
        model = Location
        fields = ["iso_code", "name", "continent"]


class DataPointSerializer(serializers.ModelSerializer):
    location = LocationSerializer(read_only=True)

    class Meta:
        model = DataPoint
        fields = ["date", "metric", "value", "source", "location"]
